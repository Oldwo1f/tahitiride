# Tahiti Ride - MVP

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
CREATE USER tahiti WITH PASSWORD 'tahiti';
CREATE DATABASE tahiti_ride OWNER tahiti;
\c tahiti_ride
CREATE EXTENSION IF NOT EXISTS postgis;
GRANT ALL ON SCHEMA public TO tahiti;
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
   - **A** : créer un compte `role = passenger` (mail perso1, mdp 12345678).
   - **B** : créer un compte `role = driver`, ajouter un véhicule dans `/profile` (plaque, modèle, couleur).
3. **Sur A (passager)** : aller sur `/map`, autoriser la géolocalisation, choisir une direction (ville/campagne), cliquer « Je suis en attente ».
4. **Sur B (conducteur)** : aller sur `/map`, même direction, cliquer « Je passe en ligne ». Un QR code rotatif s'affiche en bas.
5. Vérifier que les deux comptes se voient mutuellement sur la carte (un point rouge sur A, un point bleu sur B) si les positions sont à moins de 3 km.
6. **A scanne le QR de B** via `/scan`. Le trajet démarre, le passager arrive sur `/trip/[id]`.
7. Déplacer la position du passager (ou laisser le watchPosition faire son travail). Les points GPS sont enregistrés dans `trip_points`.
8. **A re-scan le QR de B** (de nouveau via `/scan`). Le trajet se termine, la distance est calculée via Mapbox Map Matching (fallback Haversine sans token), le fare débité sur le wallet de A et crédité sur celui de B.
9. Vérifier `/wallet` sur chaque compte : A a son solde réduit, B l'a augmenté. L'historique liste les deux transactions.
10. Tester installabilité PWA : DevTools → Application → Manifest, installer sur mobile Android (menu → « Installer l'application »).
11. Test offline : désactiver le réseau, naviguer dans l'app shell → les pages s'ouvrent ; les appels API échouent proprement avec un message d'erreur (pas de stale cache).

## Déploiement Docker (serveur de test)

Tout se déploie avec **3 conteneurs** : `db` (PostGIS), `backend` (NestJS) et `frontend` (nginx + PWA statique). Le nginx du frontend fait aussi le **reverse-proxy de `/api/**` et `/socket.io/**` vers le backend** : on n'expose **qu'un seul port** (par défaut `80`) et il n'y a pas de CORS à configurer.

### Prérequis sur le serveur

- Docker ≥ 24 et le plugin `docker compose` (ou `docker-compose` v2).
- Un token public Mapbox (`pk.*`) — obligatoire au moment du build.
- Le port `80` libre (ou choisissez `FRONTEND_PORT` dans `.env`).

### 1. Copier le projet

Depuis votre machine locale :

```bash
# via rsync (recommandé : exclut node_modules, .nuxt, dist, etc.)
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.nuxt' \
  --exclude '.output' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude '.env' \
  /var/www/app/ user@mon-serveur:/opt/tahiti-ride/

# ou via git clone si le repo est poussé quelque part
# ssh user@mon-serveur "git clone <url> /opt/tahiti-ride"
```

### 2. Configurer l'environnement

Sur le serveur :

```bash
cd /opt/tahiti-ride
cp .env.example .env
nano .env
```

Valeurs **obligatoires** à changer :

- `DATABASE_PASSWORD` — mot de passe Postgres.
- `JWT_SECRET` — secret long aléatoire (générer avec `openssl rand -hex 48`).
- `NUXT_PUBLIC_MAPBOX_TOKEN` — token Mapbox public (utilisé au build).
- `MAPBOX_TOKEN` — token Mapbox (utilisé côté backend pour Map Matching; peut être le même).
- `FRONTEND_PORT` — garder `80` ou passer à `8080` si un autre serveur tourne déjà sur 80.

### 3. Lancer

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f backend  # suivre les migrations + boot
```

Le backend lance automatiquement les migrations TypeORM au démarrage (dont la création de l'extension PostGIS). Le frontend est servi sur `http://IP_SERVEUR/` (ou `FRONTEND_PORT`).

### 4. Vérifier

```bash
# Santé du backend (via le proxy nginx → même origine que la PWA)
curl http://IP_SERVEUR/health

# Logs en direct
docker compose logs -f

# Accès à la base depuis le conteneur
docker compose exec db psql -U tahiti -d tahiti_ride -c "\dt"
```

### 5. Mises à jour

```bash
cd /opt/tahiti-ride
git pull   # ou refaire un rsync depuis votre machine
docker compose build
docker compose up -d
```

Note : le token `NUXT_PUBLIC_MAPBOX_TOKEN` est **baké dans le bundle statique au build**. Si vous le changez, il faut refaire `docker compose build frontend && docker compose up -d frontend`.

### Ports et réseau

| Service  | Exposé host              | Réseau interne       |
|----------|--------------------------|----------------------|
| frontend | `${FRONTEND_PORT}` → 80  | `tahiti_net:80`      |
| backend  | — (interne uniquement)   | `tahiti_net:3001`    |
| db       | — (interne uniquement)   | `tahiti_net:5432`    |

Pour exposer le backend ou la DB (debug, client externe), décommenter les sections `ports:` dans `docker-compose.yml`.

### HTTPS (recommandé en vrai test)

Le nginx embarqué parle HTTP. Pour HTTPS, deux options :

1. **Reverse-proxy externe** (Caddy, Traefik, nginx hôte, Cloudflare Tunnel) devant `FRONTEND_PORT`. C'est la plus simple.
2. Ajouter un Caddy/Traefik dans le `docker-compose.yml` avec ACME automatique. Sans HTTPS, le service worker PWA fonctionne uniquement sur `localhost` — l'installation PWA depuis un mobile nécessite HTTPS.

### Sauvegarde / restauration de la base

```bash
# Sauvegarde
docker compose exec db pg_dump -U tahiti tahiti_ride > backup-$(date +%F).sql

# Restauration
cat backup.sql | docker compose exec -T db psql -U tahiti tahiti_ride
```

### Reset complet

```bash
docker compose down -v   # ⚠️ supprime aussi le volume de la DB
docker compose up -d --build
```

## Limitations MVP

- Paiement **mocké** (wallet interne uniquement, crédit initial 10 000 XPF).
- Un seul véhicule actif par conducteur dans le parcours `/map`.
- Tracking GPS en premier plan uniquement (limitation du navigateur pour les PWA).
- Pas d'administration, pas de notifications push, pas de SMS OTP.

## Roadmap

Paiement réel (Stripe/orange Money), tracking background (Capacitor natif), admin backoffice, notifications push (FCM/APNs), historique public pour modération, scoring conducteurs/passagers, pricing dynamique (nuit, affluence), multi-route.
