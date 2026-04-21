# Kartiki - MVP

Système hybride entre covoiturage et bus pour Tahiti : une route principale, des points d'arrêt informels, tout temps réel.

Repo monorepo contenant :

- **[backend/](./backend)** : API NestJS (REST + Socket.IO) + PostgreSQL/PostGIS.
- **[frontend/](./frontend)** : PWA Nuxt 4 + PrimeVue + Mapbox GL.

## Prérequis

- Node.js 20+ (testé avec v24)
- pnpm 9+ (`corepack enable` ou `npm i -g pnpm`)
- PostgreSQL 14+ avec l'extension PostGIS **ou** Docker pour utiliser `docker-compose.yml`
- Un token d'accès [Mapbox](https://account.mapbox.com/access-tokens/) (gratuit jusqu'à 50k chargements de carte/mois)

## Démarrage rapide

### 1. Base de données (option A : Docker)

```bash
docker compose up -d db
```

### 1. Base de données (option B : PostgreSQL local)

```bash
sudo -u postgres psql <<'SQL'
CREATE USER kartiki WITH PASSWORD 'kartiki';
CREATE DATABASE kartiki OWNER kartiki;
\c kartiki
CREATE EXTENSION IF NOT EXISTS postgis;
GRANT ALL ON SCHEMA public TO kartiki;
SQL
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# éditer .env avec vos valeurs (notamment MAPBOX_TOKEN et JWT_SECRET)
pnpm install
pnpm run migration:run
pnpm run start:dev
# API sur http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# éditer .env avec NUXT_PUBLIC_MAPBOX_TOKEN
pnpm install
pnpm run dev
# App sur http://localhost:3000
```

## Architecture en bref

```
Passager / Conducteur (smartphone PWA)
        │  HTTPS + WSS (JWT)
        ▼
   ┌────────────────────────────────┐
   │  NestJS                        │
   │  - Auth / Users / Vehicles     │
   │  - Realtime Gateway (Socket.IO)│
   │  - Trips / QR / Wallet         │
   │  - MapboxService (Map Matching)│
   └────────────────────────────────┘
        │
        ▼
   PostgreSQL + PostGIS
```

Voir le [plan détaillé](.cursor/plans/) pour la conception complète.

## Parcours fonctionnel (MVP)

1. Le passager s'inscrit, ouvre l'app, sélectionne sa direction (ville ou campagne), se déclare en attente sur la route.
2. Le conducteur passe "en ligne" : sa position et direction sont diffusées.
3. Les deux se voient en temps réel sur la carte.
4. Le conducteur s'arrête ; le passager scanne le QR code affiché dans la voiture → début du trajet.
5. La position est loggée en continu pendant le trajet.
6. À l'arrivée, nouveau scan du QR → fin du trajet, la distance est calculée via Mapbox Map Matching, le tarif débité du wallet du passager et crédité sur celui du conducteur.

## Plan de test manuel (bout en bout)

1. Démarrer la DB (Docker ou PostgreSQL local avec PostGIS), `backend` (port 3001) et `frontend` (port 3000).
2. Ouvrir deux onglets/téléphones :
   - **A** : créer un compte (mail perso1, mdp 12345678). Tous les nouveaux comptes sont créés en `role = passenger`.
   - **B** : créer un compte, puis sur `/profile` cliquer « Devenir conducteur » → wizard 3 étapes (photo permis → photo véhicule 3/4 face → photo vignette d'assurance). À la création du 1ᵉʳ véhicule, le rôle bascule automatiquement en `both` (passager + conducteur). Pour ajouter un véhicule supplémentaire ensuite, le bouton « Ajouter un véhicule » lance un wizard 2 étapes (photo véhicule + vignette).
3. **Sur A (passager)** : aller sur `/map`, autoriser la géolocalisation, choisir une direction (ville/campagne), cliquer « Je suis en attente ».
4. **Sur B (conducteur)** : aller sur `/map`, même direction, cliquer « Je passe en ligne ». Un QR code rotatif s'affiche en bas.
5. Vérifier que les deux comptes se voient mutuellement sur la carte (un point rouge sur A, un point bleu sur B) si les positions sont à moins de 3 km.
6. **A scanne le QR de B** via `/scan`. Le trajet démarre, le passager arrive sur `/trip/[id]`.
7. Déplacer la position du passager (ou laisser le watchPosition faire son travail). Les points GPS sont enregistrés dans `trip_points`.
8. **A re-scan le QR de B** (de nouveau via `/scan`). Le trajet se termine, la distance est calculée via Mapbox Map Matching (fallback Haversine sans token), le fare débité sur le wallet de A et crédité sur celui de B.
9. Vérifier `/wallet` sur chaque compte : A a son solde réduit, B l'a augmenté. L'historique liste les deux transactions.
10. Tester installabilité PWA : DevTools → Application → Manifest, installer sur mobile Android (menu → « Installer l'application »).
11. Test offline : désactiver le réseau, naviguer dans l'app shell → les pages s'ouvrent ; les appels API échouent proprement avec un message d'erreur (pas de stale cache).

## Administration (back-office)

L'app expose un back-office complet sur `/admin/*` (frontend) et `/api/admin/*` (backend), accessible aux comptes ayant `role = admin`. Couvre : tableau de bord (KPIs + graphiques), utilisateurs (suspension / soft-delete / changement de rôle), wallets (ajustements manuels avec motif), trajets (liste filtrable, replay carte, annulation), véhicules, paramètres applicatifs (overlay DB sur les variables d'environnement) et journal d'audit immuable.

### Créer le premier admin

Aucun admin n'est créé par défaut (sécurité : impossible de s'auto-attribuer ce rôle via `/api/auth/signup`). Deux mécanismes au choix :

**A. Variables d'environnement (typique Docker, idempotent à chaque boot)**

Dans `.env` :

```bash
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=un-mot-de-passe-long-et-aleatoire
BOOTSTRAP_ADMIN_NAME=Administrator
```

Puis `docker compose up -d backend` (ou `pnpm run start:dev` en local). Au boot, le backend :

- Crée le compte si l'email n'existe pas (avec wallet à 0).
- Promeut le compte existant en `admin` (et lève d'éventuels `suspended_at` / `deleted_at`) sinon.
- Réinitialise le mot de passe **uniquement si** `BOOTSTRAP_ADMIN_PASSWORD` est non vide ET (compte nouveau OU password explicitement fourni).

**B. CLI (one-shot, idéal pour ne pas laisser le password en env)**

```bash
# en dev
cd backend
pnpm run admin:create -- --email admin@example.com --password 'longpwd' --name 'Admin'

# en prod (dans le conteneur)
docker compose exec backend node dist/scripts/create-admin.js \
  --email admin@example.com --password 'longpwd' --name 'Admin'
```

Le script désactive temporairement le bootstrap par env-var pendant son exécution pour éviter les conflits.

### Reset des données de test (`clean:test-data`)

Pendant la phase de test, pour repartir d'un état propre avant d'expérimenter le wizard d'onboarding conducteur :

```bash
# en dev (dry-run par défaut, affiche les volumes qui seraient supprimés)
cd backend
pnpm run clean:test-data

# en dev (effectif)
pnpm run clean:test-data -- --confirm

# en prod / docker
docker compose exec backend node dist/scripts/clean-test-data.js --confirm
```

Le script (transactionnel) effectue :

- `TRUNCATE trip_points, trips, certifications, vehicles RESTART IDENTITY CASCADE`
- `UPDATE users SET role='passenger' WHERE role IN ('driver','both')`

Les comptes admin et leurs wallets sont conservés. **À ne jamais lancer en production avec des données réelles.**

### Se connecter

Aller sur `/login`, saisir l'email et le mot de passe : la redirection post-login détecte le rôle `admin` et envoie sur `/admin`. Un middleware Nuxt (`app/middleware/admin.ts`) protège toutes les routes `/admin/*` et renvoie sur `/map` les utilisateurs non-admin.

Côté API, toutes les routes `/api/admin/*` sont protégées par `JwtAuthGuard` + `RolesGuard` ; le `RolesGuard` re-vérifie le rôle en base avec un cache de 30 secondes pour que les révocations / promotions soient prises en compte sans attendre l'expiration du JWT.

### Paramètres applicatifs (overlay DB)

Les pages `/admin/settings` permettent d'éditer à chaud sans redémarrage les valeurs suivantes (la table `app_settings` surcharge les variables d'environnement) :

| Clé | Variable d'env d'origine | Description |
|---|---|---|
| `app.fareBaseXpf` | `FARE_BASE_XPF` | Forfait fixe de prise en charge (XPF), 100 % gardé par la plateforme |
| `app.farePerKmXpf` | `FARE_PER_KM_XPF` | Tarif total au kilomètre facturé au passager (XPF) |
| `app.appMarginPerKmXpf` | `APP_MARGIN_PER_KM_XPF` | Marge par kilomètre conservée par la plateforme (XPF) ; le chauffeur perçoit `farePerKmXpf − appMarginPerKmXpf` par km |
| `app.initialWalletBalanceXpf` | `INITIAL_WALLET_BALANCE_XPF` | Solde initial des nouveaux comptes |
| `app.pickupMaxDistanceMeters` | `PICKUP_MAX_DISTANCE_METERS` | Distance max passager↔conducteur pour scanner le QR de prise en charge |
| `app.dropoffMinDelaySeconds` | `DROPOFF_MIN_DELAY_SECONDS` | Délai minimum entre prise en charge et dépose |
| `app.nearbyDriversRadiusMeters` | `NEARBY_DRIVERS_RADIUS_METERS` | Rayon de diffusion realtime des conducteurs proches |

Toute modification est tracée dans le journal d'audit (`/admin/audit`) avec l'auteur, l'ancienne et la nouvelle valeur.

### Audit log

Toutes les actions sensibles (changement de rôle, suspension, soft-delete, ajustement de wallet, annulation de trajet, suppression de véhicule, modification d'un paramètre) sont enregistrées dans `admin_actions` et consultables sur `/admin/audit` avec filtres par acteur et type d'action. La table est append-only — il n'existe pas d'endpoint API pour modifier ou supprimer une entrée.

## Certification des chauffeurs (permis + vignette d'assurance)

Pour pouvoir être marqué `is_certified = true` et apparaître activement comme conducteur, chaque chauffeur doit fournir :

1. Une photo de son **permis de conduire** (recto, lisible, nom identique à celui du profil).
2. Pour **chaque véhicule**, une photo de la **vignette d'assurance** (plaque + date de fin de validité visibles).

Les pages `/profile` (côté chauffeur) et `/admin/certifications` (côté admin) gèrent l'ensemble du cycle de vie : upload, OCR automatique (OpenAI Vision), revue manuelle si besoin, expiration et rappel à J-14.

### Architecture

| Couche | Détail |
|---|---|
| Stockage | Volume Docker `uploads` monté sur `/app/uploads` (`licenses/`, `insurance/`, `avatars/`). En dev, dossier `backend/uploads/` (créé automatiquement). |
| API | `POST /api/certifications/license`, `POST /api/certifications/vehicle/:id/insurance`, `GET /api/certifications/me`, plus l'admin sous `/api/admin/certifications`. |
| Servir les fichiers | `GET /api/uploads/<category>/<filename>` derrière `JwtAuthGuard` + contrôle de propriété (le chauffeur ne voit que ses pièces, l'admin voit tout, les avatars sont accessibles à tout utilisateur authentifié). |
| OCR | Provider injecté via le token DI `OCR_PROVIDER`. Implémentation par défaut : `OpenAiVisionOcrProvider` (`gpt-4o-mini`, prompt JSON structuré). Sans `OPENAI_API_KEY`, fallback `StubOcrProvider` qui force la revue manuelle. |
| Décision auto | Le service auto-approuve quand la similarité de nom (Levenshtein normalisé) ≥ `OCR_NAME_SIMILARITY_THRESHOLD`, la confiance OCR ≥ `OCR_MIN_CONFIDENCE`, et que la date de validité est dans le futur. Sinon : `pending_review`. |
| Revue manuelle | Page `/admin/certifications` : aperçu du document, données extraites, boutons Approuver / Rejeter (avec motif). Toute action est tracée dans le journal d'audit (`certification.approve` / `certification.reject`). |
| Rappel | Cron quotidien (`@nestjs/schedule`, 03:00) qui (1) flippe les certifs expirées en `expired` et décertifie le véhicule, (2) émet un événement Socket.IO `certification:expiring` aux chauffeurs dont une vignette expire dans ≤ 14 jours. Le frontend ouvre une popup avec dismissal `localStorage` (TTL 24 h) et raccourci de réupload. |

### Variables d'environnement

| Clé | Défaut | Description |
|---|---|---|
| `UPLOAD_DIR` | `/app/uploads` (Docker) ou `<cwd>/uploads` (dev) | Racine disque des fichiers uploadés |
| `OPENAI_API_KEY` | (vide) | Active l'OCR auto via OpenAI Vision. Vide → stub manuel |
| `OPENAI_VISION_MODEL` | `gpt-4o-mini` | Modèle OpenAI Vision utilisé |
| `OCR_NAME_SIMILARITY_THRESHOLD` | `0.85` | Similarité minimale entre nom OCR et nom du profil pour auto-approbation |
| `OCR_MIN_CONFIDENCE` | `0.8` | Confiance minimale (0..1) pour auto-approbation |

### Cycle de vie d'une certification

```
upload ──► pending_ocr ──┬─► approved   (OCR + thresholds OK + date future)
                         ├─► pending_review  (OCR ambigu ou date manquante)
                         ▲   │
                  admin approve / reject
                             │
                             ├─► approved    (admin force l'expiration)
                             └─► rejected    (motif obligatoire)

approved ──► expired (cron quotidien quand expires_at < today)
```

Les vignettes approuvées propagent immédiatement `vehicles.is_certified=true` et `vehicles.certified_until=<date>`. Le rejet d'une vignette précédemment approuvée décertifie aussitôt le véhicule.

### Backup des fichiers

Le volume `uploads` se sauvegarde comme la base :

```bash
docker run --rm \
  -v kartiki_uploads:/data \
  -v "$PWD":/backup \
  alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

(Le nom exact du volume dépend du nom du projet docker-compose : `docker volume ls | grep uploads`.)

## Déploiement Docker derrière Traefik

Architecture cible : **3 conteneurs** (`db`, `backend`, `frontend`) + un Traefik existant qui termine TLS et fait du virtual-hosting via deux sous-domaines :

```
                         ┌─ kartiki.aito-flow.com ──────── frontend (nginx, PWA statique)
Browser ──TLS──▶ Traefik ┤
                         └─ apikartiki.aito-flow.com ───── backend (NestJS, REST + Socket.IO)
                                                                  │
                                                          db (PostGIS, interne)
```

Aucun port n'est publié sur l'hôte par les conteneurs Kartiki : Traefik les joint via le réseau Docker `n8n_default`.

### Prérequis sur le serveur

- Docker + plugin `docker compose`.
- Un Traefik déjà en route avec un certresolver Let's Encrypt et le réseau Docker partagé (sur ce serveur : `n8n_default` + resolver `mytlschallenge`).
- Les **deux sous-domaines DNS** doivent pointer vers l'IP du serveur **avant** le premier `up` (sinon Traefik ne pourra pas obtenir les certificats Let's Encrypt) :
  - `kartiki.aito-flow.com` → IP serveur (record A/AAAA)
  - `apikartiki.aito-flow.com` → IP serveur (record A/AAAA)
- Un token public Mapbox (`pk.*`).

### 1. Copier le projet

Depuis votre machine locale :

```bash
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.nuxt' \
  --exclude '.output' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude '.env' \
  /var/www/app/ root@srv960811:/var/www/kartiki/
```

Le `--exclude '.env'` protège votre `.env` existant sur le serveur.

### 2. Configurer l'environnement

Sur le serveur, dans `/var/www/kartiki/` :

```bash
cp .env.example .env
nano .env
```

Valeurs **obligatoires** à renseigner :

| Variable | Valeur |
|---|---|
| `PUBLIC_DOMAIN` | `kartiki.aito-flow.com` |
| `PUBLIC_API_DOMAIN` | `apikartiki.aito-flow.com` |
| `DATABASE_PASSWORD` | mot de passe Postgres (long, aléatoire) |
| `JWT_SECRET` | secret long (`openssl rand -hex 48`) |
| `MAPBOX_TOKEN` | votre token Mapbox `pk.*` |
| `NUXT_PUBLIC_MAPBOX_TOKEN` | **le même token** que `MAPBOX_TOKEN` |

Variables Traefik (les valeurs par défaut correspondent déjà à votre setup `n8n_default` / `mytlschallenge` / `websecure` — à ne changer que si vous migrez vers une autre stack Traefik).

### 3. Build + run

```bash
cd /var/www/kartiki
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f backend   # suivre les migrations + boot
```

Au premier `up`, Traefik va déclencher le challenge ACME et obtenir 2 certificats (un par sous-domaine). Vérifier :

```bash
docker compose logs -f kartiki_backend  | grep -i listening
docker logs n8n-traefik-1 2>&1 | grep -iE 'kartiki|certificate'
```

### 4. Vérifier

```bash
# Frontend (sert la PWA)
curl -I https://kartiki.aito-flow.com

# Backend (santé)
curl https://apikartiki.aito-flow.com/health
# => {"ok":true,"ts":"..."}

# Test API d'inscription
curl -X POST https://apikartiki.aito-flow.com/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"12345678","role":"passenger"}'
```

Ensuite, dans un navigateur : `https://kartiki.aito-flow.com` → la PWA, installable depuis mobile (HTTPS valide grâce à Let's Encrypt).

### 5. Mises à jour

```bash
cd /var/www/kartiki
# (ou re-rsync depuis votre machine locale)
git pull
docker compose build
docker compose up -d
```

Note : `NUXT_PUBLIC_MAPBOX_TOKEN`, `PUBLIC_DOMAIN` et `PUBLIC_API_DOMAIN` sont **bakés dans le bundle JS au build**. Si vous changez l'un d'eux, il faut `docker compose build frontend && docker compose up -d frontend`.

### Architecture réseau

| Service  | Exposé Traefik via                  | Réseau interne Kartiki | Réseau Traefik |
|----------|-------------------------------------|------------------------|----------------|
| frontend | `kartiki.aito-flow.com` → :80       | `kartiki_net`          | `n8n_default`  |
| backend  | `apikartiki.aito-flow.com` → :3001  | `kartiki_net`          | `n8n_default`  |
| db       | (jamais exposée)                    | `kartiki_net`          | —              |

Le frontend appelle le backend en cross-origin via `https://apikartiki.aito-flow.com`. Le CORS est configuré côté backend pour n'accepter que `https://kartiki.aito-flow.com` (variable `CORS_ORIGIN` injectée automatiquement à partir de `PUBLIC_DOMAIN`). Le Socket.IO réfléchit l'origine (l'authentification JWT garantit la sécurité).

### Sauvegarde / restauration de la base

```bash
docker compose exec db pg_dump -U kartiki kartiki > backup-$(date +%F).sql
cat backup.sql | docker compose exec -T db psql -U kartiki kartiki
```

### Script de déploiement (`scripts/deploy.sh`)

À utiliser **sur le serveur**, depuis la racine du projet, pour automatiser le cycle `git pull` → rebuild → restart → health-check → tail logs.

```bash
# Tout reconstruire (backend + frontend)
./scripts/deploy.sh

# Seulement le backend ou seulement le frontend
./scripts/deploy.sh backend
./scripts/deploy.sh frontend

# Build complet sans cache (utile après changement de Dockerfile)
./scripts/deploy.sh frontend --no-cache

# Sans git pull (si déjà à jour)
./scripts/deploy.sh --no-pull

# Aide complète
./scripts/deploy.sh --help
```

Le script vérifie la présence de `docker-compose.yml` et `.env`, fait le `git pull --ff-only`, build, `up -d`, attend les health-checks, puis affiche les 30 dernières lignes de logs.

### Reset complet

```bash
docker compose down -v   # ⚠️ supprime aussi le volume de la DB
docker compose up -d --build
```

### Dépannage

```bash
# Voir les routers/services connus de Traefik
curl -s http://localhost:8080/api/http/routers 2>/dev/null | jq '.[] | select(.name|contains("kartiki"))'

# Logs en temps réel
docker compose logs -f

# Vérifier que le backend est bien dans le réseau Traefik
docker network inspect n8n_default | grep -A4 kartiki_backend
```

Si le certificat Let's Encrypt n'est pas émis :
- Vérifier que les DNS résolvent bien vers l'IP du serveur (`dig +short kartiki.aito-flow.com`)
- Vérifier que Traefik est joignable en HTTPS depuis Internet (pas de firewall qui bloque le challenge ACME)
- Lire les logs Traefik : `docker logs n8n-traefik-1 2>&1 | grep -iE 'kartiki|acme|error' | tail -50`

## Connexion Facebook (optionnelle)

L'app supporte un bouton « Continuer avec Facebook » sur les pages `/login` et `/register`. Le flux est entièrement côté client (SDK JS Facebook, popup OAuth) puis l'access_token est vérifié côté serveur via la Graph API avant d'émettre le JWT habituel.

Le bouton se cache automatiquement si `NUXT_PUBLIC_FACEBOOK_APP_ID` est vide — donc l'app fonctionne sans aucune configuration Facebook.

### Configurer une app Facebook (5 minutes)

1. Aller sur https://developers.facebook.com/apps/, créer une app de type **Consumer**.
2. Dans le menu gauche, ajouter le produit **Facebook Login → Web** (renseigner l'URL du site, ex. `http://localhost:3000` en dev, `https://kartiki.aito-flow.com` en prod).
3. Dans **App Settings → Basic**, ajouter les domaines dans **App Domains** : `localhost` (dev) puis votre domaine de prod.
4. Récupérer l'**App ID** et l'**App Secret** dans **App Settings → Basic**.
5. Renseigner les variables :

| Côté | Variable | Valeur |
|---|---|---|
| Backend | `FACEBOOK_APP_ID` | App ID |
| Backend | `FACEBOOK_APP_SECRET` | App Secret (ne JAMAIS exposer côté client) |
| Backend | `FACEBOOK_GRAPH_VERSION` | `v20.0` (par défaut) |
| Frontend | `NUXT_PUBLIC_FACEBOOK_APP_ID` | **Le même** App ID |

En Docker, les 4 vivent dans le `.env` racine. En dev local, mettre les 3 backend dans `backend/.env` et le frontend dans `frontend/.env`.

### Comportement

- **Compte existant avec le même email** : auto-link silencieux (le `facebook_id` est rattaché au compte existant). Facebook ayant déjà vérifié l'email, ce flow est sûr et évite la friction d'un mot de passe oublié.
- **Nouveau compte** : créé avec `password_hash = NULL`, role `passenger`, +10 000 XPF de démo (comme un signup classique). L'utilisateur peut compléter son téléphone et devenir conducteur depuis `/profile`.
- **Compte FB-only** : la connexion email/password renvoie `Invalid credentials` tant que l'utilisateur ne s'est pas défini un mot de passe local.

### Sécurité

- L'`App Secret` est utilisé pour calculer un `appsecret_proof` HMAC-SHA256 envoyé à chaque appel Graph (recommandation Meta contre le rejeu d'access_tokens).
- Le SDK JS n'est chargé qu'au runtime côté client si `NUXT_PUBLIC_FACEBOOK_APP_ID` est non-vide — pas de tracking tiers en dev sans Facebook configuré.
- Les permissions demandées sont minimales : `email,public_profile`.

## Limitations MVP

- Paiement **mocké** (wallet interne uniquement, crédit initial 10 000 XPF).
- Un seul véhicule actif par conducteur dans le parcours `/map`.
- Tracking GPS en premier plan uniquement (limitation du navigateur pour les PWA).
- Pas de notifications push, pas de SMS OTP.

## Roadmap

Paiement réel (Stripe/orange Money), tracking background (Capacitor natif), notifications push (FCM/APNs), historique public pour modération, scoring conducteurs/passagers, pricing dynamique (nuit, affluence), multi-route.
