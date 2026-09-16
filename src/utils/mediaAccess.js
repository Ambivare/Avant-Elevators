// Thin JS wrapper around the native MediaAccessPlugin (android/app/src/main/
// java/com/avantelevators/app/MediaAccessPlugin.java). Site Sync's backlog
// upload and Site View's live browsing both run as plain Android Services —
// they have no Activity context, so they can never show a permission dialog
// themselves. This has to be requested ahead of time, from a real Activity,
// which is why it's primed at login (see src/stores/auth.js) rather than
// from inside either background service.
import { registerPlugin, Capacitor } from '@capacitor/core'

const MediaAccessPlugin = registerPlugin('MediaAccessPlugin')

function isNative() {
  return Capacitor.isNativePlatform()
}

/**
 * @returns {Promise<{granted: boolean, limited: boolean}>}
 * `granted` is only ever true for full gallery access. On Android 14+ a
 * user can pick "Select photos" instead of "Allow all" — that's reported as
 * `limited: true`, not `granted: true`, since a company device syncing site
 * photos needs the whole gallery, not just whatever was hand-picked.
 * Calling this again on a later login re-shows the same system chooser, so
 * it's safe (and intended) to keep calling it every login until granted.
 */
export async function requestMediaAccess() {
  if (!isNative()) return { granted: false, limited: false }
  try {
    const result = await MediaAccessPlugin.requestPermission()
    return { granted: !!result?.granted, limited: !!result?.limited }
  } catch {
    return { granted: false, limited: false }
  }
}

// Fallback for the rare device that won't reshow the picker dialog on
// request (some OEM ROMs deviate here) — deep-links to this app's system
// settings page so the user can switch to "Allow all" manually.
export async function openMediaSettings() {
  if (!isNative()) return
  try { await MediaAccessPlugin.openAppSettings() } catch { /* best effort */ }
}
