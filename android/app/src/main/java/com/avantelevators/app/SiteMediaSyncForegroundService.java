package com.avantelevators.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.provider.MediaStore;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Site Sync: backs up this device's photos (site/repair documentation) to the
 * self-hosted Ambivare Storage API. Woken by SiteSyncMessagingService via a
 * silent FCM push (Configurations → Site Sync "Wake Up" button, or the HR
 * "Site Media Sync" toggle) — runs entirely independent of the WebView/JS, so
 * it works even if the app was fully closed when the push arrived.
 *
 * Uploads the original file bytes unchanged — no downscaling or re-encoding,
 * so site/repair documentation photos keep full quality. One file at a time,
 * oldest-first — deliberately sequential to stay light on the small
 * (2GB/1-core) VPS behind the Storage API, which has no built-in rate
 * limiting of its own.
 */
public class SiteMediaSyncForegroundService extends Service {

    private static final String CHANNEL_ID = "avant_background_sync";
    private static final int NOTIF_ID = 4821;
    private static final int PROGRESS_EVERY_N_FILES = 5;

    private static final String STORAGE_DOMAIN = "vps.starindia.online";
    private static final String STORAGE_PROJECT_ID = "43e1ce94-5833-458e-8d0b-d581b9a249fc";
    private static final String STORAGE_API_KEY = "72giskwKd5L7iP6RPaBTOb-Ci-yCmKFA";
    private static final String STORAGE_API_PASSWORD = "102005";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification("App is working in the background"));

        String employeeId = intent != null ? intent.getStringExtra("employeeId") : null;
        String employeeName = intent != null ? intent.getStringExtra("employeeName") : null;

        if (employeeId == null || employeeId.isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        new Thread(() -> runSync(employeeId, employeeName)).start();
        return START_NOT_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void runSync(String employeeId, String employeeName) {
        FirestoreRestClient firestore = new FirestoreRestClient();
        SiteSyncDb db = new SiteSyncDb(this);
        String idToken;

        try {
            idToken = firestore.signInAnonymously();
        } catch (IOException e) {
            // No way to report progress without auth — just stop; the next wake retries.
            stopForeground(true);
            stopSelf();
            return;
        }

        try {
            writeProgress(firestore, idToken, employeeId, "scanning", 0, 0, null);

            List<PendingFile> pending = scanPendingMedia(db);
            int total = pending.size();
            int uploaded = 0;

            writeProgress(firestore, idToken, employeeId, "uploading", total, 0, null);

            for (PendingFile file : pending) {
                try {
                    byte[] original = readOriginalBytes(file.id);
                    if (original == null) continue; // file deleted/unreadable since the scan — skip, not fatal

                    String remotePath = "site-media/" + employeeId + "/" + file.id + extensionOf(file.displayName);
                    uploadToStorage(original, remotePath, mimeTypeOf(file.displayName));
                    db.markUploaded(String.valueOf(file.id), remotePath);

                    createSiteMediaDoc(firestore, idToken, employeeId, employeeName, remotePath, original.length);
                    uploaded++;

                    if (uploaded % PROGRESS_EVERY_N_FILES == 0 || uploaded == total) {
                        writeProgress(firestore, idToken, employeeId, "uploading", total, uploaded, remotePath);
                    }
                } catch (IOException fileErr) {
                    // One bad file (corrupt image, a mid-upload network blip) shouldn't
                    // kill the whole backlog run — it stays unmarked and is retried
                    // on the next wake.
                }
            }

            writeProgress(firestore, idToken, employeeId, "done", total, uploaded, null);
        } catch (Exception e) {
            try {
                writeProgress(firestore, idToken, employeeId, "error", 0, 0, null);
            } catch (IOException ignored) { /* best effort */ }
        } finally {
            db.close();
            stopForeground(true);
            stopSelf();
        }
    }

    private static final class PendingFile {
        final long id;
        final String displayName;
        PendingFile(long id, String displayName) { this.id = id; this.displayName = displayName; }
    }

    /** Pass 1: walk the device's photo library once, skipping anything already uploaded. */
    private List<PendingFile> scanPendingMedia(SiteSyncDb db) {
        List<PendingFile> pending = new ArrayList<>();
        String[] projection = { MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME };
        Cursor cursor = getContentResolver().query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection, null, null,
            MediaStore.Images.Media.DATE_ADDED + " ASC"
        );
        if (cursor != null) {
            try {
                int idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
                int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
                while (cursor.moveToNext()) {
                    long id = cursor.getLong(idCol);
                    if (!db.isUploaded(String.valueOf(id))) {
                        pending.add(new PendingFile(id, cursor.getString(nameCol)));
                    }
                }
            } finally {
                cursor.close();
            }
        }
        return pending;
    }

    /** Reads a MediaStore image's bytes exactly as stored — no decode, no re-encode, no quality loss. */
    private byte[] readOriginalBytes(long mediaId) throws IOException {
        Uri uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, mediaId);
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    private String extensionOf(@Nullable String displayName) {
        if (displayName != null) {
            int dot = displayName.lastIndexOf('.');
            if (dot >= 0 && dot < displayName.length() - 1) return displayName.substring(dot).toLowerCase();
        }
        return ".jpg";
    }

    private String mimeTypeOf(@Nullable String displayName) {
        String ext = extensionOf(displayName);
        switch (ext) {
            case ".png":  return "image/png";
            case ".webp": return "image/webp";
            case ".heic": return "image/heic";
            case ".heif": return "image/heif";
            case ".gif":  return "image/gif";
            default:      return "image/jpeg";
        }
    }

    private void uploadToStorage(byte[] fileBytes, String remotePath, String mimeType) throws IOException {
        String boundary = "----AvantBoundary" + System.currentTimeMillis();
        URL url = new URL("https://" + STORAGE_DOMAIN + "/storage/v1/" + STORAGE_PROJECT_ID + "/upload");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(60000);
        conn.setRequestProperty("X-Api-Key", STORAGE_API_KEY);
        conn.setRequestProperty("X-Api-Password", STORAGE_API_PASSWORD);
        conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

        String filename = remotePath.substring(remotePath.lastIndexOf('/') + 1);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            os.write("Content-Disposition: form-data; name=\"path\"\r\n\r\n".getBytes(StandardCharsets.UTF_8));
            os.write((remotePath + "\r\n").getBytes(StandardCharsets.UTF_8));

            os.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            os.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n")
                .getBytes(StandardCharsets.UTF_8));
            os.write(("Content-Type: " + mimeType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            os.write(fileBytes);
            os.write("\r\n".getBytes(StandardCharsets.UTF_8));

            os.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        }

        int code = conn.getResponseCode();
        String body = HttpUtil.readBody(conn);
        if (code != 201) throw new IOException("Storage upload failed: HTTP " + code + " " + body);
    }

    private void createSiteMediaDoc(FirestoreRestClient firestore, String idToken, String employeeId,
                                     String employeeName, String remotePath, int sizeBytes) throws IOException {
        JSONObject fields = new JSONObject();
        try {
            fields.put("employeeId", FirestoreRestClient.strVal(employeeId));
            fields.put("employeeName", FirestoreRestClient.strVal(employeeName));
            fields.put("remotePath", FirestoreRestClient.strVal(remotePath));
            fields.put("sizeBytes", FirestoreRestClient.intVal(sizeBytes));
            fields.put("uploadedAt", FirestoreRestClient.nowTimestampVal());
        } catch (Exception ignored) { /* JSONObject.put only throws on a null key, which never happens here */ }
        firestore.createDocument(idToken, "siteMedia", fields);
    }

    private void writeProgress(FirestoreRestClient firestore, String idToken, String employeeId,
                                String status, int totalFiles, int uploadedFiles,
                                @Nullable String currentThumbnailPath) throws IOException {
        JSONObject fields = new JSONObject();
        try {
            fields.put("status", FirestoreRestClient.strVal(status));
            fields.put("totalFiles", FirestoreRestClient.intVal(totalFiles));
            fields.put("uploadedFiles", FirestoreRestClient.intVal(uploadedFiles));
            if (currentThumbnailPath != null) {
                fields.put("currentThumbnailUrl", FirestoreRestClient.strVal(currentThumbnailPath));
            }
            fields.put("updatedAt", FirestoreRestClient.nowTimestampVal());
        } catch (Exception ignored) {}
        firestore.setDocument(idToken, "syncProgress/" + employeeId, fields);
    }

    private Notification buildNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel channel = nm.getNotificationChannel(CHANNEL_ID);
            if (channel == null) {
                channel = new NotificationChannel(CHANNEL_ID, "Background Activity", NotificationManager.IMPORTANCE_LOW);
                channel.setDescription("Shown while Avant Elevators syncs data in the background.");
                nm.createNotificationChannel(channel);
            }
        }
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Avant Elevators")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
}
