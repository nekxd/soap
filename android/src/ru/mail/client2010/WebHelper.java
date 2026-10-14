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

        WebSettings settings = webView.getSettings();
        if (settings == null) return;

        // Core settings available in Android 1.0+
        settings.setJavaScriptEnabled(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setAllowFileAccess(true);

        // Safe call for setPluginsEnabled (API 8)
        invokeBooleanMethod(settings, "setPluginsEnabled", true);

        // Safe call for setDomStorageEnabled (API 7+)
        invokeBooleanMethod(settings, "setDomStorageEnabled", true);

        // Safe call for setDatabaseEnabled (API 5+)
        invokeBooleanMethod(settings, "setDatabaseEnabled", true);

        // Safe call for setDatabasePath (API 5+)
        try {
            String dbPath = context.getApplicationContext().getDir("databases", Context.MODE_PRIVATE).getPath();
            Method setDbPathMethod = settings.getClass().getMethod("setDatabasePath", String.class);
            setDbPathMethod.invoke(settings, dbPath);
        } catch (Throwable ignored) {}

        // Safe call for setAppCacheEnabled and setAppCachePath (API 7+)
        invokeBooleanMethod(settings, "setAppCacheEnabled", true);
        try {
            String cachePath = context.getApplicationContext().getCacheDir().getAbsolutePath();
            Method setCachePathMethod = settings.getClass().getMethod("setAppCachePath", String.class);
            setCachePathMethod.invoke(settings, cachePath);
        } catch (Throwable ignored) {}

        // Safe call for setLoadWithOverviewMode (API 7+)
        invokeBooleanMethod(settings, "setLoadWithOverviewMode", true);

        // Safe call for setUseWideViewPort (API 3+)
        invokeBooleanMethod(settings, "setUseWideViewPort", true);

        // Safe call for setDisplayZoomControls (API 11+)
        invokeBooleanMethod(settings, "setDisplayZoomControls", false);

        // Safe call for setMixedContentMode (API 21+)
        try {
            Method setMixedMode = settings.getClass().getMethod("setMixedContentMode", int.class);
            // 0 = MIXED_CONTENT_ALWAYS_ALLOW
            setMixedMode.invoke(settings, 0);
        } catch (Throwable ignored) {}
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
