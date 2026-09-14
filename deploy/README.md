# Déploiement sur une VM OVH (sans chaîne de CD, sans DNS)

Le jeu se sert **lui-même** : le serveur Node écoute en HTTP **et** WebSocket sur
**un seul port**. On ouvre simplement `http://<IP-VM>:<port>` dans un navigateur —
pas besoin de DNS, pas besoin de reverse proxy, pas de HTTPS.

Un petit script shell (`deploy.sh`), tournant en permanence via systemd, tire la
branche `main` toutes les ~30 s et redémarre le serveur dès qu'un nouveau commit
est détecté. C'est votre « CD » minimal, sans pipeline externe.

## Prérequis sur la VM

- Debian/Ubuntu récent (une petite VPS OVH suffit, ex. 1 vCPU / 1 Go RAM).
- `git`, `node` (≥ 18), `npm`.
- Le port d'écoute ouvert dans le pare-feu OVH (8080 par défaut) :
  le client y accède en HTTP **et** WebSocket.

## Installation (à faire une fois sur la VM)

```bash
# 1. Outils de base
sudo apt update && sudo apt install -y git curl
# 2. Node 18+ (exemple via NodeSource — adaptez à votre distribution)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Récupère le dépôt (pour avoir le script de déploiement)
sudo mkdir -p /opt/flex-survival
sudo chown -R "$USER":"$USER" /opt/flex-survival
git clone https://github.com/projetlecharcutier/gestion.git /opt/flex-survival/repo
cp /opt/flex-survival/repo/deploy/deploy.sh /opt/flex-survival/deploy.sh
chmod +x /opt/flex-survival/deploy.sh

# 4. Installe le service systemd (démarrage auto au boot + relance si crash)
sudo cp /opt/flex-survival/repo/deploy/flex.service /etc/systemd/system/flex.service
#    ↳ Éditez REPO_URL / PORT si besoin : sudo nano /etc/systemd/system/flex.service
sudo systemctl daemon-reload
sudo systemctl enable --now flex

# 5. Vérifie
systemctl status flex
journalctl -u flex -f      # logs du watcher + du serveur
```

Au premier démarrage, le watcher clone le dépôt dans `/opt/flex-survival/app`,
installe les dépendances serveur et lance le serveur. Le jeu est alors
disponible sur `http://<IP-VM>:8080`.

> **IP plutôt que DNS** : le client détecte automatiquement l'hôte **et le port**
> de la page pour ouvrir le WebSocket (voir `src/net.js`, `serverUrl()`). Donc
> ouvrir `http://1.2.3.4:8080` connecte le WS sur `ws://1.2.3.4:8080`. Aucune
> configuration supplémentaire.

## Comment ça marche

- `deploy/deploy.sh` : le watcher. Boucle infinie qui `git fetch` la branche
  `main` toutes les `POLL_INTERVAL` secondes ; si le commit a changé, il
  `reset --hard`, réinstalle les dépendances si `package.json` a bougé, puis
  redémarre le serveur. Il relance aussi le serveur s'il a crashé. Le serveur
  Node tourne comme **processus enfant** de ce watcher.
- `deploy/flex.service` : service systemd qui lance le watcher au boot et le
  relance (`Restart=always`) s'il crash.
- `server/index.js` : sert les fichiers statiques (`index.html`, `src/`,
  `assets/`) **et** le WebSocket sur le **même port** (module `http` + `ws`
  attaché au serveur HTTP). C'est ce qui permet de tout servir sur
  `http://<IP>:<port>`.

## Variables configurables

Le watcher et le service lisent ces variables d'environnement :

| Variable        | Défaut                                   | Rôle                              |
|-----------------|------------------------------------------|----------------------------------|
| `REPO_URL`      | détecté depuis `origin` du dépôt local  | URL Git à suivre                  |
| `BRANCH`        | `main`                                   | Branche à déployer                |
| `APP_DIR`       | `/opt/flex-survival/app`                  | Checkout de travail               |
| `PORT`          | `8080`                                   | Port HTTP + WebSocket             |
| `POLL_INTERVAL` | `30`                                     | Secondes entre 2 vérifications    |
| `NODE_BIN`      | `node`                                   | Binaire Node                      |

Pour changer le port, éditez l'`Environment=PORT=...` du service, puis
`sudo systemctl restart flex`.

## Logs

- Logs du watcher + du serveur : `journalctl -u flex -f`
- Logs du serveur Node uniquement : `/opt/flex-survival/app/server.log`

## Mises à jour

Il n'y a **rien à faire** : poussez sur `main`, le watcher détecte le nouveau
commit dans les ~30 s et redémarre le serveur avec la nouvelle version.

## Sans systemd (test / VM sans init systemd)

```bash
REPO_URL=https://github.com/projetlecharcutier/gestion.git \
PORT=8080 \
nohup /opt/flex-survival/deploy.sh > /opt/flex-survival/watcher.log 2>&1 &
```

## Pare-feu OVH

Surveillez la politique réseau OVH (vRack / Security Groups) : autorisez le
TCP entrant sur le `PORT` choisi (8080 par défaut) depuis l'extérieur, sinon le
navigateur ne pourra pas joindre la page ni le WebSocket.
