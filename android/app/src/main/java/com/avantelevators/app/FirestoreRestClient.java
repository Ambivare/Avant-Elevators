package com.avantelevators.app;

import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Minimal Firestore REST + Identity Toolkit client for native background code
 * that has no WebView/JS bridge to piggyback on (SiteMediaSyncForegroundService
 * runs even when the app is fully closed). Uses the same public Firebase Web
 * API key the app's own JS firebase config uses, and a fresh anonymous
 * sign-in each run — Firestore rules here only check isAuthed(), so any
 * anonymous session is sufficient, same as the app's own login flow.
 */
final class FirestoreRestClient {
    private static final String API_KEY = "AIzaSyB5kH6d8eDFOP8ZpOHoCFa-VL3KUDrrzrk";
    private static final String PROJECT_ID = "avant-elevators";
    private static final String FIRESTORE_BASE =
        "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/";

    String signInAnonymously() throws IOException {
        URL url = new URL("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + API_KEY);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        try (OutputStream os = conn.getOutputStream()) {
            os.write("{\"returnSecureToken\":true}".getBytes(StandardCharsets.UTF_8));
        }
        String body = HttpUtil.readBody(conn);
        try {
            return new JSONObject(body).getString("idToken");
        } catch (Exception e) {
            throw new IOException("Anonymous sign-in failed: " + body);
        }
    }

    /** Overwrites the document at documentPath (e.g. "syncProgress/abc123") with exactly these fields. */
    void setDocument(String idToken, String documentPath, JSONObject fields) throws IOException {
        URL url = new URL(FIRESTORE_BASE + documentPath);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        // java.net.HttpURLConnection rejects "PATCH" outright (ProtocolException —
        // it's not in its hardcoded verb allowlist, on both Android and the JDK).
        // Google APIs, Firestore's REST API included, accept a POST with this
        // override header as the documented workaround.
        conn.setRequestMethod("POST");
        conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Authorization", "Bearer " + idToken);
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        writeFields(conn, fields);
        int code = conn.getResponseCode();
        HttpUtil.readBody(conn);
        if (code < 200 || code >= 300) throw new IOException("Firestore setDocument failed: HTTP " + code);
    }

    /** Creates a new auto-ID document in the given collection (e.g. "siteMedia"). */
    void createDocument(String idToken, String collectionPath, JSONObject fields) throws IOException {
        URL url = new URL(FIRESTORE_BASE + collectionPath);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Authorization", "Bearer " + idToken);
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        writeFields(conn, fields);
        int code = conn.getResponseCode();
        HttpUtil.readBody(conn);
        if (code < 200 || code >= 300) throw new IOException("Firestore createDocument failed: HTTP " + code);
    }

    private void writeFields(HttpURLConnection conn, JSONObject fields) throws IOException {
        JSONObject body = new JSONObject();
        try { body.put("fields", fields); } catch (Exception ignored) {}
        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
    }

    static JSONObject strVal(String s) {
        JSONObject v = new JSONObject();
        try { v.put("stringValue", s == null ? "" : s); } catch (Exception ignored) {}
        return v;
    }

    static JSONObject intVal(long n) {
        JSONObject v = new JSONObject();
        try { v.put("integerValue", String.valueOf(n)); } catch (Exception ignored) {}
        return v;
    }

    static JSONObject nowTimestampVal() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        JSONObject v = new JSONObject();
        try { v.put("timestampValue", fmt.format(new Date())); } catch (Exception ignored) {}
        return v;
    }
}
