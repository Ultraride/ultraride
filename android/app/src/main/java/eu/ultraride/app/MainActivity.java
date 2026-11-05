package eu.ultraride.app;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Téléphones : portrait uniquement. Tablettes (≥ 600 dp) : rotation libre.
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
        super.onCreate(savedInstanceState);
        // Désactive l'effet d'étirement en haut/bas de page
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
