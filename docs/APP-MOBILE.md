# App mobile UltraRide (iOS / Android)

L'app est le site React emballé avec **Capacitor 8** (`ios/`, `android/`,
`capacitor.config.json`). Identifiant : `eu.ultraride.app`.
Sur le site (navigateur), tout le code natif est ignoré (`src/lib/native.js`).

## Fonctions natives

| Fonction | Code | Côté serveur |
| --- | --- | --- |
| Géolocalisation (« Près de toi », carte) | `src/lib/geo.js` | — |
| Suppression de compte complète | `DangerZone` dans `src/pages/Account.jsx` | RPC `delete_my_account()` |
| Notifications « Nouvel ultra » | `src/lib/push.js`, `src/mobile/NotificationSettings.jsx` | trigger `push_new_race` → `push_queue` → Edge Function `send-push` |
| Notifications « Des ultras sont à jour » | idem | trigger `push_race_update` (suggestion validée) → `push_queue` → `send-push` |

Les notifications passent par des *topics* Firebase (`nouveaux-ultras`,
`mises-a-jour`) : aucun jeton n'est stocké en base. `send-push` tourne toutes
les 15 min (pg_cron `send-push-notifications`) et n'envoie une vague que
lorsqu'aucune nouvelle ligne n'est arrivée depuis 10 min : valider 15 fiches
d'affilée = **une** notification. Historique : table `push_notifications`.

## Mise en place (une fois)

1. **SQL** : coller `supabase/migrations/20261030_app_mobile.sql` dans le SQL Editor.
2. **Firebase** (console.firebase.google.com, compte Beyond The Track) :
   - projet « UltraRide » créé : `ultraride-8e408` (apps Android et iOS enregistrées, fichiers de config dans le dépôt) ;
   - ajouter une app Android `eu.ultraride.app` → télécharger `google-services.json` → `android/app/` ;
   - ajouter une app iOS `eu.ultraride.app` → télécharger `GoogleService-Info.plist` → `ios/App/App/` (à ajouter aussi dans Xcode, cible App) ;
   - Paramètres du projet → Cloud Messaging → importer la **clé APNs** (.p8) créée dans Apple Developer → Keys (case « Apple Push Notifications service ») ;
   - Paramètres du projet → Comptes de service → « Générer une nouvelle clé privée » (fichier JSON).
3. **Supabase → Edge Functions** :
   - secret `FCM_SERVICE_ACCOUNT` = contenu complet du JSON ci-dessus ;
   - créer la fonction `send-push` avec `supabase/functions/send-push/index.ts`, **Verify JWT désactivé**.
4. **Xcode** (cible App → Signing & Capabilities) : vérifier que *Push Notifications* et *Background Modes → Remote notifications* apparaissent (fichier `App.entitlements` déjà présent).

## Construire l'app

```
npm install
npm run build
npx cap sync
npx cap open ios       # ou: npx cap open android
```
