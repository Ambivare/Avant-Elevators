// Client for the self-hosted Ambivare Storage API (vps.starindia.online) —
// used for the Site Sync feature's live thumbnails in Configurations. The
// actual uploads happen natively on-device (android/.../SiteMediaSyncForegroundService.java);
// this module only needs read access, to preview what's landing in real time.
const DOMAIN     = 'vps.starindia.online'
const PROJECT_ID = '43e1ce94-5833-458e-8d0b-d581b9a249fc'
const API_KEY      = '72giskwKd5L7iP6RPaBTOb-Ci-yCmKFA'
const API_PASSWORD = '102005'

const BASE = `https://${DOMAIN}/storage/v1/${PROJECT_ID}`

const authHeaders = { 'X-Api-Key': API_KEY, 'X-Api-Password': API_PASSWORD }

// Fetches a stored file with credentials and returns a local blob URL —
// works whether the project's paths are Public or Private, and avoids
// embedding the API password in a plain <img src>. Caller must revoke the
// returned URL (URL.revokeObjectURL) once done with it.
export async function fetchStorageThumbnail(path) {
  if (!path) return null
  const res = await fetch(`${BASE}/file/${path}`, { headers: authHeaders })
  if (!res.ok) throw new Error(`Storage fetch failed (${res.status})`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
