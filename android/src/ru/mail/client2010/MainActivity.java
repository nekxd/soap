package ru.mail.client2010;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.webkit.CookieSyncManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity implements View.OnClickListener {

    private WebView mWebView;
    private TextView mHeaderTitle;
    private Button mBtnBack;
    private Button mBtnForward;
    private Button mBtnRefresh;
    private Button mBtnMode;
    private ProgressBar mProgressBar;
    private View mErrorLayout;
    private Button mBtnRetry;

    private boolean mIsDesktopMode = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Initialize UI components
        mHeaderTitle = (TextView) findViewById(R.id.header_title);
        mBtnBack = (Button) findViewById(R.id.btn_back);
        mBtnForward = (Button) findViewById(R.id.btn_forward);
        mBtnRefresh = (Button) findViewById(R.id.btn_refresh);
        mBtnMode = (Button) findViewById(R.id.btn_mode);
        mProgressBar = (ProgressBar) findViewById(R.id.progress_bar);
        mErrorLayout = findViewById(R.id.error_layout);
        mBtnRetry = (Button) findViewById(R.id.btn_retry);
        mWebView = (WebView) findViewById(R.id.webview);

        mBtnBack.setOnClickListener(this);
        mBtnForward.setOnClickListener(this);
        mBtnRefresh.setOnClickListener(this);
        mBtnMode.setOnClickListener(this);
        mBtnRetry.setOnClickListener(this);

        // CookieSyncManager initialization for legacy Android
        try {
            CookieSyncManager.createInstance(this);
        } catch (Throwable ignored) {}

        // Configure WebView
        WebHelper.configureSettings(this, mWebView);

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (mProgressBar != null) {
                    if (newProgress < 100) {
                        mProgressBar.setVisibility(View.VISIBLE);
                        mProgressBar.setProgress(newProgress);
                    } else {
                        mProgressBar.setVisibility(View.GONE);
                    }
                }
            }

            @Override
            public void onReceivedTitle(WebView view, String title) {
                if (mHeaderTitle != null && title != null && title.length() > 0) {
                    mHeaderTitle.setText(title);
                }
            }
        });

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null) return false;

                // Handle external application protocols
                if (url.startsWith("tel:") || url.startsWith("mailto:")
                        || url.startsWith("sms:") || url.startsWith("market:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Throwable e) {
                        return false;
                    }
                }

                // Handle internal web navigation
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                // Allows legacy Android 1.6-2.3 devices to connect to HTTPS endpoints
                // despite having outdated system root certificate stores
                if (handler != null) {
                    handler.proceed();
                }
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (mProgressBar != null) {
                    mProgressBar.setVisibility(View.VISIBLE);
                }
                if (mErrorLayout != null) {
                    mErrorLayout.setVisibility(View.GONE);
                }
                updateModeButton(url);
                updateNavButtons();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (mProgressBar != null) {
                    mProgressBar.setVisibility(View.GONE);
                }
                updateModeButton(url);
                updateNavButtons();

                try {
                    CookieSyncManager.getInstance().sync();
                } catch (Throwable ignored) {}
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (mErrorLayout != null) {
                    mErrorLayout.setVisibility(View.VISIBLE);
                }
            }
        });

        // Restore or load start page
        if (savedInstanceState != null) {
            mWebView.restoreState(savedInstanceState);
        } else {
            mWebView.loadUrl(Constants.URL_MOBILE);
        }
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();
        if (id == R.id.btn_back) {
            if (mWebView != null && mWebView.canGoBack()) {
                mWebView.goBack();
            }
        } else if (id == R.id.btn_forward) {
            if (mWebView != null && mWebView.canGoForward()) {
                mWebView.goForward();
            }
        } else if (id == R.id.btn_refresh) {
            if (mWebView != null) {
                mWebView.reload();
            }
        } else if (id == R.id.btn_mode) {
            toggleVersion();
        } else if (id == R.id.btn_retry) {
            if (mErrorLayout != null) {
                mErrorLayout.setVisibility(View.GONE);
            }
            if (mWebView != null) {
                mWebView.reload();
            }
        }
    }

    private void toggleVersion() {
        if (mWebView == null) return;
        String curUrl = mWebView.getUrl();
        if (curUrl == null || curUrl.indexOf("index.html") != -1) {
            // Switch to mobile version
            mIsDesktopMode = false;
            mWebView.loadUrl(Constants.URL_MOBILE);
        } else {
            // Switch to desktop full version
            mIsDesktopMode = true;
            mWebView.loadUrl(Constants.URL_DESKTOP);
        }
    }

    private void updateModeButton(String url) {
        if (mBtnMode == null) return;
        if (url != null && url.indexOf("index.html") != -1) {
            mIsDesktopMode = true;
            mBtnMode.setText("Моб");
        } else {
            mIsDesktopMode = false;
            mBtnMode.setText("ПК");
        }
    }

    private void updateNavButtons() {
        if (mBtnBack != null && mWebView != null) {
            mBtnBack.setEnabled(mWebView.canGoBack());
        }
        if (mBtnForward != null && mWebView != null) {
            mBtnForward.setEnabled(mWebView.canGoForward());
        }
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        MenuInflater inflater = getMenuInflater();
        inflater.inflate(R.menu.main_menu, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.menu_home) {
            if (mWebView != null) mWebView.loadUrl(Constants.URL_MOBILE);
            return true;
        } else if (id == R.id.menu_toggle_version) {
            toggleVersion();
            return true;
        } else if (id == R.id.menu_mail) {
            if (mWebView != null) mWebView.loadUrl(Constants.URL_MAIL);
            return true;
        } else if (id == R.id.menu_search) {
            if (mWebView != null) mWebView.loadUrl(Constants.URL_SEARCH);
            return true;
        } else if (id == R.id.menu_refresh) {
            if (mWebView != null) mWebView.reload();
            return true;
        } else if (id == R.id.menu_about) {
            showAboutDialog();
            return true;
        } else if (id == R.id.menu_exit) {
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void showAboutDialog() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.title_about)
                .setMessage(R.string.about_text)
                .setIcon(R.drawable.ic_launcher)
                .setPositiveButton(R.string.dialog_ok, new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int which) {
                        dialog.dismiss();
                    }
                })
                .show();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Universal Back button handling for Android 1.6+
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (mWebView != null && mWebView.canGoBack()) {
                mWebView.goBack();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onBackPressed() {
        if (mWebView != null && mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (mWebView != null) {
            mWebView.saveState(outState);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        try {
            CookieSyncManager.getInstance().startSync();
        } catch (Throwable ignored) {}
    }

    @Override
    protected void onPause() {
        super.onPause();
        try {
            CookieSyncManager.getInstance().stopSync();
        } catch (Throwable ignored) {}
    }

    @Override
    protected void onDestroy() {
        if (mWebView != null) {
            mWebView.stopLoading();
            mWebView.destroy();
        }
        super.onDestroy();
    }
}
