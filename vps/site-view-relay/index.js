// Site View relay: pairs one company device (woken on demand by
// vps/site-sync-notifier) with an admin's Configurations > Site View tab, so
// the admin can browse and download the device's photo folders live. Every
// message just passes through this process in memory — nothing is written
// to disk here, which is the whole point (no storage bill, no bulk upload).
//
// Protocol (all text/JSON frames; binary payloads travel as base64 inside
// them, for simplicity over raw binary WebSocket frames):
//
//   Device  -> relay : {type:'register-device', employeeId, secret}
//   Admin   -> relay : {type:'register-admin', secret}
//   Admin   -> relay : {type:'watch', employeeId}
//   Admin   -> relay : {type:'list-folders', employeeId, requestId}
//   Admin   -> relay : {type:'list-media',   employeeId, requestId, bucket}
//   Admin   -> relay : {type:'get-thumbnail',employeeId, requestId, mediaId}
//   Admin   -> relay : {type:'get-file',     employeeId, requestId, mediaId}
//   Device  -> relay : {type:'folders',   requestId, folders:[{bucket,count}]}
//   Device  -> relay : {type:'media',     requestId, bucket, items:[...]}
//   Device  -> relay : {type:'thumbnail', requestId, mediaId, dataBase64}
//   Device  -> relay : {type:'file-chunk',requestId, mediaId, seq, dataBase64, done}
//   Device  -> relay : {type:'error',     requestId, message}
//   Relay -> admin   : device responses above, with employeeId added back in
//   Relay -> admin   : {type:'device-online'|'device-offline', employeeId}
//
// Run with: pm2 start index.js --name site-view-relay
require('dotenv').config()

const { WebSocketServer } = require('ws')

const PORT = Number(process.env.PORT) || 8082
const DEVICE_SECRET = process.env.DEVICE_SECRET
const ADMIN_SECRET = process.env.ADMIN_SECRET

if (!DEVICE_SECRET || !ADMIN_SECRET) {
  console.error('[Site View Relay] DEVICE_SECRET and ADMIN_SECRET must be set — see .env.example')
  process.exit(1)
}

function log(...args) {
  console.log(new Date().toISOString(), ...args)
}

// employeeId -> device WebSocket
const devices = new Map()
// employeeId -> Set<admin WebSocket>
const adminWatchers = new Map()
// requestId -> { employeeId, adminSocket }
const pendingRequests = new Map()

function sendJson(socket, obj) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(obj))
}

function broadcastToWatchers(employeeId, obj) {
  const watchers = adminWatchers.get(employeeId)
  if (!watchers) return
  for (const adminSocket of watchers) sendJson(adminSocket, obj)
}

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (socket) => {
  socket.role = null
  socket.employeeId = null

  socket.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return // ignore malformed frames
    }

    // ---- Registration (first message on the connection) ----
    if (msg.type === 'register-device') {
      if (msg.secret !== DEVICE_SECRET || !msg.employeeId) {
        socket.close(4001, 'bad device secret')
        return
      }
      socket.role = 'device'
      socket.employeeId = msg.employeeId
      devices.set(msg.employeeId, socket)
      log(`[device online] ${msg.employeeId}`)
      broadcastToWatchers(msg.employeeId, { type: 'device-online', employeeId: msg.employeeId })
      return
    }

    if (msg.type === 'register-admin') {
      if (msg.secret !== ADMIN_SECRET) {
        socket.close(4001, 'bad admin secret')
        return
      }
      socket.role = 'admin'
      return
    }

    if (!socket.role) {
      socket.close(4000, 'not registered')
      return
    }

    // ---- Admin -> device commands ----
    if (socket.role === 'admin') {
      if (msg.type === 'watch') {
        if (!adminWatchers.has(msg.employeeId)) adminWatchers.set(msg.employeeId, new Set())
        adminWatchers.get(msg.employeeId).add(socket)
        sendJson(socket, { type: 'device-status', employeeId: msg.employeeId, online: devices.has(msg.employeeId) })
        return
      }
      if (msg.type === 'unwatch') {
        adminWatchers.get(msg.employeeId)?.delete(socket)
        return
      }

      const forwardTypes = ['list-folders', 'list-media', 'get-thumbnail', 'get-file']
      if (forwardTypes.includes(msg.type)) {
        const deviceSocket = devices.get(msg.employeeId)
        if (!deviceSocket) {
          sendJson(socket, { type: 'error', employeeId: msg.employeeId, requestId: msg.requestId, message: 'Device is offline' })
          return
        }
        pendingRequests.set(msg.requestId, { employeeId: msg.employeeId, adminSocket: socket })
        const { employeeId, ...forwarded } = msg
        sendJson(deviceSocket, forwarded)
      }
      return
    }

    // ---- Device -> admin responses ----
    if (socket.role === 'device') {
      const pending = pendingRequests.get(msg.requestId)
      if (!pending) return // no admin is waiting on this (already timed out / disconnected)
      sendJson(pending.adminSocket, { ...msg, employeeId: pending.employeeId })
      // Only a file-chunk response spans multiple messages — keep the
      // mapping alive until the last chunk, drop it as soon as any other
      // response type (one-shot) or a final chunk arrives.
      if (msg.type !== 'file-chunk' || msg.done) {
        pendingRequests.delete(msg.requestId)
      }
    }
  })

  socket.on('close', () => {
    if (socket.role === 'device' && socket.employeeId) {
      devices.delete(socket.employeeId)
      log(`[device offline] ${socket.employeeId}`)
      broadcastToWatchers(socket.employeeId, { type: 'device-offline', employeeId: socket.employeeId })
    }
    if (socket.role === 'admin') {
      for (const watchers of adminWatchers.values()) watchers.delete(socket)
    }
  })
})

log(`[Site View Relay] listening on ws://localhost:${PORT} (put a TLS reverse proxy in front for wss://)`)
