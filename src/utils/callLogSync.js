// Thin JS wrapper around the native CallLogSyncPlugin (android/app/src/main/
// java/com/avantelevators/app/CallLogSyncPlugin.java). On plain web (no
// native runtime) every call resolves to an empty/denied result rather than
// throwing, so callers can no-op gracefully — call log access is Android-only.
import { registerPlugin, Capacitor } from '@capacitor/core'

const CallLogSyncPlugin = registerPlugin('CallLogSyncPlugin')

export function isNative() {
  return Capacitor.isNativePlatform()
}

export async function checkCallLogPermission() {
  if (!isNative()) return false
  const { granted } = await CallLogSyncPlugin.checkPermission()
  return !!granted
}

export async function requestCallLogPermission() {
  if (!isNative()) return false
  const { granted } = await CallLogSyncPlugin.requestPermission()
  return !!granted
}

// Optional — only upgrades a call's display from a bare number to the
// employee's own saved contact name. Never blocks call-log sync itself.
export async function requestContactsPermission() {
  if (!isNative()) return false
  const { granted } = await CallLogSyncPlugin.requestContactsPermission()
  return !!granted
}

/** @returns {Promise<{calls: Array<{deviceCallId:string,number:string,type:string,date:number,duration:number,savedName?:string}>, permissionDenied: boolean}>} */
export async function getCallsSince(sinceMs) {
  if (!isNative()) return { calls: [], permissionDenied: false }
  const { calls, permissionDenied } = await CallLogSyncPlugin.getCallsSince({ since: sinceMs })
  return { calls: calls ?? [], permissionDenied: !!permissionDenied }
}
