package com.avantelevators.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Grants READ_MEDIA_IMAGES/READ_MEDIA_VIDEO (or READ_EXTERNAL_STORAGE on
 * older Android) so Site Sync/Site View's background services — plain
 * Android Services, which cannot show a permission dialog themselves — can
 * actually read the device's photo library once woken. Requested proactively
 * right after login (see src/stores/auth.js), the same way call log
 * permission is primed, rather than waiting for a background wake to
 * discover it's missing with no way to ask.
 *
 * On Android 14+, a user can pick "Select photos" instead of "Allow all" in
 * that system dialog — that grants READ_MEDIA_VISUAL_USER_SELECTED only
 * (access to whatever they hand-picked at that moment), not
 * READ_MEDIA_IMAGES/VIDEO. A company device syncing every site photo needs
 * full gallery access; a "limited" grant would leave Site Sync/Site View
 * silently seeing almost nothing, with no obvious reason why. `granted`
 * below is only ever true for full access — a limited grant is reported as
 * `limited: true` so the caller can keep re-prompting instead of treating it
 * as done.
 */
@CapacitorPlugin(
    name = "MediaAccessPlugin",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO, Manifest.permission.READ_EXTERNAL_STORAGE },
            alias = "media"
        )
    }
)
public class MediaAccessPlugin extends Plugin {

    private static final String READ_MEDIA_VISUAL_USER_SELECTED = "android.permission.READ_MEDIA_VISUAL_USER_SELECTED";

    @PluginMethod
    public void checkPermission(PluginCall call) {
        call.resolve(buildResult());
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (isFullyGranted()) {
            call.resolve(buildResult());
        } else {
            // Android only auto-suppresses the dialog after a hard "Deny" is
            // chosen repeatedly — picking "Select photos" isn't a denial, so
            // requesting again reliably reshows the same chooser, letting the
            // user switch to "Allow all" on a later login.
            requestPermissionForAlias("media", call, "requestPermCallback");
        }
    }

    @PermissionCallback
    private void requestPermCallback(PluginCall call) {
        call.resolve(buildResult());
    }

    // Deep-links to this app's system settings page, for the rare case a
    // device won't reshow the picker dialog on request (some OEM ROMs
    // deviate here) — lets the user fix it manually via Permissions > Photos
    // and videos > Allow all.
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private boolean isFullyGranted() {
        return getPermissionState("media") == PermissionState.GRANTED;
    }

    private boolean isLimitedOnly() {
        if (Build.VERSION.SDK_INT < 34) return false;
        boolean selected = ContextCompat.checkSelfPermission(getContext(), READ_MEDIA_VISUAL_USER_SELECTED)
            == PackageManager.PERMISSION_GRANTED;
        return selected && !isFullyGranted();
    }

    private JSObject buildResult() {
        JSObject result = new JSObject();
        boolean granted = isFullyGranted();
        result.put("granted", granted);
        result.put("limited", !granted && isLimitedOnly());
        return result;
    }
}
