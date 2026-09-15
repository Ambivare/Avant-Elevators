package com.avantelevators.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;

final class HttpUtil {
    private HttpUtil() {}

    /** Reads the response (or error) body of a finished request as a UTF-8 string. */
    static String readBody(HttpURLConnection conn) throws IOException {
        InputStream is;
        try {
            is = conn.getInputStream();
        } catch (IOException e) {
            is = conn.getErrorStream();
        }
        if (is == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        try {
            while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
        } finally {
            is.close();
        }
        return out.toString("UTF-8");
    }
}
