package eu.ultraride.app;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Désactive l'effet d'étirement en haut/bas de page
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
