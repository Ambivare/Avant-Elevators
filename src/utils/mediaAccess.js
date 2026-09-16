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

export async function requestMediaAccess() {
  if (!isNative()) return false
  try {
    const { granted } = await MediaAccessPlugin.requestPermission()
    return !!granted
  } catch {
    return false
  }
}
