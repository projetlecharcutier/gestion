#!/bin/bash
#
# Watcher de déploiement continu pour Flex Survival.
#
# But : tourner en permanence sur la VM et garder déployée la dernière version
# de la branche `main` du dépôt Git, SANS chaîne de CD.
#
# Principe : toutes les POLL_INTERVAL secondes, on tire `main`. Si le code a
# changé (le hash du dernier commit déploié diffère), on (ré)installe les
# dépendances si besoin, on arrête le serveur en cours et on le redémarre.
#
# À lancer via le service systemd fourni (deploy/flex.service) pour qu'il
# démarre au boot et soit relancé s'il crash. Le serveur Node tourne comme
# processus enfant de ce watcher.
#
# Configuration via variables d'environnement (ou éditer les défauts ci-dessous) :
#   REPO_URL    URL Git du dépôt (HTTPS public). Défaut : dépôt courant détecté.
#   BRANCH      Branche à suivre. Défaut : main.
#   APP_DIR     Dossier de travail (checkout). Défaut : /opt/flex-survival/app
#   PORT         Port d'écoute HTTP+WS. Défaut : 8080.
#   POLL_INTERVAL  Secondes entre deux vérifications Git. Défaut : 30.
#   NODE_BIN     Binaire node. Défaut : node (ou détecté).
#
# Exécution manuelle : REPO_URL=https://github.com/.../gestion.git PORT=8080 ./deploy.sh
#
set -euo pipefail

# --- Configuration ---------------------------------------------------------
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/flex-survival/app}"
PORT="${PORT:-8080}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"
NODE_BIN="${NODE_BIN:-node}"

# Détection automatique de l'URL du dépôt si non fournie (depuis l'origine).
if [ -z "$REPO_URL" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  if [ -d "$REPO_DIR/.git" ]; then
    REPO_URL="$(git -C "$REPO_DIR" config --get remote.origin.url 2>/dev/null || true)"
  fi
fi
if [ -z "$REPO_URL" ]; then
  echo "[FATAL] REPO_URL indéfini et impossible à détecter. Passez REPO_URL=..." >&2
  exit 1
fi

mkdir -p "$(dirname "$APP_DIR")"

LOG_TAG="[flex-deploy]"

log() { echo "$LOG_TAG $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Fichier mémorisant le dernier commit déployé avec succès.
DEPLOYED_REF_FILE="$APP_DIR/.deployed-ref"
# PID du serveur en cours (enfant de ce watcher).
SERVER_PID=""

# --- Gestion du serveur Node -----------------------------------------------
start_server() {
  # Sécurité : si le port est encore occupé (ancien serveur orphelin qui
  # n'est pas dans la table de processus du motif pkill, ou TIME_WAIT
  # lourd), le nouveau serveur mourrait en EADDRINUSE en silence. On tue
  # tout occupant restant avant de démarrer.
  if command -v fuser >/dev/null 2>&1 && fuser -k "$PORT"/tcp >/dev/null 2>&1; then
    log "Port $PORT encore occupé : occupant tué avant démarrage."
    sleep 0.5
  fi
  log "Démarrage du serveur sur le port $PORT..."
  cd "$APP_DIR/server"
  PORT="$PORT" setsid "$NODE_BIN" index.js >>"$APP_DIR/server.log" 2>&1 &
  SERVER_PID=$!
  disown "$SERVER_PID" 2>/dev/null || true
  log "Serveur démarré (pid $SERVER_PID). Logs : $APP_DIR/server.log"
}

stop_server() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    log "Arrêt du serveur (pid $SERVER_PID)..."
    # Tue le groupe de processus (le serveur + ses enfants) proprement.
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 0.5
    done
    if kill -0 "$SERVER_PID" 2>/dev/null; then
      log "Serveur encore vivant, kill -9."
      kill -KILL "$SERVER_PID" 2>/dev/null || true
      # Tue aussi d'éventuels processus orphelins sur le port.
      pkill -KILL -f "index.js" 2>/dev/null || true
    fi
  else
    # Au cas où un serveur d'un précédent watcher tourne encore sur le port.
    pkill -KILL -f "node.*index.js" 2>/dev/null || true
  fi
  SERVER_PID=""
}

cleanup() {
  log "Arrêt du watcher, stoppe le serveur..."
  stop_server
  exit 0
}
trap cleanup INT TERM

# --- Déploiement -----------------------------------------------------------
git_fetch_latest() {
  # Clone initial si besoin.
  if [ ! -d "$APP_DIR/.git" ]; then
    log "Clonage initial de $REPO_URL (branche $BRANCH) vers $APP_DIR..."
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  # Récupère la dernière révision de la branche distante sans toucher au WD.
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  local remote_ref
  remote_ref="$(git -C "$APP_DIR" rev-parse "origin/$BRANCH")"
  echo "$remote_ref"
}

needs_install() {
  # Réinstalle si package.json a changé ou si node_modules absent.
  [ ! -d "$APP_DIR/server/node_modules" ] && return 0
  local deployed
  deployed="$(cat "$DEPLOYED_REF_FILE" 2>/dev/null || echo "")"
  # Comparaison rapide du hash de package.json entre la révision déployée et la cible.
  local cur_pkg target_pkg
  cur_pkg="$(git -C "$APP_DIR" show "${deployed}:server/package.json" 2>/dev/null | md5sum | cut -d' ' -f1 || true)"
  target_pkg="$(git -C "$APP_DIR" show "origin/$BRANCH:server/package.json" 2>/dev/null | md5sum | cut -d' ' -f1 || true)"
  [ "$cur_pkg" != "$target_pkg" ]
}

deploy() {
  local target="$1"
  log "Nouvelle version détectée ($target). Mise à jour du code..."
  git -C "$APP_DIR" checkout --quiet "$BRANCH"
  git -C "$APP_DIR" reset --hard --quiet "$target"

  if needs_install; then
    log "Réinstallation des dépendances serveur..."
    (cd "$APP_DIR/server" && npm install --omit=dev --no-audit --no-fund)
  fi

  stop_server
  start_server

  echo "$target" >"$DEPLOYED_REF_FILE"
  log "Déploiement de $target terminé."
}

# --- Boucle principale ----------------------------------------------------
log "Watcher démarré. Repo=$REPO_URL Branche=$BRANCH App=$APP_DIR Port=$PORT Poll=${POLL_INTERVAL}s"

# Premier déploiement : au démarrage du watcher, on ARRÊTE toujours tout
# serveur existant et on redéploie — un "relancement" du service doit
# TOUJOURS repartir à zéro (nouvelle partie, 0 joueur connecté). L'ancien
# code ne redéployait pas si un serveur tournait déjà : le watcher gardait
# le vieux processus (et ses joueurs) tel quel, et "relancer" ne servait à
# rien. Un ancien serveur orphelin (watcher tué avant son nettoyage) est
# aussi tué ici, sinon il garderait le port et le nouveau démarrage
# échouerait en EADDRINUSE.
initial_ref=""
initial_ref="$(git_fetch_latest || true)"
if [ -n "$initial_ref" ]; then
  log "Démarrage du watcher : arrêt de tout serveur existant et déploiement propre..."
  pkill -KILL -f "node.*index.js" 2>/dev/null || true
  sleep 0.5
  deploy "$initial_ref"
else
  log "Impossible de récupérer la révision distante (réseau ?) : le serveur existant est conservé."
fi

while true; do
  sleep "$POLL_INTERVAL"
  # Vérifie que le serveur est encore vivant ; le relance si besoin.
  if [ -n "$SERVER_PID" ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
    log "Serveur crashé (pid $SERVER_PID absent), redémarrage..."
    start_server
  fi
  # Vérifie les mises à jour Git.
  new_ref="$(git_fetch_latest || true)"
  [ -z "$new_ref" ] && continue
  deployed_ref="$(cat "$DEPLOYED_REF_FILE" 2>/dev/null || echo "")"
  if [ "$new_ref" != "$deployed_ref" ]; then
    deploy "$new_ref"
  fi
done
