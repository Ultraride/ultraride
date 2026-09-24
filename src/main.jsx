import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./lib/AuthContext.jsx";
// Polices et CSS Leaflet servis par le site : aucun appel à Google Fonts ni
// à un CDN. Graisses = celles réellement rendues avant la migration (Mono
// n'était chargée qu'en 500/600, le texte Mono « normal » s'affichait en 500).
import "@fontsource/anton/400.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "leaflet/dist/leaflet.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
