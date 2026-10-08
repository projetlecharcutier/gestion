# Carte du projet — Ville Isométrique

> **But de ce fichier** : donner une vue d'ensemble suffisante pour travailler sur un système précis sans relire tout le code. À relire avant chaque demande, puis à mettre à jour quand un système change.

## Lancer le jeu

Mode **multijoueur (serveur) par défaut** : `cd server && npm install && npm start` puis ouvrir `http://<hote>:8080` (le serveur sert aussi les fichiers statiques). Solo via le menu d'accueil. Aucun build : JS vanilla, modules chargés en ordre via balises `<script>` (pas de bundler, pas d'ES modules — partage via l'objet global `window.GAME`).

### Tests

Tests Node sans framework : `./test/run.sh` (tout), `./test/run.sh zombies` (une catégorie), `node test/<categorie>/<fichier>.js` (0 = OK). Stubs DOM embarqués, aucun navigateur requis. Catégories : `zombies`, `world`, `buildings`, `walls`, `chop`, `bag`, `ville`, `towers`, `siege`, `birds`, `fauna`, `menu`, `loopback` (intégration complète avec serveur spawné), `potence`, `serveur`. `TEST_SEED` rend le monde reproductible (PRNG remplaçant `Math.random` côté serveur) ; `TEST_START_PLANKS` donne des planches de départ.

## Architecture

Le code est découpé par **système**. Chaque fichier `(function(){ ... })()` expose ses fonctions sur `window.GAME` (alias `G`).

Les **textures** (sprites pixel art + palettes de couleurs) sont isolées des fonctions de dessin dans `src/textures/`, exposées sur `G.TEXTURES`. Le rendu (`src/render.js`, `src/hud.js`, `src/bag.js`) les consomme sans les définir.

### Ordre de chargement (voir `index.html`)

| # | Fichier | Rôle | Exposé sur `G` |
|---|---------|------|---------------|
| 1 | `src/config.js` | Constantes globales, armes, cycle jour/nuit, helpers (`rand`, `clamp`, `isNight`) | `WORLD`, `TOWN`, `WEAPON_STATS`, `ZOMBIE_*`, `WALL_*`, … |
| 2 | `src/stats.js` | Compteurs de partie (kills, etc.) | `stats`, helpers stats |
| 3 | `src/assets.js` | Chargement des PNG/sons, dictionnaire d'assets | `assets`, `getSprite`, `hasSprite` |
| 4 | `src/state.js` | État global + références DOM (canvas, HUD, écrans) | `state`, `canvas`, `ctx`, `hud*`, `startScreen`… |
| 5 | `src/projection.js` | Projection iso monde↔écran, limites visibles, `inTown` | `proj`, `unproj`, `viewW/H`, `visibleWorldBounds`, `inTown` |
| 6 | `src/ville.js` | Villes décoratives PNG (collisions par masque, rendu en bandes) | `villeSetup`, `aabbHitsVilles`, `villeAt`, `villeBlockNav`, `villeBands`, `drawVilleBand` |
| 7 | `src/world.js` | Génération : bâtiments, mur de périmètre, objets, arbres, éléments de décor (`DECOR_SPECS` : bloquant = collision, nonbloquant = traversable, dessous = le joueur passe sous la texture, ex. éolienne ×10, cerf géant ×1, moulins ×20, buissons ×50, champs ×12 chacun) | `buildWorld`, `makeBuilding`, `makeDecor`, `spawnDecor`, `nearBuilding`, `buildPerimeterWall` |
| 8 | `src/flowfield.js` | Flow field zombies : BFS vers la ville + flèche précalculée par cellule, connectivité des forêts | `rebuildNavGrid`, `navStep`, `navAngle`, `ensureForetConnectivity` |
| 9 | `src/player.js` | Déplacement, collisions (bâtiments + planches posées), entrée bâtiment, soin hôpital, pause | `tryMove`, `aabbHitsBuildings`, `clampPlayer`, `enterBuilding`, `leaveBuilding`, `togglePause`, `tryHealAtHospital`, `hasGoldPiece` |
| 10 | `src/walls.js` | Construction de planches/murs (Z + clic) + rotation + collisions + nettoyage murs détruits | `tryBuildWall`, `cleanupWalls`, `plankDims`, `rotatePlank`, `aabbHitsWalls` |
| 11 | `src/towers.js` | Bâtiments de ville (scierie, université, montgolfière) + tours d'attaque : tech à la mairie (vote), menu de construction, chantiers, tir automatique flèches | `makeTownBuilding`, `makeScierie`, `makeTower`, `updateBuildSites`, `updateTowers`, `cleanupTowers`, `buildMenu`, `placeFromBuildMenu`, `canPayTownTech`, `unlockTownTech`, `startVote`, `castVote`, `resolveVote` |
| 12 | `src/chop.js` | Récolte de planches à la hache (décompte près d'un arbre) | `updateChop`, `chopProgress` |
| 13 | `src/weapons.js` | Stats arme équipée, tir, déplacement projectiles | `equippedStats`, `handleShooting`, `updateProjectiles` |
| 14 | `src/birds.js` | Oiseaux volants (drop or/planches) | `updateBirds`, `drawBirds` |
| 14b | `src/fauna.js` | Animaux sauvages (cerf, cochon, vache, mouton : errent hors ville, tués par projectiles, droppent Nourriture, repop chaque matin pour maintenir 200 bêtes) | `spawnFaunaAll`, `updateFauna`, `cleanupFauna`, `repopFauna`, `faunaDrop` |
| 14c | `src/ciel.js` | Couche ciel (nuages ×50 O→E, montgolfières ×20 toutes directions, oiseaux ×10 cap 250°, avions Porco ×5 cap 330° plus rapides) : purement visuelle, aucune collision, dessinée au-dessus de tout ; nuages toujours au-dessus des autres éléments du ciel ; sortie d'un bord = réapparition au bord opposé | `cielInit`, `updateCiel`, `drawCiel` |
| 14d | `src/ghost.js` | Mode fantôme + tombes : à la mort d'un joueur, `spawnGrave` pose une tombe « rip - <nom> » à l'endroit du décès (plafond `GRAVES_MAX`, idempotente par joueur) ; Espace après mort = petit fantôme qui vole (aucune interaction, plus de brouillard), textures `TEXTURES.ghost`/`TEXTURES.grave` ; rendu `drawGhost`/`drawGraves` (`src/render.js`) | `spawnGrave`, `GRAVES_MAX`, `TEXTURES.ghost`, `TEXTURES.grave` |
| 15 | `src/siege.js` | Tour de siège zombie (lente, 100 PV, attaque murs/ville) | `updateSiege`, `drawSiege` |
| 16 | `src/zombies.js` | Vagues, groupes qui fusionnent, IA zombies (priorité : palissade > tour > mairie/joueur) | `spawnWave`, `mergeGroups`, `updateZombies`, `cleanupZombies` |
| 17 | `src/bag.js` | Sac : disposition, rendu, clic équiper (armes & hache) | `bagLayout`, `handleBagClick`, `drawBag` |
| 18 | `src/hud.js` | HUD DOM + overlays canvas (dont cercle de décompte hache) | `updateHud`, `drawClock`, `drawPlayerHpBar`, `drawBuildHint`, `drawChopProgress`, `drawGameOver` |
| 19 | `src/net.js` | Client WebSocket (connexion, inputs, application état serveur) | `netConnect`, `netJoin`, `netInput`, `netHandle`, `applyRemoteState` |
| 20 | `src/render.js` | Tout le dessin + `render()` (dont `drawTower`, flèche orientée, brouillard multi-sources) | `drawGround/Item/Tree/Building/Player/Wall/Zombie/Projectiles/Fog/Crosshair/DeadTraces`, `drawTower`, `fillPoly`, `roundRect`, `render` |
| 21 | `src/input.js` | Entrées (souris, molette, clavier) + formulaire démarrage | resize interne, listeners |
| 22 | `src/sound.js` | Sons (mp3 dans `assets/sounds/`, repli silencieux) | `playSound` |
| 23 | `src/main.js` | Logique par frame `update(dt)` + `loop()` | `update`, `loop` |

## État global : `G.state`

Schéma complet dans `src/state.js`. Champs clés :

- `player { x, y, face, moving, hp }` — position monde, orientation, vie
- `camera { x, y }`, `zoom`, `targetZoom`
- `mouse { sx, sy, wx, wy, inside }` — écran (s*) + monde (w*)
- `items[]`, `buildings[]`, `trees[]`, `walls[]`, `zombies[]`, `zombieGroups[]`, `deadTraces[]`, `graves[]` (tombes « rip - <nom> »), `ghost` (fantôme local après mort + Espace, `{x, y, bob}`)
- `bag { open, contents[] }`, `equipped` (nom arme ou null), `projectiles[]`
- `planks`, `inventory`, `shootCd`, `buildMode`, `plankRotation` (0=horizontal, 1=vertical)
- `axeEquipped` (bool), `chopTarget` (arbre visé ou null), `chopTimer` (accumulateur s)
- `clock` (0..24), `day`, `elapsed`, `nextWaveAt`, `waveActive`, `waveLeaveAt`
- `mairieGold` (or du coffre commun de la mairie), `scierieUnlocked`/`universiteUnlocked`/`montgolfiereUnlocked` (techs débloquées), `scierie`/`universite`/`montgolfiere` (bâtiments posés ou null), `pendingWave` (pré-tirage de la prochaine vague), `towers[]` (tours d'attaque), `buildSel` ("scierie" ou "tour:<niveau>"), `buildMenuOpen`, `vote` (vote tech en cours ou null), `voteCooldownUntil`

## Constantes importantes (`src/config.js`)

| Constante | Valeur | Sens |
|-----------|--------|------|
| `WORLD` | 20000 | Taille carte (px) — passée de 10000 à 20000, zombies aux frontières de l'ancienne carte (`WORLD_SPAWN`) |
| `WORLD_SPAWN` | 10000 | Rayon de spawn des zombies (frontières de l'ancienne carte) |
| `TOWN` | 1000 | Taille ville (px) |
| `PLAYER_W/H` | 6 / 15 | Sprite joueur (bâtiments ≤ `PLAYER_W*20` = 120 px) |
| `SPEED` | 260 | Vitesse joueur (px/s) |
| `FOG_RADIUS` | 200 | Visibilité hors ville (px) |
| `ZOMBIE_SPEED` | 90 | Vitesse de base, ± `ZOMBIE_SPEED_VAR` (0.35) par zombie ; bonus horde `ZOMBIE_HORDE_SPEED_BONUS` (0.18) |
| `ZOMBIE_PLAYER_DMG` | 20 | 5 coups = mort (100 PV) |
| `WALL_MAX_HP` | 100 | PV d'un mur |
| `PLAYER_MAX_HP` | 100 | PV joueur |
| `FOOD_HEAL` | 25 | PV restaurés par nourriture mangée |
| `DEAD_TRACES_MAX` | 500 | Traces de zombies morts conservées (les plus récentes) |
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
| `SCIERIE_COST` | 100 planches + 10 or | Tech scierie à la mairie (or : coffre commun, planches : poseur) |
| `SCIERIE_SIDE` | 64 | Taille de l'empreinte scierie (px) |
| `GOLD_ITEMS_START` | 100 | Pièces d'or posées hors ville au démarrage |
| `BIRD_GOLD_CHANCE` | 0.5 | Proba qu'un oiseau tué lâche une pièce d'or |
| `VOTE_DURATION` | 15 | Durée d'un vote tech (s) |
| `VOTE_COOLDOWN` | 30 | Cooldown après un vote refusé (s) |
| `TOWER_BUILD_TIME` | 10 | Chantier tour/scierie (s) |
| `TOWER_STATS` | — | Table des tours par niveau (`bois` : hp 500, dmg 25, portée 300, cd 1 s/côté, flèche 500 px/s, fog 300 px, coût 1 or + 20 planches). Un nouveau niveau (pierre, métal...) = une nouvelle entrée, tout le reste est automatique. |

## Boucle de jeu (`src/main.js`)

`loop(now)` → `update(dt)` → `render()`. `dt` plafonné à 0.1 s. `update` :

1. Avance `time`, lisse `zoom`, décrémente `shootCd`
2. Cycle jour/nuit (incrémente `clock`, `day`)
3. `updateZombies(dt)`
4. Déplacement joueur (suit la souris) si pas en bâtiment/pause/sac/game over
5. `handleShooting()` → `updateProjectiles(dt)` (tir désactivé en mode pose de planche)
6. `updateBuildSites(dt)` + `updateTowers(dt)` + `cleanupTowers()` (scierie & tours d'attaque)
7. `cleanupZombies()` + `cleanupWalls()` + `updateChop(dt)` (récolte hache)
8. Caméra suit le joueur
9. Refresh souris monde + `updateHud()`

## Textures (`src/textures/`)

Sprites pixel art et palettes de couleurs, isolés du rendu. Exposés sur `G.TEXTURES.<type>`.

| Fichier | Type | Contenu |
|---------|------|--------|
| `src/textures/index.js` | — | initialise `G.TEXTURES` |
| `src/textures/player.js` | joueur | sprite 6×15 + palette + ombre |
| `src/textures/zombie.js` | zombie | sprite 6×15 + palette + ombre |
| `src/textures/bird.js` | oiseau | sprite + palette |
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
- **Traces de zombies morts** → déposer des PNG dans `assets/sprites/zomb/dead/trace1.png`, `trace2.png`, ... (chargés auto, un tiré au hasard à chaque mort). Génération dans `cleanupZombies` (`src/zombies.js`), rendu `drawDeadTraces` (`src/render.js`, juste après `drawGround`). Plafond `G.DEAD_TRACES_MAX`.
- **Nouveau HUD canvas** → `src/hud.js`, appeler dans `render()` (`src/render.js`).
- **Nouvelle entrée clavier** → `src/input.js`.
- **Changer un sprite / une couleur** → `src/textures/<type>.js` uniquement (le rendu les consomme).
- **Nouveau système complet** → créer `src/<nom>.js`, l'ajouter à `index.html` avant `main.js`, exposer sur `G`, documenter ici.
- **Nouveau niveau de tour** (pierre, métal...) → ajouter une entrée dans `G.TOWER_STATS` (`src/config.js`) : menu de construction, chantier, combat, brouillard et rendu s'adaptent automatiquement. Fournir les PNG `assets/sprites/tour/{idle,chantier,gauche,droite}-N.png`.

## Villes décoratives PNG (`src/ville.js`)

Spec complète : `docs/ville.md`. En résumé :

1. **Assets** : chaque ville = `assets/sprites/ville/<nom>/ville.png` (ville visible) + `ville_mask.png` (même taille ; rouge = collision, vert = passage derrière, transparent = libre). Dessiné dans n'importe quel éditeur (Aseprite, GIMP, Photopea…), masque par calque par-dessus le PNG visible.
2. **Pose** : `G.VILLE_DEFS` (`src/config.js`) liste les villes `{ name, sprite, x, y }` — x/y = coin nord-ouest de l'emprise sol (losange iso, côté = largeur PNG × 2, même ancrage que les bâtiments). Première ville : **Ville de l'Est**, posée à l'est de la ville principale (6800, 4200).
3. **Collisions** : le masque est décodé une seule fois en grille de cellules 8 px (client : canvas ; serveur : `server/ville-grids.json` généré par `gen-sprite-meta.js` avec la **même fonction pure** → parité exacte). Cellules rouges : bloquent le joueur (`_stepMove`), les zombies (collisions locales + flow field `villeBlockNav`), la pose de planches/tours, et sont évitées par la génération (forêts, maisons, items via `villeAt`).
4. **Rendu/occlusion** : le PNG est découpé en bandes horizontales (~96 px) insérées dans le tri de profondeur `x+y` → le personnage passe devant/derrière chaque façade selon sa position, sans logique dédiée.
5. **Multi-villes** : déposer un dossier PNG dans `assets/sprites/ville/<nom>/` — le serveur le **détecte au démarrage** (`server/ville-sync.js`, appelé par `server/index.js`) : placement automatique sur un cercle autour de la ville principale si pas d'entrée `VILLE_DEFS` (position persistée dans `server/ville-positions.json`), régénération des grilles si le masque change, purge des villes disparues, et publication du manifeste client `assets/sprites/ville/villes.js` (fusionné dans `VILLE_DEFS` par `src/ville.js`, côté client comme côté serveur via `dom-stub.js`). Une entrée `VILLE_DEFS` manuelle reste prioritaire et force sa position.

## Bâtiments de ville & tours d'attaque (`src/towers.js`)

Spec complète : `docs/towers.md`. En résumé :

1. **Techs de bâtiments de ville** (scierie, université, montgolfière) au coffre de la mairie (section Technologies) : 100 planches + 10 or chacune. En solo achat direct ; en multi vote à la majorité stricte des connectés (15 s, initiateur compte « pour », refus → cooldown 30 s). L'or sort du coffre commun (`mairieGold`), les planches du joueur initiateur.
2. **Flux de construction** : touche **Z** → **menu de construction** (DOM) qui liste les bâtiments constructibles → clic sur un bâtiment → mode pose → clic sur la carte. Palissade toujours présente ; bâtiments de ville (scierie — empreinte 64 px, université et montgolfière — empreinte 40 px ; uniques, en ville, chantier 10 s) si leur tech est débloquée ; tours si la scierie est construite. Clic droit / Échap annule la sélection.
3. **Tour d'attaque** (`tour:<niveau>` dans le menu) : posable partout, empreinte = taille du PNG, chantier 10 s. Dès le début du chantier elle est attaquable (PV 500, dégradée comme une palissade).
4. **Combat** : chaque tour porte 2 archers (gauche/droite) indépendants. Ciblage par demi-espace (`z.x < tour.x` = gauche), zombie le plus proche à portée, cooldown 1 s/côté, flèche = trait noir non-perforant (`type:"fleche", owner:"tour"`), éjectée depuis les 10 % les plus hauts du PNG, passe au-dessus des palissades, ne touche jamais les joueurs.
5. **Rendu** (`drawTower` dans `src/render.js`) : PNG complet par côté (gauche/droite) découpé en moitiés disjointes au rendu → tirs simultanés sans recouvrement.
6. **Priorité zombies** : 1) palissade accessible, 2) tour accessible, 3) mairie/joueur.
7. **Brouillard** : chaque tour construite dégage un rayon de visibilité (`fogRadius`, 300 px) hors ville (`drawFog` multi-sources).
8. **Destruction** : aucune trace, son `tourCasse` (`assets/sounds/`), aucun remboursement.
9. **Université** : posable/cliquable, placeholder prêt pour de futures améliorations (fenêtre dédiée).
10. **Montgolfière** (centre de décollage) : au clic, annonce le volume et la direction de la prochaine vague (pré-tirage `G.rollWave` chaque matin dans `pendingWave`, consommé par `spawnWave`).

Assets attendus (repli sans eux) : `assets/sprites/tour/{idle,chantier,gauche,droite}-N.png`, `assets/sprites/{scierie,universite,montgolfiere}/{idle,chantier}-N.png`, `assets/sounds/tourCasse.mp3`.

## Specs détaillées par système

Voir `docs/` : une spec courte par système (contrats, entrées/sorties, contraintes).

## Leçons de bugs récents (à ne pas reproduire)

- **Occlusion villes** : le PNG visible est découpé en **bandes horizontales** insérées dans le tri `x+y` ; seule la partie **verte** du masque occlut le joueur (le transparent reste derrière). L'occlusion se teste **par bande à la résolution du masque**, avec le biais calculé **avant** la boucle des bandes (bug de hoisting déjà corrigé).
- **Collisions villes** : c'est le **masque entier qui compte** (élévation incluse), pas seulement l'emprise au sol — sinon le joueur traverse les façades hautes. Le filtre de sol doit être **carré**, pas losange (L1) — le losange ignorait le bas du PNG.
- **`hitsObstacle` récursif** : toujours itératif ou borné (stack overflow en prod avec les forêts denses).
- **Prod (`/opt/flex` possédé par root)** : `git` exige `safe.directory` passé **par appel** ; `ville-sync` doit tolérer les dépôts en **lecture seule** (EACCES) et le redémarrage doit tolérer les erreurs.
- **Villes déposées** : détection par dossier, **dédoublonnage par contenu**, placement auto sur cercle (`VILLE_AUTO_DIST` 1500) — positions persistées dans `server/ville-positions.json`, signatures de grilles dans `server/ville-grids-sigs.json` (ne pas committer un changement de date seul).
- **Parité client/serveur** : les grilles de collision sont générées par la **même fonction pure** (`gen-sprite-meta.js`) des deux côtés — toute divergence casse le multi.

## Mode multijoueur (client-serveur)

Le jeu fonctionne en mode **client-serveur** : un serveur Node.js héberge une **partie unique** (max 20 joueurs), les clients se connectent en WebSocket et ne font que le rendu + envoi des inputs. Le serveur est **autorité** sur la simulation (déplacement, collisions, zombies, projectiles, mairie, récolte, vagues, game over).

**Écran d'accueil** (`index.html` #startScreen, logique dans `src/input.js`) : le mode **multijoueur (serveur) est sélectionné par défaut** — connexion + lobby dès l'ouverture du menu, le joueur peut basculer sur Solo. La page intègre un **guide visuel** (`#menuGuide`) : cartes sprite + fonction pour chaque bâtiment (mairie, église, scierie, marché, université, montgolfière, tour d'attaque, palissade), les forêts (récolte/états de coupe), la vague nocturne (zombie dessiné depuis `G.TEXTURES.zombie` sur le canvas `#guideZombie`) et la tour de siège. Les images pointent directement vers `assets/sprites/…` — mêmes visuels que dans le jeu.

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
| `G.netInput(input)` | Envoie un input (`dx,dy,fire,build,buildWall,aimX,aimY,pickup,equip,toggleAxe,rotate`, et `techVote`, `buildSel`, `placeBuild` pour la scierie/tours) |
| `G.netHandle(msg)` | Traite `lobby` / `joined` / `state` / `restart` / `full` |
| `G.applyRemoteState(s)` | Applique l'état serveur au state local (interpolation position joueur, sac, équipement, planches) |
| `G.updateLobbyDisplay()` | Affiche le lobby dans le menu d'accueil (heure, joueurs connectés, statut) |

### Cycle de vie de la partie (serveur)

1. **Aucun joueur connecté** → partie arrêtée (en attente).
2. **Un joueur rejoint** → compte à rebours de **30 s** avant le lancement (visible dans le lobby).
3. **Partie lancée** → simulation active, vagues de zombies la nuit, mairie attaquable.
4. **Mairie détruite (PV ≤ 0)** → game over, redémarrage auto après 10 s si des joueurs sont présents.
5. **Places** : max 20, libérées à la déconnexion (non réservées).
6. **Redémarrage du serveur** : l'état est en mémoire → la partie repart à zéro, tous les clients sont déconnectés. Chaque boot porte un `bootId` (diffusé dans le lobby + `/version.json`) ; un client qui revient avec un `rejoin` périmé reçoit `sessionInvalid` et **recharge la page** (pas de reprise de session). Le cache PNG est auto-rafraîchi : la clé `?v=` = commit + `assetsStamp` (nb de fichiers + mtime la plus récente sous `assets/`), donc un PNG modifié/ajouté **sans commit** invalide le cache navigateur tout seul (test `loopback/redemarrage_serveur.js`).
7. **Fermeture de la fenêtre client** : un close WS **1001** (fermeture propre de l'onglet/fenêtre, navigation) → **déconnexion immédiate** du joueur (pas de grâce). Seules les coupures **brutales** (1006 réseau/WiFi, 1000 watchdog, `leave` explicite) gardent la grâce de reconnexion 30 s pour le `rejoin` (test `loopback/fermeture_fenetre.js`).

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
