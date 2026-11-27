package io.drewclark.ascendavoid;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

public class LauncherActivity extends Activity {
    private WebView game;
    private AlertDialog connectionError;
    private OnBackInvokedCallback historyBack;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        game = new WebView(this);
        game.setBackgroundColor(Color.rgb(0, 27, 52));
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setUseWideViewPort(true);
        game.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!request.isForMainFrame() || isGameUrl(uri)) return false;
                if ("https".equals(uri.getScheme()) && request.hasGesture()) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException ignored) {
                        // Devices without another browser stay in the game.
                    }
                }
                return true;
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean reload) {
                updateHistoryBack();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame() || isFinishing() || connectionError != null) return;
                connectionError = new AlertDialog.Builder(LauncherActivity.this)
                        .setMessage(R.string.connection_error)
                        .setPositiveButton(R.string.retry, (dialog, which) -> view.reload())
                        .setNegativeButton(android.R.string.cancel, (dialog, which) -> finish())
                        .setCancelable(false).create();
                connectionError.setOnDismissListener(dialog -> connectionError = null);
                connectionError.show();
            }
        });
        setContentView(game);
        enterImmersiveMode();
        if (state == null || game.restoreState(state) == null) {
            Uri url = getIntent().getData();
            game.loadUrl(isGameUrl(url) ? url.toString() : getString(R.string.launchUrl));
        }
    }

    private boolean isGameUrl(Uri uri) {
        if (uri == null || !"https".equals(uri.getScheme())) return false;
        String origin = "https://" + uri.getEncodedAuthority();
        if (origin.equals("https://" + getString(R.string.hostName))) return true;
        for (String trusted : getResources().getStringArray(R.array.additional_trusted_origins)) {
            if (trusted.equals(origin)) return true;
        }
        return false;
    }

    private void enterImmersiveMode() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsets.Type.systemBars());
            }
        } else {
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) enterImmersiveMode();
    }

    private void updateHistoryBack() {
        if (Build.VERSION.SDK_INT < 33) return;
        if (game.canGoBack() && historyBack == null) {
            historyBack = game::goBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, historyBack);
        } else if (!game.canGoBack() && historyBack != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(historyBack);
            historyBack = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (game.canGoBack()) game.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        game.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        game.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        game.saveState(state);
    }

    @Override
    protected void onDestroy() {
        if (connectionError != null) connectionError.dismiss();
        if (Build.VERSION.SDK_INT >= 33 && historyBack != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(historyBack);
        }
        ((android.view.ViewGroup) game.getParent()).removeView(game);
        game.destroy();
        super.onDestroy();
    }
}
