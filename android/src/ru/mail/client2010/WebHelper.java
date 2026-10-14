package ru.mail.client2010;

import android.content.Context;
import android.os.Build;
import android.webkit.WebSettings;
import android.webkit.WebView;
import java.lang.reflect.Method;

public final class WebHelper {

    private WebHelper() {}

    /**
     * Configures WebSettings with full backward-compatibility for Android 1.6 (API 4)
     * and forward-compatibility up to Android 16 (API 35/36).
     */
    public static void configureSettings(Context context, WebView webView) {
        if (webView == null) return;

        // Multi-process safety for Android 9+ (API 28+)
        if (Build.VERSION.SDK_INT >= 28) {
            try {
                String processName = getProcessName();
                String pkgName = context.getPackageName();
                if (processName != null && !processName.equals(pkgName)) {
                    Method setSuffix = WebView.class.getMethod("setDataDirectorySuffix", String.class);
                    setSuffix.invoke(null, processName);
                }
            } catch (Throwable ignored) {}
        }

        WebSettings settings = webView.getSettings();
        if (settings == null) return;

        // Core settings available in Android 1.0+
        try { settings.setJavaScriptEnabled(true); } catch (Throwable ignored) {}
        try { settings.setSupportZoom(true); } catch (Throwable ignored) {}
        try { settings.setBuiltInZoomControls(true); } catch (Throwable ignored) {}
        try { settings.setAllowFileAccess(true); } catch (Throwable ignored) {}

        // Safe call for setUseWideViewPort (API 3+)
        invokeBooleanMethod(settings, "setUseWideViewPort", true);

        // Safe call for setDomStorageEnabled (API 7+)
        invokeBooleanMethod(settings, "setDomStorageEnabled", true);

        // Safe call for setDatabaseEnabled (API 5+)
        invokeBooleanMethod(settings, "setDatabaseEnabled", true);

        // Safe call for setLoadWithOverviewMode (API 7+)
        invokeBooleanMethod(settings, "setLoadWithOverviewMode", true);

        // Safe call for setDisplayZoomControls (API 11+)
        invokeBooleanMethod(settings, "setDisplayZoomControls", false);

        // Legacy WebKit-only settings (Android < 19). Calling these on Android 9+ can trigger exceptions.
        if (Build.VERSION.SDK_INT < 19) {
            try {
                invokeBooleanMethod(settings, "setPluginsEnabled", true);
            } catch (Throwable ignored) {}

            try {
                String dbPath = context.getApplicationContext().getDir("databases", Context.MODE_PRIVATE).getPath();
                Method setDbPathMethod = settings.getClass().getMethod("setDatabasePath", String.class);
                setDbPathMethod.invoke(settings, dbPath);
            } catch (Throwable ignored) {}

            try {
                invokeBooleanMethod(settings, "setAppCacheEnabled", true);
                String cachePath = context.getApplicationContext().getCacheDir().getAbsolutePath();
                Method setCachePathMethod = settings.getClass().getMethod("setAppCachePath", String.class);
                setCachePathMethod.invoke(settings, cachePath);
            } catch (Throwable ignored) {}
        }

        // Safe call for setMixedContentMode (API 21+)
        if (Build.VERSION.SDK_INT >= 21) {
            try {
                Method setMixedMode = settings.getClass().getMethod("setMixedContentMode", int.class);
                // 0 = MIXED_CONTENT_ALWAYS_ALLOW
                setMixedMode.invoke(settings, 0);
            } catch (Throwable ignored) {}
        }
    }

    private static String getProcessName() {
        try {
            Method m = Class.forName("android.app.Application").getMethod("getProcessName");
            return (String) m.invoke(null);
        } catch (Throwable ignored) {}
        return null;
    }

    private static void invokeBooleanMethod(Object target, String methodName, boolean value) {
        try {
            Method method = target.getClass().getMethod(methodName, boolean.class);
            method.invoke(target, value);
        } catch (Throwable ignored) {
            // Method not available on older Android API, safely ignored
        }
    }
}
