/**
 * Cloudflare R2 fallback storage — S3-compatible upload using AWS SigV4.
 * Falls back automatically when Firebase Storage fails (quota, network, etc.).
 *
 * Usage:
 *   import { uploadToR2 } from '@/composables/useR2Storage'
 *   const url = await uploadToR2(blob, 'gallery/proj/file.jpg', 'image/jpeg')
 */

// ─── Configuration ────────────────────────────────────────────────────────────

export const R2_CONFIG = {
  accountId:       '08f8b22804695496f88e0f94d861ff9b',
  bucket:          'avant',
  endpoint:        'https://08f8b22804695496f88e0f94d861ff9b.r2.cloudflarestorage.com',
  region:          'auto',
  accessKeyId:     'd4975e7a7f7afbf14aa7e4df608c6bdf',
  secretAccessKey: '518cccb3979919b162aaa617f6a1a009ea31cd0fa36780f20cfe2d0a252ffca5',
  publicUrlBase:   'https://pub-f629e46a573a4863b5376606ab3c1cf6.r2.dev',
}

// ─── SigV4 helpers ────────────────────────────────────────────────────────────

const enc = new TextEncoder()

async function sha256hex(data) {
  const buf = typeof data === 'string' ? enc.encode(data) : data
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(key, data) {
  const rawKey = key instanceof CryptoKey ? key
    : await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const buf = typeof data === 'string' ? enc.encode(data) : data
  return new Uint8Array(await crypto.subtle.sign('HMAC', rawKey, buf))
}

function toHex(buf) {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getSigningKey(secret, dateStamp, region, service) {
  const kDate    = await hmacSha256(enc.encode('AWS4' + secret), dateStamp)
  const kRegion  = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}

// ─── Main upload function ─────────────────────────────────────────────────────

/**
 * Upload a Blob/File to Cloudflare R2 via S3-compatible PUT.
 * @param {Blob|File} blob        - The file data
 * @param {string}    key         - Storage key (path), e.g. 'gallery/proj/file.jpg'
 * @param {string}    contentType - MIME type, e.g. 'image/jpeg'
 * @returns {Promise<string>}     - Public URL of the uploaded file
 */
export async function uploadToR2(blob, key, contentType = 'application/octet-stream') {
  const { endpoint, bucket, accessKeyId, secretAccessKey, region, publicUrlBase } = R2_CONFIG

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured.')
  }

  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '')
  const dateStamp = amzDate.slice(0, 8)
  const host      = new URL(endpoint).hostname

  // Hash the request body
  const bodyBytes = await blob.arrayBuffer()
  const bodyHash  = await sha256hex(bodyBytes)

  // Canonical path: /<bucket>/<key> with each segment percent-encoded
  const keySegments  = key.split('/').map(s => encodeURIComponent(s)).join('/')
  const canonicalUri = `/${bucket}/${keySegments}`

  // Sorted canonical headers
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders    = 'content-type;host;x-amz-content-sha256;x-amz-date'

  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, bodyHash].join('\n')

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256hex(canonicalRequest),
  ].join('\n')

  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, 's3')
  const signature  = toHex(await hmacSha256(signingKey, stringToSign))
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const uploadUrl = `${endpoint}/${bucket}/${keySegments}`
  const response  = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type':         contentType,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date':           amzDate,
      Authorization:          authHeader,
    },
    body: bodyBytes,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => response.status)
    throw new Error(`R2 upload failed (${response.status}): ${text}`)
  }

  // Public bucket URL: pub-xxx.r2.dev/<key>  (no bucket name in path)
  // Endpoint fallback: endpoint/<bucket>/<key>
  const base = publicUrlBase
    ? publicUrlBase.replace(/\/$/, '')
    : `${endpoint.replace(/\/$/, '')}/${bucket}`
  return `${base}/${key}`
}

/** Returns true if R2 credentials are configured. */
export function isR2Configured() {
  return !!(R2_CONFIG.accessKeyId && R2_CONFIG.secretAccessKey)
}
