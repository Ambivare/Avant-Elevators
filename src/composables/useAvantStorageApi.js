// Client for the self-hosted Ambivare Storage API (storage.ambivare.com) —
// a tiny Firebase-Storage-/R2-style bucket built into Ambivare VPS Manager.
// Used directly from the browser for attendance selfies (and any other
// web-app upload that previously went through Firebase Storage + R2).
const DOMAIN      = 'storage.ambivare.com'
const PROJECT_ID  = 'e78b6685-2ced-440d-9d45-561a149d8b9c'
const API_KEY      = 'qxWsqM2hrIW3ND5C-U4uI6bhl5UC3QG3'
const API_PASSWORD = '102005'

const BASE = `https://${DOMAIN}/storage/v1/${PROJECT_ID}`
const authHeaders = { 'X-Api-Key': API_KEY, 'X-Api-Password': API_PASSWORD }

/**
 * Upload a Blob/File and return its public URL.
 * @param {Blob|File} blob
 * @param {string}    path        Storage key, e.g. 'attendance-selfies/emp1/2026-10-15.jpg'
 * @param {string}    contentType MIME type, e.g. 'image/jpeg'
 * @returns {Promise<string>}     Public URL of the uploaded file
 */
export async function uploadToStorageApi(blob, path, contentType = 'application/octet-stream') {
  const form = new FormData()
  form.append('file', blob, path.split('/').pop())
  form.append('path', path)

  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: form,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Storage upload failed (${res.status})`)
  }

  const data = await res.json()
  return data.url
}

/** Fetches a stored file with credentials and returns a local blob URL — use
 * when a path is Private under the project's rules. Caller must revoke the
 * returned URL (URL.revokeObjectURL) once done with it. */
export async function fetchStorageApiBlob(path) {
  if (!path) return null
  const res = await fetch(`${BASE}/file/${path}`, { headers: authHeaders })
  if (!res.ok) throw new Error(`Storage fetch failed (${res.status})`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
