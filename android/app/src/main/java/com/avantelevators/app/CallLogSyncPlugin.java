package com.avantelevators.app;

import android.Manifest;
import android.database.Cursor;
import android.provider.CallLog;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Reads the device call log since a given timestamp; the JS side
 * (src/utils/callLogSync.js) pushes the results straight to Firestore's
 * callLogs collection, keyed off deviceCallId for dedup.
 */
@CapacitorPlugin(
    name = "CallLogSyncPlugin",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CALL_LOG }, alias = "callLog"),
        @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contacts")
    }
)
public class CallLogSyncPlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("callLog") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("callLog") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        } else {
            requestPermissionForAlias("callLog", call, "requestPermCallback");
        }
    }

    @PermissionCallback
    private void requestPermCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("callLog") == PermissionState.GRANTED);
        call.resolve(result);
    }

    // Contacts permission is optional — it only upgrades a call's display
    // from a bare number to the saved contact name, so a denial here never
    // blocks call-log sync itself (doFetch just leaves savedName null).
    @PluginMethod
    public void checkContactsPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("contacts") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void requestContactsPermission(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        } else {
            requestPermissionForAlias("contacts", call, "requestContactsPermCallback");
        }
    }

    @PermissionCallback
    private void requestContactsPermCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("contacts") == PermissionState.GRANTED);
        call.resolve(result);
    }

    // getCallsSince({ since: epochMs }) -> { calls: [{ deviceCallId, number, type, date, duration, savedName? }], permissionDenied?: true }
    @PluginMethod
    public void getCallsSince(PluginCall call) {
        if (getPermissionState("callLog") != PermissionState.GRANTED) {
            requestPermissionForAlias("callLog", call, "fetchPermCallback");
            return;
        }
        doFetch(call);
    }

    @PermissionCallback
    private void fetchPermCallback(PluginCall call) {
        if (getPermissionState("callLog") == PermissionState.GRANTED) {
            doFetch(call);
        } else {
            JSObject result = new JSObject();
            result.put("calls", new JSArray());
            result.put("permissionDenied", true);
            call.resolve(result);
        }
    }

    private void doFetch(PluginCall call) {
        long since = call.getLong("since", System.currentTimeMillis() - (30L * 24 * 60 * 60 * 1000));
        JSArray calls = new JSArray();
        boolean canLookupContacts = getPermissionState("contacts") == PermissionState.GRANTED;
        // A number repeats a lot in a real call log — cache lookups per run
        // instead of hitting the contacts provider once per row.
        java.util.Map<String, String> contactNameCache = new java.util.HashMap<>();

        try {
            String[] projection = {
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION
            };
            String selection = CallLog.Calls.DATE + " > ?";
            String[] args = { String.valueOf(since) };

            Cursor cursor = getActivity().getContentResolver().query(
                CallLog.Calls.CONTENT_URI, projection, selection, args, CallLog.Calls.DATE + " DESC"
            );

            if (cursor != null) {
                try {
                    while (cursor.moveToNext()) {
                        String id = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls._ID));
                        String number = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER));
                        int type = cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE));
                        long date = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE));
                        long duration = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION));

                        JSObject entry = new JSObject();
                        // CallLog.Calls._ID is only unique within this
                        // device's own call-log provider, not globally — the
                        // JS side scopes it per employee before using it as
                        // a Firestore doc id.
                        entry.put("deviceCallId", "device:" + id);
                        entry.put("number", number == null ? "" : number);
                        entry.put("type", CallLogUtil.typeLabel(type));
                        entry.put("date", date);
                        entry.put("duration", duration);
                        if (canLookupContacts && number != null && !number.isEmpty()) {
                            entry.put("savedName", CallLogUtil.lookupContactName(getActivity(), number, contactNameCache));
                        }
                        calls.put(entry);
                    }
                } finally {
                    cursor.close();
                }
            }

            JSObject result = new JSObject();
            result.put("calls", calls);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("CallLogSyncPlugin error: " + e.getMessage());
        }
    }
}
