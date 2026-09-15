package com.avantelevators.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

/**
 * Tracks which of this device's MediaStore images have already been uploaded,
 * so a re-scan (a retried wake, an interrupted upload, a device restart)
 * never re-uploads the same file. Purely local/per-device — no relation to
 * the callLogs dedup scheme, since site media never leaves this one device's
 * own table.
 */
final class SiteSyncDb extends SQLiteOpenHelper {
    private static final String DB_NAME = "site_sync.db";
    private static final int DB_VERSION = 1;

    SiteSyncDb(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE uploaded_media (media_id TEXT PRIMARY KEY, remote_path TEXT, uploaded_at INTEGER)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS uploaded_media");
        onCreate(db);
    }

    boolean isUploaded(String mediaId) {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT 1 FROM uploaded_media WHERE media_id = ?", new String[]{ mediaId });
        try {
            return c.moveToFirst();
        } finally {
            c.close();
        }
    }

    void markUploaded(String mediaId, String remotePath) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("media_id", mediaId);
        values.put("remote_path", remotePath);
        values.put("uploaded_at", System.currentTimeMillis());
        db.insertWithOnConflict("uploaded_media", null, values, SQLiteDatabase.CONFLICT_REPLACE);
    }
}
