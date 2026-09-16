package com.avantelevators.app;

import android.Manifest;
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

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("media") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("media") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        } else {
            requestPermissionForAlias("media", call, "requestPermCallback");
        }
    }

    @PermissionCallback
    private void requestPermCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("media") == PermissionState.GRANTED);
        call.resolve(result);
    }
}
