// Thin RPC-over-WebSocket client for the Site View relay (vps/site-view-relay).
// One shared socket for the whole admin session: watchEmployee() subscribes
// to a device's online/offline status, and each command (listFolders,
// listMedia, getThumbnailUrl, downloadFile) resolves/rejects a Promise keyed
// by a generated requestId. A file download accumulates base64 chunks until
// the device marks its last one `done`.
const RELAY_WS_URL = 'wss://site-view.ambivare.com/'
const ADMIN_SECRET = 'e468a9aa1499e7e801ef9c97686fbb4f1a2a32a86288728a6613a0fa5af9e144'

let socket = null
let ready = null
const pending = new Map() // requestId -> {resolve, reject}
const fileBuffers = new Map() // requestId -> base64 chunk array
const statusListeners = new Map() // employeeId -> Set<callback({online})>

function genRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return ready
  socket = new WebSocket(RELAY_WS_URL)
  ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'register-admin', secret: ADMIN_SECRET }))
      resolve()
    })
    socket.addEventListener('error', reject)
  })
  socket.addEventListener('message', (evt) => {
    let msg
    try { msg = JSON.parse(evt.data) } catch { return }
    handleMessage(msg)
  })
  socket.addEventListener('close', () => {
    socket = null
    for (const p of pending.values()) p.reject(new Error('Relay connection closed'))
    pending.clear()
    fileBuffers.clear()
  })
  return ready
}

function notifyStatus(employeeId, online) {
  const set = statusListeners.get(employeeId)
  if (set) set.forEach((cb) => cb({ online }))
}

function handleMessage(msg) {
  if (msg.type === 'device-online' || msg.type === 'device-status') {
    notifyStatus(msg.employeeId, msg.type === 'device-status' ? !!msg.online : true)
    return
  }
  if (msg.type === 'device-offline') {
    notifyStatus(msg.employeeId, false)
    return
  }

  const p = pending.get(msg.requestId)
  if (!p) return

  if (msg.type === 'error') {
    pending.delete(msg.requestId)
    fileBuffers.delete(msg.requestId)
    p.reject(new Error(msg.message || 'Request failed'))
    return
  }

  if (msg.type === 'file-chunk') {
    if (!fileBuffers.has(msg.requestId)) fileBuffers.set(msg.requestId, [])
    if (msg.dataBase64) fileBuffers.get(msg.requestId).push(msg.dataBase64)
    if (msg.done) {
      pending.delete(msg.requestId)
      const base64 = fileBuffers.get(msg.requestId).join('')
      fileBuffers.delete(msg.requestId)
      p.resolve(base64)
    }
    return
  }

  // One-shot responses: folders, media, thumbnail.
  pending.delete(msg.requestId)
  p.resolve(msg)
}

async function send(type, employeeId, extra = {}) {
  await connect()
  const requestId = genRequestId()
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject })
    socket.send(JSON.stringify({ type, employeeId, requestId, ...extra }))
  })
}

/** Subscribes to an employee's device online/offline status. Call unwatchEmployee to stop. */
export async function watchEmployee(employeeId, onStatusChange) {
  await connect()
  if (!statusListeners.has(employeeId)) statusListeners.set(employeeId, new Set())
  statusListeners.get(employeeId).add(onStatusChange)
  socket.send(JSON.stringify({ type: 'watch', employeeId }))
}

export function unwatchEmployee(employeeId, onStatusChange) {
  statusListeners.get(employeeId)?.delete(onStatusChange)
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'unwatch', employeeId }))
  }
}

export async function listFolders(employeeId) {
  const res = await send('list-folders', employeeId)
  return res.folders || []
}

export async function listMedia(employeeId, bucket) {
  const res = await send('list-media', employeeId, { bucket })
  return res.items || []
}

export async function getThumbnailUrl(employeeId, mediaId) {
  const res = await send('get-thumbnail', employeeId, { mediaId })
  return `data:image/jpeg;base64,${res.dataBase64}`
}

export async function downloadFile(employeeId, mediaId, filename) {
  const base64 = await send('get-file', employeeId, { mediaId })
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || mediaId
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
