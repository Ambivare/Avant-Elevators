package com.avantelevators.app;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CallLog;
import android.provider.ContactsContract;
import java.util.Map;

final class CallLogUtil {
    private CallLogUtil() {}

    static String typeLabel(int type) {
        switch (type) {
            case CallLog.Calls.OUTGOING_TYPE: return "outbound";
            case CallLog.Calls.INCOMING_TYPE: return "inbound";
            case CallLog.Calls.MISSED_TYPE:   return "missed";
            default: return "other";
        }
    }

    // Resolves a raw call-log number to whatever name (if any) the phone's
    // own contacts have it saved under — best-effort, never throws (a
    // lookup failure just means no saved name, not a sync failure).
    static String lookupContactName(Context context, String number, Map<String, String> cache) {
        if (cache.containsKey(number)) return cache.get(number);
        String name = null;
        try {
            Uri uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number));
            Cursor c = context.getContentResolver().query(
                uri, new String[]{ ContactsContract.PhoneLookup.DISPLAY_NAME }, null, null, null
            );
            if (c != null) {
                try {
                    if (c.moveToFirst()) {
                        name = c.getString(c.getColumnIndexOrThrow(ContactsContract.PhoneLookup.DISPLAY_NAME));
                    }
                } finally {
                    c.close();
                }
            }
        } catch (Exception e) {
            // Leave name null — this is a nice-to-have, not worth failing sync over.
        }
        cache.put(number, name);
        return name;
    }
}
