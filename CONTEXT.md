# Carte du projet — Ville Isométrique

> **But de ce fichier** : donner une vue d'ensemble suffisante pour travailler sur un système précis sans relire tout le code. À relire avant chaque demande, puis à mettre à jour quand un système change.

## Lancer le jeu

Ouvrir `index.html` dans un navigateur récent. Aucune dépendance, aucun build : JS vanilla, modules chargés en ordre via balises `<script>` (pas de bundler, pas d'ES modules — partage via l'objet global `window.GAME`).

## Architecture

Le code est découpé par **système**. Chaque fichier `(function(){ ... })()` expose ses fonctions sur `window.GAME` (alias `G`).

Les **textures** (sprites pixel art + palettes de couleurs) sont isolées des fonctions de dessin dans `src/textures/`, exposées sur `G.TEXTURES`. Le rendu (`src/render.js`, `src/hud.js`, `src/bag.js`) les consomme sans les définir.

### Ordre de chargement (voir `index.html`)

| # | Fichier | Rôle | Exposé sur `G` |
|---|---------|------|---------------|
| 1 | `src/config.js` | Constantes globales, armes, cycle jour/nuit, helpers (`rand`, `clamp`, `isNight`) | `WORLD`, `TOWN`, `WEAPON_STATS`, `ZOMBIE_*`, `WALL_*`, … |
| 2 | `src/state.js` | État global + références DOM (canvas, HUD, écrans) | `state`, `canvas`, `ctx`, `hud*`, `startScreen`… |
| 3 | `src/projection.js` | Projection iso monde↔écran, limites visibles, `inTown` | `proj`, `unproj`, `viewW/H`, `visibleWorldBounds`, `inTown` |
| 4 | `src/world.js` | Génération : bâtiments, mur de périmètre, objets, arbres | `buildWorld`, `makeBuilding`, `nearBuilding`, `buildPerimeterWall` |
| 5 | `src/player.js` | Déplacement, collisions (bâtiments + planches posées), entrée bâtiment, soin hôpital, pause | `tryMove`, `aabbHitsBuildings`, `clampPlayer`, `enterBuilding`, `leaveBuilding`, `togglePause`, `tryHealAtHospital`, `hasGoldPiece` |
| 6 | `src/walls.js` | Construction de planches/murs (Z + clic) + rotation + collisions + nettoyage murs détruits | `tryBuildWall`, `cleanupWalls`, `plankDims`, `rotatePlank`, `aabbHitsWalls` |
| 7 | `src/chop.js` | Récolte de planches à la hache (décompte près d'un arbre) | `updateChop`, `chopProgress` |
| 8 | `src/weapons.js` | Stats arme équipée, tir, déplacement projectiles | `equippedStats`, `handleShooting`, `updateProjectiles` |
| 9 | `src/zombies.js` | Vagues, groupes qui fusionnent, IA zombies | `spawnWave`, `mergeGroups`, `updateZombies`, `cleanupZombies` |
| 10 | `src/bag.js` | Sac : disposition, rendu, clic équiper (armes & hache) | `bagLayout`, `handleBagClick`, `drawBag` |
| 11 | `src/hud.js` | HUD DOM + overlays canvas (dont cercle de décompte hache) | `updateHud`, `drawClock`, `drawPlayerHpBar`, `drawBuildHint`, `drawChopProgress`, `drawGameOver` |
| 12 | `src/render.js` | Tout le dessin + `render()` | `drawGround/Item/Tree/Building/Player/Wall/Zombie/Projectiles/Fog/Crosshair`, `fillPoly`, `roundRect`, `render` |
| 13 | `src/input.js` | Entrées (souris, molette, clavier) + formulaire démarrage | resize interne, listeners |
| 14 | `src/main.js` | Logique par frame `update(dt)` + `loop()` | `update`, `loop` |

## État global : `G.state`

Schéma complet dans `src/state.js`. Champs clés :

- `player { x, y, face, moving, hp }` — position monde, orientation, vie
- `camera { x, y }`, `zoom`, `targetZoom`
- `mouse { sx, sy, wx, wy, inside }` — écran (s*) + monde (w*)
- `items[]`, `buildings[]`, `trees[]`, `walls[]`, `zombies[]`, `zombieGroups[]`
- `bag { open, contents[] }`, `equipped` (nom arme ou null), `projectiles[]`
- `planks`, `inventory`, `shootCd`, `buildMode`, `plankRotation` (0=horizontal, 1=vertical)
- `axeEquipped` (bool), `chopTarget` (arbre visé ou null), `chopTimer` (accumulateur s)
- `clock` (0..24), `day`, `elapsed`, `nextWaveAt`, `waveActive`, `waveLeaveAt`

## Constantes importantes (`src/config.js`)

| Constante | Valeur | Sens |
|-----------|--------|------|
| `WORLD` | 10000 | Taille carte (px) |
| `TOWN` | 1000 | Taille ville (px) |
| `PLAYER_W/H` | 6 / 15 | Sprite joueur (bâtiments ≤ `PLAYER_W*20` = 120 px) |
| `SPEED` | 260 | Vitesse joueur (px/s) |
| `FOG_RADIUS` | 200 | Visibilité hors ville (px) |
| `ZOMBIE_SPEED` | 130 | Moitié du joueur |
| `ZOMBIE_PLAYER_DMG` | 20 | 5 coups = mort (100 PV) |
| `WALL_MAX_HP` | 100 | PV d'un mur |
| `PLAYER_MAX_HP` | 100 | PV joueur |
| `MAIRIE_MAX_HP` | 1000 | PV de la Mairie (game over à 0) |
| `WALL_PLANKS` | 4 | Planches / planche posée |
| `PLANK_LONG/THICK` | 120 / 24 | Dimensions d'une planche posée (px) |
| `TREE_CHOP_TIME` | 4 | Temps de récolte d'un arbre (s) |
| `AXE_RANGE` | 120 | Portée de la hache (px) |
| `WEAPON_STATS` | — | Table des armes (dmg, portée, cd, spread, color) |
| `DAY_SECONDS` | 300 | 12h in-game = 5 min réel |
| `WAVE_EVERY` | 420 | Vague toutes les 7 min |
| `WAVE_LEAVE` | 600 | Repartent après 10 min |
| `ZOMBIE_PER_WAVE_BASE` | 50 | Zombies à la 1ère vague |
| `ZOMBIE_WAVE_GROWTH` | 2 | ×2 zombies chaque nuit (+100%) |

## Boucle de jeu (`src/main.js`)

`loop(now)` → `update(dt)` → `render()`. `dt` plafonné à 0.1 s. `update` :

1. Avance `time`, lisse `zoom`, décrémente `shootCd`
2. Cycle jour/nuit (incrémente `clock`, `day`)
3. `updateZombies(dt)`
4. Déplacement joueur (suit la souris) si pas en bâtiment/pause/sac/game over
5. `handleShooting()` → `updateProjectiles(dt)` (tir désactivé en mode pose de planche)
6. `cleanupZombies()` + `cleanupWalls()` + `updateChop(dt)` (récolte hache)
7. Caméra suit le joueur
8. Refresh souris monde + `updateHud()`

## Textures (`src/textures/`)

Sprites pixel art et palettes de couleurs, isolés du rendu. Exposés sur `G.TEXTURES.<type>`.

| Fichier | Type | Contenu |
|---------|------|--------|
| `src/textures/index.js` | — | initialise `G.TEXTURES` |
| `src/textures/player.js` | joueur | sprite 6×15 + palette + ombre |
| `src/textures/zombie.js` | zombie | sprite 6×15 + palette + ombre |
| `src/textures/building.js` | bâtiment | faces, toit, porte |
| `src/textures/wall.js` | mur | faces, dessus, seuils barre de vie |
| `src/textures/tree.js` | arbre | tronc, ombre, feuillage par `kind` |
| `src/textures/item.js` | objet au sol | ombre, reflet, poignée d'arme |
| `src/textures/ground.js` | sol | tuiles ville/wild, bordure, fond ciel |
| `src/textures/fog.js` | brouillard | couleur + arrêts du dégradé |
| `src/textures/crosshair.js` | viseur | couleur + géométrie réticule |
| `src/textures/projectile.js` | projectile | couleur repli, traîne, taille tête |
| `src/textures/hud.js` | overlays HUD | barre de vie, horloge, hint, game over, **cercle de décompte hache** |
| `src/textures/bag.js` | sac UI | panneau, titres, icônes |

Voir `docs/textures.md` pour la spec.

## Points d'extension (où ajouter sans tout casser)

- **Nouvelle arme** → ajouter une entrée dans `G.WEAPON_STATS` (`src/config.js`). Aucun autre fichier à toucher : `equippedStats`, le tir et le sac la prennent en compte automatiquement.
- **Nouvel outil** (comme la hache) → ajouter un objet `kind:"outil"` dans `buildWorld` (`src/world.js`), gérer l'équipement dans `handleBagClick` (`src/bag.js`) via un booléen dédié, et la logique métier dans un nouveau `src/<nom>.js` (modèle : `src/chop.js`).
- **Nouvel objet ramassable** → `state.items[]` dans `buildWorld` (`src/world.js`) ; ramassage géré dans le clic (`src/input.js`).
- **Nouveau bâtiment** → `state.buildings[]` dans `buildWorld` (`src/world.js`) ; rendu auto (`src/render.js`).
- **Comportement zombie** → `updateZombies` (`src/zombies.js`) ; nettoyer les morts via `cleanupZombies`.
- **Nouveau HUD canvas** → `src/hud.js`, appeler dans `render()` (`src/render.js`).
- **Nouvelle entrée clavier** → `src/input.js`.
- **Changer un sprite / une couleur** → `src/textures/<type>.js` uniquement (le rendu les consomme).
- **Nouveau système complet** → créer `src/<nom>.js`, l'ajouter à `index.html` avant `main.js`, exposer sur `G`, documenter ici.

## Specs détaillées par système

Voir `docs/` : une spec courte par système (contrats, entrées/sorties, contraintes).

## Mode multijoueur (client-serveur)

Le jeu fonctionne en mode **client-serveur** : un serveur Node.js héberge une **partie unique** (max 20 joueurs), les clients se connectent en WebSocket et ne font que le rendu + envoi des inputs. Le serveur est **autorité** sur la simulation (déplacement, collisions, zombies, projectiles, mairie, récolte, vagues, game over).

### Serveur (`server/`)

| Fichier | Rôle |
|---------|------|
| `server/index.js` | Serveur WebSocket (ws), boucle 20 Hz, broadcast lobby (2 Hz) + état de jeu (10 Hz), gestion connexions/déconnexions, redémarrage auto |
| `server/game.js` | État du monde + simulation. Charge les modules `src/*.js` partagés via `eval` (stub DOM), gère joueurs, vagues, game over |
| `server/dom-stub.js` | Stub DOM + assets (`hasSprite→false`, canvas factice) pour exécuter `buildWorld()` sans navigateur |
| `server/package.json` | Dépendance : `ws` uniquement |

### Client (`src/net.js`)

| Fonction | Rôle |
|----------|------|
| `G.netConnect()` | Connexion WebSocket au serveur (auto-détection hôte/port) |
| `G.netJoin(name)` | Rejoint la partie (envoie `join`) |
| `G.netInput(input)` | Envoie un input (`dx,dy,fire,build,buildWall,aimX,aimY,pickup,equip,toggleAxe,rotate`) |
| `G.netHandle(msg)` | Traite `lobby` / `joined` / `state` / `restart` / `full` |
| `G.applyRemoteState(s)` | Applique l'état serveur au state local (interpolation position joueur, sac, équipement, planches) |
| `G.updateLobbyDisplay()` | Affiche le lobby dans le menu d'accueil (heure, joueurs connectés, statut) |

### Cycle de vie de la partie (serveur)

1. **Aucun joueur connecté** → partie arrêtée (en attente).
2. **Un joueur rejoint** → compte à rebours de **30 s** avant le lancement (visible dans le lobby).
3. **Partie lancée** → simulation active, vagues de zombies la nuit, mairie attaquable.
4. **Mairie détruite (PV ≤ 0)** → game over, redémarrage auto après 10 s si des joueurs sont présents.
5. **Places** : max 20, libérées à la déconnexion (non réservées).

### Lancer le serveur

```bash
cd server
npm install
npm start          # écoute sur PORT (8080 par défaut)
# ou : PORT=3030 npm start
```

Le serveur sert **aussi les fichiers statiques** (index.html, src/, assets/) sur le même port que le WebSocket : on ouvre simplement `http://<hote>:<port>` dans un navigateur, le client s'y connecte en WebSocket sur le même hôte:port. Aucun DNS, aucun reverse proxy nécessaires.

En développement local, ouvrir `http://localhost:8080` pendant que le serveur tourne. Le menu d'accueil affiche le lobby (heure du monde, joueurs connectés, statut) avant de rejoindre.

### Déploiement continu sur une VM (sans chaîne de CD)

`deploy/` contient un watcher shell (`deploy.sh`) + un service systemd (`flex.service`) qui, en permanence, tire la branche `main` et redémarre le serveur à chaque nouveau commit. Voir `deploy/README.md` pour l'installation sur une VM OVH (fonctionne via `http://<IP-VM>:<port>`, sans DNS).

| Fichier | Rôle |
|---------|------|
| `deploy/deploy.sh` | Watcher : boucle de `git fetch main` toutes les `POLL_INTERVAL` s, redéploie (reset --hard, npm install si besoin, redémarre le serveur) si le commit a changé, relance le serveur s'il a crashé |
| `deploy/flex.service` | Service systemd : lance le watcher au boot, le relance s'il crash |
| `deploy/README.md` | Instructions d'installation sur la VM (prérequis, systemd, logs, pare-feu) |
