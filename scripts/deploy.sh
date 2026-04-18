#!/usr/bin/env bash
# ------------------------------------------------------------------
# Tahiti Ride — script de déploiement serveur
# ------------------------------------------------------------------
# Usage : ./scripts/deploy.sh [SERVICE] [OPTIONS]
#
#   SERVICE (optionnel) :
#     all        (défaut) reconstruit et redémarre backend + frontend
#     backend    reconstruit et redémarre uniquement le backend
#     frontend   reconstruit et redémarre uniquement le frontend
#     full       inclut aussi la base de données (rare, recreate db)
#
#   OPTIONS :
#     --no-pull       ne fait pas de git pull
#     --no-cache      docker build --no-cache (build complet à neuf)
#     --no-logs       n'affiche pas les logs après le up
#     --pull-images   docker compose pull (récupère les images base à jour)
#     --branch=NAME   git pull sur la branche NAME (défaut : branche courante)
#     -h, --help      affiche cette aide
#
# Exemples :
#   ./scripts/deploy.sh                       # tout, comportement standard
#   ./scripts/deploy.sh backend               # rebuild seulement le backend
#   ./scripts/deploy.sh frontend --no-cache   # rebuild frontend depuis zéro
#   ./scripts/deploy.sh --no-pull             # ignore git pull (déjà à jour)
# ------------------------------------------------------------------

set -euo pipefail

# ---- Helpers de log ----
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'
  BLU='\033[0;34m'; DIM='\033[2m';   RST='\033[0m'
else
  RED=''; GRN=''; YEL=''; BLU=''; DIM=''; RST=''
fi

log()   { printf "${BLU}==> %s${RST}\n" "$*"; }
ok()    { printf "${GRN}✓ %s${RST}\n" "$*"; }
warn()  { printf "${YEL}! %s${RST}\n" "$*"; }
err()   { printf "${RED}✗ %s${RST}\n" "$*" >&2; }
info()  { printf "${DIM}  %s${RST}\n" "$*"; }

# ---- Arg parsing ----
SERVICE="all"
DO_PULL=1
NO_CACHE=0
SHOW_LOGS=1
PULL_IMAGES=0
GIT_BRANCH=""

print_help() {
  cat <<'EOF'
Tahiti Ride — script de déploiement serveur

Usage : ./scripts/deploy.sh [SERVICE] [OPTIONS]

  SERVICE (optionnel) :
    all        (défaut) reconstruit et redémarre backend + frontend
    backend    reconstruit et redémarre uniquement le backend
    frontend   reconstruit et redémarre uniquement le frontend
    full       inclut aussi la base de données (rare, recreate db)

  OPTIONS :
    --no-pull       ne fait pas de git pull
    --no-cache      docker build --no-cache (build complet à neuf)
    --no-logs       n'affiche pas les logs après le up
    --pull-images   docker compose pull (récupère les images base à jour)
    --branch=NAME   git pull sur la branche NAME (défaut : branche courante)
    -h, --help      affiche cette aide

Exemples :
  ./scripts/deploy.sh                       # tout, comportement standard
  ./scripts/deploy.sh backend               # rebuild seulement le backend
  ./scripts/deploy.sh frontend --no-cache   # rebuild frontend depuis zéro
  ./scripts/deploy.sh --no-pull             # ignore git pull (déjà à jour)
EOF
}

for arg in "$@"; do
  case "$arg" in
    all|backend|frontend|full) SERVICE="$arg" ;;
    --no-pull)     DO_PULL=0 ;;
    --no-cache)    NO_CACHE=1 ;;
    --no-logs)     SHOW_LOGS=0 ;;
    --pull-images) PULL_IMAGES=1 ;;
    --branch=*)    GIT_BRANCH="${arg#*=}" ;;
    -h|--help)     print_help; exit 0 ;;
    *)             err "Argument inconnu : $arg"; print_help; exit 1 ;;
  esac
done

# ---- Va à la racine du projet (parent du dossier scripts) ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_DIR}"

log "Projet : ${PROJECT_DIR}"

# ---- Pré-checks ----
[[ -f docker-compose.yml ]] || { err "docker-compose.yml introuvable dans ${PROJECT_DIR}"; exit 1; }
[[ -f .env ]]               || { err ".env introuvable (copier .env.example puis le compléter)"; exit 1; }
command -v docker >/dev/null || { err "docker n'est pas installé"; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose plugin manquant"; exit 1; }

# ---- Sélection des services ----
case "$SERVICE" in
  all)      BUILD_TARGETS=(backend frontend); UP_TARGETS=(backend frontend) ;;
  backend)  BUILD_TARGETS=(backend);          UP_TARGETS=(backend) ;;
  frontend) BUILD_TARGETS=(frontend);         UP_TARGETS=(frontend) ;;
  full)     BUILD_TARGETS=(backend frontend); UP_TARGETS=(db backend frontend) ;;
esac

log "Cible : ${SERVICE} (build=${BUILD_TARGETS[*]}, up=${UP_TARGETS[*]})"

# ---- 1. Git pull ----
if (( DO_PULL )); then
  if [[ ! -d .git ]]; then
    warn "Pas de dépôt git détecté, pull ignoré."
  else
    log "git pull"
    if [[ -n "$GIT_BRANCH" ]]; then
      git fetch origin "$GIT_BRANCH"
      git checkout "$GIT_BRANCH"
      git pull --ff-only origin "$GIT_BRANCH"
    else
      CUR_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
      info "branche : ${CUR_BRANCH}"
      git pull --ff-only origin "$CUR_BRANCH"
    fi
    ok "Code à jour ($(git rev-parse --short HEAD))"
  fi
else
  info "git pull ignoré (--no-pull)"
fi

# ---- 2. Pull des images de base (optionnel) ----
if (( PULL_IMAGES )); then
  log "docker compose pull"
  docker compose pull
fi

# ---- 3. Build ----
BUILD_ARGS=()
(( NO_CACHE )) && BUILD_ARGS+=(--no-cache)

log "docker compose build ${BUILD_ARGS[*]:-} ${BUILD_TARGETS[*]}"
docker compose build "${BUILD_ARGS[@]}" "${BUILD_TARGETS[@]}"
ok "Build terminé"

# ---- 4. Up (recreate) ----
log "docker compose up -d ${UP_TARGETS[*]}"
docker compose up -d "${UP_TARGETS[@]}"
ok "Conteneurs démarrés"

# ---- 5. Health check ----
log "Attente de l'état healthy (max 90s)..."
deadline=$(( SECONDS + 90 ))
while (( SECONDS < deadline )); do
  unhealthy=0
  for svc in "${UP_TARGETS[@]}"; do
    cid="$(docker compose ps -q "$svc" 2>/dev/null || true)"
    [[ -z "$cid" ]] && { unhealthy=1; break; }
    state="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo "none")"
    if [[ "$state" != "healthy" && "$state" != "none" ]]; then
      unhealthy=1
      break
    fi
  done
  if (( unhealthy == 0 )); then
    ok "Tous les services sont healthy (ou sans healthcheck)"
    break
  fi
  sleep 3
done

if (( unhealthy != 0 )); then
  warn "Au moins un service n'est pas encore healthy après 90s, vérifie les logs."
fi

# ---- 6. État final ----
log "Statut docker compose"
docker compose ps

# ---- 7. Logs ----
if (( SHOW_LOGS )); then
  log "Dernières lignes des logs (${UP_TARGETS[*]})"
  docker compose logs --tail=30 "${UP_TARGETS[@]}" || true
  info "Pour suivre en direct : docker compose logs -f ${UP_TARGETS[*]}"
fi

ok "Déploiement terminé."
