package com.avantelevators.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(CallLogSyncPlugin.class);
        registerPlugin(MediaAccessPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
