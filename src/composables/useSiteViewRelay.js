// Thin RPC-over-WebSocket client for the Site View relay (vps/site-view-relay).
// One shared socket for the whole admin session: watchEmployee() subscribes
// to a device's online/offline status, and each command (listFolders,
// listMedia, getThumbnailUrl, downloadFile) resolves/rejects a Promise keyed
// by a generated requestId. A file download accumulates base64 chunks until
// the device marks its last one `done`.
const RELAY_WS_URL = 'wss://site-view.dazzloverse.com/'
const ADMIN_SECRET = 'e468a9aa1499e7e801ef9c97686fbb4f1a2a32a86288728a6613a0fa5af9e144'

// Reconnect backoff on a dropped connection (weak signal, carrier handoff,
// VPN switch, etc.) — doubles each failed attempt, capped at 15s, reset to
// the base delay the moment a connection actually opens.
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS  = 15000

let socket = null
let ready = null
let reconnectTimer = null
let reconnectDelay = RECONNECT_BASE_MS
const pending = new Map() // requestId -> {resolve, reject}
const fileBuffers = new Map() // requestId -> base64 chunk array
const statusListeners = new Map() // employeeId -> Set<callback({online})>

function genRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return ready
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }

  socket = new WebSocket(RELAY_WS_URL)
  ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      reconnectDelay = RECONNECT_BASE_MS
      socket.send(JSON.stringify({ type: 'register-admin', secret: ADMIN_SECRET }))
      // Resume watching whatever the admin UI still cares about — transparent
      // to the caller, since the drop could've happened mid-session.
      for (const employeeId of statusListeners.keys()) {
        socket.send(JSON.stringify({ type: 'watch', employeeId }))
      }
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

    // Nobody's watching anything — no point reconnecting until the next
    // explicit action calls connect() again.
    if (statusListeners.size === 0) return

    // Reflect the drop immediately instead of leaving stale "online" status
    // up while quietly retrying in the background.
    for (const employeeId of statusListeners.keys()) notifyStatus(employeeId, false)

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS)
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
  const set = statusListeners.get(employeeId)
  if (set) {
    set.delete(onStatusChange)
    // Empty sets must not linger — the reconnect loop checks statusListeners.size
    // to decide whether anyone still cares about the connection at all.
    if (set.size === 0) statusListeners.delete(employeeId)
  }
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

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', '3gp': 'video/3gpp', mov: 'video/quicktime',
  mkv: 'video/x-matroska', webm: 'video/webm',
}
function mimeTypeFor(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase()
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

/**
 * Fetches a device file's bytes over the relay and returns a Blob — the
 * caller decides what to do with it (save to device, show a preview, or
 * both). The relay protocol itself only carries raw base64 chunks, so the
 * MIME type here is inferred from the filename extension, not the device.
 */
export async function downloadFile(employeeId, mediaId, filename) {
  const base64 = await send('get-file', employeeId, { mediaId })
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return new Blob([bytes], { type: mimeTypeFor(filename) })
}
