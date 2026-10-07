import { Link } from "react-router-dom";

export default function Cookies() {
  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 640 }}>
      <h1 className="h1">Politique de cookies</h1>
      <div className="prose" style={{ color: "var(--paperDim)", lineHeight: 1.7, fontSize: 14 }}>
        <p>UltraRide utilise un nombre limité de cookies et technologies similaires, strictement nécessaires au fonctionnement du site :</p>
        <ul>
          <li><strong>Session de connexion</strong> (fourni par Supabase, notre hébergeur de compte) : permet de te garder connecté entre deux visites.</li>
          <li><strong>Préférences d'affichage</strong> : mémorisation de choix simples liés à l'interface, dont ton choix concernant les cookies de mesure d'audience.</li>
        </ul>
        <p>Avec ton accord uniquement, UltraRide dépose aussi les cookies de mesure d'audience de Google Analytics 4 (<code>_ga</code>, <code>_ga_*</code>). Ils ne sont déposés qu'après un clic sur « Accepter » dans le bandeau, et tu peux retirer ton accord à tout moment via « Gérer les cookies ». Le détail figure dans la <Link to="/confidentialite#7-cookies-et-stockage-local">politique de confidentialité</Link>.</p>
        <p>Nous n'utilisons aucun cookie publicitaire ni traceur de suivi tiers à des fins marketing.</p>
        <p>Tu peux à tout moment supprimer les cookies déposés via les réglages de ton navigateur ; la déconnexion supprime le cookie de session.</p>
        <p className="muted" style={{ fontSize: 12 }}>
          Cette page décrit les cookies utilisés par le site à ce jour et sera mise à jour si de nouveaux usages sont ajoutés.
        </p>
      </div>
    </div>
  );
}
