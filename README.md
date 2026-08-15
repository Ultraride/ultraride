# UltraRide

Répertoire de courses et aventures ultra-distance à vélo, avec espace admin, connecté à Supabase.

## Démarrage local

```bash
npm install
npm run dev
```

Le fichier `.env` est déjà rempli avec les clés du projet Supabase `ultraride`
(URL + clé publique **anon** — sûre à exposer côté client, la sécurité est
assurée par les policies RLS côté base, pas par le secret de cette clé).
Si tu repars d'un clone propre, copie `.env.example` vers `.env` et renseigne
les valeurs depuis le dashboard Supabase → Project Settings → API.

## Devenir administrateur

Aucun compte admin n'existe encore par défaut (pour éviter d'en coder un en
dur). Pour te promouvoir la première fois :

1. Lance l'app, va sur **Connexion**, entre ton email → tu reçois un lien magique.
2. Clique sur le lien : ton compte est créé automatiquement avec le rôle `participant`.
3. Dans le dashboard Supabase → SQL Editor, exécute :
   ```sql
   update public.profiles set role = 'admin' where email = 'ton@email.fr';
   ```
4. Recharge l'app — l'onglet **Admin** apparaît dans le header.

Une fois qu'un premier admin existe, il peut promouvoir les suivants
directement depuis l'écran **Admin → Utilisateurs**.

## Logique des trois rôles

- **Participant** : navigue et lit librement, sans compte. Laisser un avis
  envoie un lien de connexion par email ; le compte est créé automatiquement
  à la confirmation (déclencheur SQL sur `auth.users`).
- **Organisateur** : peut créer une course, mais elle est forcée en statut
  `pending` côté serveur (impossible à contourner depuis le client). Ne peut
  modifier que ses propres courses tant qu'elles ne sont pas publiées.
- **Administrateur** : crée des courses publiées directement, modifie/supprime
  n'importe quelle course, valide ou refuse les soumissions, modère les
  commentaires (masquer ou supprimer), gère les rôles et retire des comptes.

Toute cette logique est appliquée par des policies **Row Level Security** et
des triggers PostgreSQL sur le projet Supabase — pas seulement par
l'interface, donc impossible à contourner en trafiquant les requêtes.

## Déployer sur GitHub

Ce dossier est déjà un dépôt git avec un premier commit. Pour le pousser :

```bash
git remote add origin https://github.com/<ton-compte>/ultraride.git
git branch -M main
git push -u origin main
```

Ensuite, pour un hébergement (Vercel, Netlify, Cloudflare Pages…), connecte
le repo GitHub et ajoute les deux variables d'environnement `VITE_SUPABASE_URL`
et `VITE_SUPABASE_ANON_KEY` dans les réglages du projet d'hébergement.

## Stack

- React + Vite (pas de framework meta, SPA simple)
- React Router pour la navigation
- Supabase (Postgres + Auth + RLS) comme backend
- Leaflet + tuiles OpenStreetMap pour les cartes
- CSS simple (pas de Tailwind), tokens de design dans `src/index.css`
