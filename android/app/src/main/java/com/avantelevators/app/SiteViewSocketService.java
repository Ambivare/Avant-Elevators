package com.avantelevators.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.MediaStore;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Site View: holds a live WebSocket to the relay (vps/site-view-relay) so an
 * admin's Configurations > Site View tab can browse this device's photo
 * folders in real time — nothing gets uploaded or stored anywhere unless the
 * admin explicitly downloads a specific file. Woken the same way as Site
 * Sync (see SiteSyncMessagingService), and closes itself automatically after
 * a period with no admin activity so it doesn't sit connected indefinitely.
 */
public class SiteViewSocketService extends Service {

    // TODO: point this at wherever vps/site-view-relay is actually deployed
    // (a subdomain with TLS, reverse-proxied to the relay's port — browsers
    // require wss:// from an https:// page).
    private static final String RELAY_WS_URL = "wss://site-view.ambivare.com/";
    private static final String DEVICE_SECRET = "change-me-device-secret"; // must match the relay's DEVICE_SECRET

    private static final String CHANNEL_ID = "avant_background_sync"; // shared with Site Sync — one notification, not two
    private static final int NOTIF_ID = 4821;
    private static final int THUMB_MAX_DIMENSION = 320;
    private static final int THUMB_QUALITY = 70;
    private static final long IDLE_TIMEOUT_MS = 5 * 60 * 1000; // auto-disconnect 5 min after the last admin command
    private static final long IDLE_CHECK_INTERVAL_MS = 30 * 1000;
    private static final int FILE_CHUNK_SIZE = 48 * 1024; // pre-base64; ~64KB on the wire

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS) // keeps the socket alive through idle NAT/carrier timeouts
        .build();

    private WebSocket webSocket;
    private volatile long lastActivityAt = System.currentTimeMillis();
    private final Handler idleHandler = new Handler(Looper.getMainLooper());
    private final Runnable idleCheck = this::checkIdle;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification());

        String employeeId = intent != null ? intent.getStringExtra("employeeId") : null;
        if (employeeId == null || employeeId.isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        connect(employeeId);
        idleHandler.postDelayed(idleCheck, IDLE_CHECK_INTERVAL_MS);
        return START_NOT_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        idleHandler.removeCallbacks(idleCheck);
        if (webSocket != null) webSocket.close(1000, "service stopped");
    }

    private void checkIdle() {
        if (System.currentTimeMillis() - lastActivityAt > IDLE_TIMEOUT_MS) {
            stopSelf();
            return;
        }
        idleHandler.postDelayed(idleCheck, IDLE_CHECK_INTERVAL_MS);
    }

    private void connect(String employeeId) {
        Request request = new Request.Builder().url(RELAY_WS_URL).build();
        webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket ws, Response response) {
                JSONObject register = new JSONObject();
                try {
                    register.put("type", "register-device");
                    register.put("employeeId", employeeId);
                    register.put("secret", DEVICE_SECRET);
                } catch (Exception ignored) {}
                ws.send(register.toString());
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                lastActivityAt = System.currentTimeMillis();
                handleCommand(ws, text);
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, @Nullable Response response) {
                stopSelf();
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                stopSelf();
            }
        });
    }

    private void handleCommand(WebSocket ws, String text) {
        try {
            JSONObject msg = new JSONObject(text);
            String type = msg.getString("type");
            String requestId = msg.optString("requestId", null);

            switch (type) {
                case "list-folders":
                    sendFolders(ws, requestId);
                    break;
                case "list-media":
                    sendMedia(ws, requestId, msg.getString("bucket"));
                    break;
                case "get-thumbnail":
                    sendThumbnail(ws, requestId, msg.getString("mediaId"));
                    break;
                case "get-file":
                    sendFile(ws, requestId, msg.getString("mediaId"));
                    break;
                default:
                    break;
            }
        } catch (Exception e) {
            // Malformed/unexpected command — ignore rather than crash the socket.
        }
    }

    // ---- Folder + media listing (MediaStore buckets stand in for "folders",
    // since scoped storage doesn't allow arbitrary filesystem browsing) ----

    private void sendFolders(WebSocket ws, String requestId) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        countBuckets(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, MediaStore.Images.Media.BUCKET_DISPLAY_NAME, counts);
        countBuckets(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, MediaStore.Video.Media.BUCKET_DISPLAY_NAME, counts);

        JSONArray folders = new JSONArray();
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            JSONObject f = new JSONObject();
            try {
                f.put("bucket", e.getKey());
                f.put("count", e.getValue());
            } catch (Exception ignored) {}
            folders.put(f);
        }

        JSONObject result = new JSONObject();
        try {
            result.put("type", "folders");
            result.put("requestId", requestId);
            result.put("folders", folders);
        } catch (Exception ignored) {}
        ws.send(result.toString());
    }

    private void countBuckets(Uri contentUri, String bucketColumn, Map<String, Integer> counts) {
        Cursor cursor = getContentResolver().query(contentUri, new String[]{ bucketColumn }, null, null, null);
        if (cursor == null) return;
        try {
            int col = cursor.getColumnIndexOrThrow(bucketColumn);
            while (cursor.moveToNext()) {
                String bucket = cursor.getString(col);
                if (bucket == null) bucket = "Other";
                // Not Map.merge() — that's a default method Android only
                // backs natively from API 24, and this project (minSdk 23)
                // doesn't have core library desugaring enabled.
                Integer existing = counts.get(bucket);
                counts.put(bucket, existing == null ? 1 : existing + 1);
            }
        } finally {
            cursor.close();
        }
    }

    private void sendMedia(WebSocket ws, String requestId, String bucket) {
        JSONArray items = new JSONArray();
        queryMediaInBucket(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, MediaStore.Images.Media.BUCKET_DISPLAY_NAME, "img", "image", bucket, items);
        queryMediaInBucket(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, MediaStore.Video.Media.BUCKET_DISPLAY_NAME, "vid", "video", bucket, items);

        JSONObject result = new JSONObject();
        try {
            result.put("type", "media");
            result.put("requestId", requestId);
            result.put("bucket", bucket);
            result.put("items", items);
        } catch (Exception ignored) {}
        ws.send(result.toString());
    }

    private void queryMediaInBucket(Uri contentUri, String bucketColumn, String idPrefix, String kind, String bucket, JSONArray out) {
        String[] projection = { MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.DATE_ADDED };
        Cursor cursor = getContentResolver().query(
            contentUri, projection, bucketColumn + " = ?", new String[]{ bucket },
            MediaStore.MediaColumns.DATE_ADDED + " DESC"
        );
        if (cursor == null) return;
        try {
            int idCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID);
            int nameCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME);
            int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE);
            int dateCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED);
            while (cursor.moveToNext()) {
                JSONObject item = new JSONObject();
                try {
                    item.put("id", idPrefix + ":" + cursor.getLong(idCol));
                    item.put("name", cursor.getString(nameCol));
                    item.put("size", cursor.getLong(sizeCol));
                    item.put("dateAdded", cursor.getLong(dateCol));
                    item.put("kind", kind);
                } catch (Exception ignored) {}
                out.put(item);
            }
        } finally {
            cursor.close();
        }
    }

    private Uri resolveContentUri(String mediaId, boolean[] isVideoOut) {
        String[] parts = mediaId.split(":", 2);
        if (parts.length != 2) return null;
        long id = Long.parseLong(parts[1]);
        boolean isVideo = "vid".equals(parts[0]);
        isVideoOut[0] = isVideo;
        return ContentUris.withAppendedId(
            isVideo ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id
        );
    }

    // ---- Thumbnails ----

    private void sendThumbnail(WebSocket ws, String requestId, String mediaId) {
        try {
            boolean[] isVideo = new boolean[1];
            Uri uri = resolveContentUri(mediaId, isVideo);
            if (uri == null) return;

            byte[] jpeg = isVideo[0] ? videoThumbnail(uri) : imageThumbnail(uri);
            if (jpeg == null) return;

            JSONObject result = new JSONObject();
            result.put("type", "thumbnail");
            result.put("requestId", requestId);
            result.put("mediaId", mediaId);
            result.put("dataBase64", android.util.Base64.encodeToString(jpeg, android.util.Base64.NO_WRAP));
            ws.send(result.toString());
        } catch (Exception e) {
            sendError(ws, requestId, "Thumbnail failed: " + e.getMessage());
        }
    }

    private byte[] imageThumbnail(Uri uri) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream boundsStream = getContentResolver().openInputStream(uri)) {
            if (boundsStream == null) return null;
            BitmapFactory.decodeStream(boundsStream, null, bounds);
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

        int sampleSize = 1;
        int longestEdge = Math.max(bounds.outWidth, bounds.outHeight);
        while (longestEdge / (sampleSize * 2) >= THUMB_MAX_DIMENSION) sampleSize *= 2;

        BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
        decodeOpts.inSampleSize = sampleSize;
        Bitmap sampled;
        try (InputStream decodeStream = getContentResolver().openInputStream(uri)) {
            if (decodeStream == null) return null;
            sampled = BitmapFactory.decodeStream(decodeStream, null, decodeOpts);
        }
        if (sampled == null) return null;

        return downscaleAndEncode(sampled);
    }

    private byte[] videoThumbnail(Uri uri) throws IOException {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(this, uri);
            Bitmap frame = retriever.getFrameAtTime(0);
            if (frame == null) return null;
            return downscaleAndEncode(frame);
        } finally {
            try { retriever.release(); } catch (Exception ignored) {}
        }
    }

    private byte[] downscaleAndEncode(Bitmap source) throws IOException {
        Bitmap scaled = source;
        int longest = Math.max(source.getWidth(), source.getHeight());
        if (longest > THUMB_MAX_DIMENSION) {
            float scale = THUMB_MAX_DIMENSION / (float) longest;
            int w = Math.round(source.getWidth() * scale);
            int h = Math.round(source.getHeight() * scale);
            scaled = Bitmap.createScaledBitmap(source, w, h, true);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        scaled.compress(Bitmap.CompressFormat.JPEG, THUMB_QUALITY, out);
        if (scaled != source) scaled.recycle();
        source.recycle();
        return out.toByteArray();
    }

    // ---- Full file download, chunked ----

    private void sendFile(WebSocket ws, String requestId, String mediaId) {
        boolean[] isVideo = new boolean[1];
        Uri uri = resolveContentUri(mediaId, isVideo);
        if (uri == null) {
            sendError(ws, requestId, "Unknown media id");
            return;
        }

        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) {
                sendError(ws, requestId, "File not found");
                return;
            }
            byte[] buf = new byte[FILE_CHUNK_SIZE];
            int seq = 0;
            int bytesRead;
            while ((bytesRead = in.read(buf)) != -1) {
                byte[] chunk = bytesRead == buf.length ? buf : java.util.Arrays.copyOf(buf, bytesRead);
                sendChunk(ws, requestId, mediaId, seq++, chunk, false);
            }
            // A separate empty final message keeps the loop above simple —
            // the admin side just needs to treat a zero-length chunk as a
            // no-op append before finishing on `done`.
            sendChunk(ws, requestId, mediaId, seq, new byte[0], true);
        } catch (Exception e) {
            sendError(ws, requestId, "Download failed: " + e.getMessage());
        }
    }

    private void sendChunk(WebSocket ws, String requestId, String mediaId, int seq, byte[] data, boolean done) {
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "file-chunk");
            msg.put("requestId", requestId);
            msg.put("mediaId", mediaId);
            msg.put("seq", seq);
            msg.put("dataBase64", android.util.Base64.encodeToString(data, android.util.Base64.NO_WRAP));
            msg.put("done", done);
            ws.send(msg.toString());
        } catch (Exception ignored) {}
    }

    private void sendError(WebSocket ws, String requestId, String message) {
        try {
            JSONObject err = new JSONObject();
            err.put("type", "error");
            err.put("requestId", requestId);
            err.put("message", message);
            ws.send(err.toString());
        } catch (Exception ignored) {}
    }

    private Notification buildNotification() {
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
            .setContentText("App is working in the background")
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
}
