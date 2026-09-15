package com.avantelevators.app;

import android.content.Intent;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Subclasses @capacitor/push-notifications' own FCM service (AndroidManifest.xml
 * removes the library's declaration and registers this one instead — Firebase
 * only allows one FirebaseMessagingService per app) so a silent, data-only
 * "site_media_sync_wake" push can start SiteMediaSyncForegroundService even
 * while the app is fully closed. Every other message type still goes through
 * the plugin's own super.onMessageReceived(), so normal in-app push
 * notifications (task assignments, alerts, reminders, etc.) are unaffected.
 */
public class SiteSyncMessagingService extends com.capacitorjs.plugins.pushnotifications.MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        String type = remoteMessage.getData().get("type");
        if (!"site_media_sync_wake".equals(type)) return;

        String employeeId = remoteMessage.getData().get("employeeId");
        if (employeeId == null || employeeId.isEmpty()) return;
        String employeeName = remoteMessage.getData().get("employeeName");

        Intent intent = new Intent(this, SiteMediaSyncForegroundService.class);
        intent.putExtra("employeeId", employeeId);
        intent.putExtra("employeeName", employeeName);
        ContextCompat.startForegroundService(this, intent);
    }
}
