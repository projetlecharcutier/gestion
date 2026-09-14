# Zombies — `src/zombies.js`

## Contrat
Vagues nocturnes, organisation en petits groupes qui fusionnent, IA (cible joueur/mur, attaque), nettoyage des morts. Dépend de `config.js` (toutes les constantes `ZOMBIE_*`, `GROUP_*`), `state.js`, `walls.js` (`aabbHitsWalls`). Appelé depuis `update()` (`src/main.js`).

## Exposé sur `G`
- `spawnWave()` — crée `count = ZOMBIE_PER_WAVE_BASE * 2^day` zombies (50 à la 1ère vague, +100% chaque nuit) répartis en groupes (`GROUP_SIZE`) le long d'un côté de la ville. Stocke `state.waveCount`.
- `mergeGroups()` — fusionne les groupes dont les leaders sont à moins de `GROUP_MERGE_DIST` (toutes les `GROUP_MERGE_INTERVAL` s)
- `updateZombies(dt)` — gestion des vagues (spawn/leave), fusion périodique, IA : chaque groupe choisit joueur (si à `ZOMBIE_ATTACK_RANGE`) sinon mur le plus proche ; leader avance, membres suivent leur slot en formation
- `cleanupZombies()` — retire les zombies `hp <= 0` (de leur groupe) et les groupes vides. Appelé chaque frame.

## Structure
- Groupe : `{ x, y, members[] }` — `x,y` = position du leader
- Zombie : `{ x, y, hp, atkCd, wallCd, group, slotAng, slotDist }`

## Règles clés
- Vague toutes les `WAVE_EVERY` (7 min), repartent après `WAVE_LEAVE` (10 min).
- Taille : `ZOMBIE_PER_WAVE_BASE` (50) × `ZOMBIE_WAVE_GROWTH`^(jour) → 50, 100, 200, 400… Le HUD affiche le compteur `Zombies : vivants / total`.
- Cible : joueur si `distP < ZOMBIE_ATTACK_RANGE` (150), sinon **Mairie** (centre-ville) ; attaquent aussi un mur rencontré sur le chemin (< 60 px). Si la Mairie tombe à 0 PV → `gameOver` (`gameOverCause: "mairie"`).
- Dégâts joueur : `ZOMBIE_PLAYER_DMG` (20) → 5 coups = mort. Dégâts mur/mairie : `ZOMBIE_WALL_DMG` (5) toutes les `ZOMBIE_WALL_CD` (20 s).
- Zombies 2× plus lents que le joueur (`ZOMBIE_SPEED = SPEED/2`).
- **Collisions planches** : le déplacement de chaque zombie teste `aabbHitsWalls` par axe (boîte `ZOMBIE_W`), donc les planches posées par le joueur (`built: true`) bloquent les zombies. Le mur de périmètre reste traversable.

## Comportement de déplacement (mouvement vivant)
Chaque zombie porte un caractère propre (init à l'apparition, champs sur `z`) :
- `speedFactor` ∈ [`1-ZOMBIE_SPEED_VAR`, `1+ZOMBIE_SPEED_VAR`] (clampé 0.4–1.6) — vitesse relative, certains traînent, d'autres sont plus rapides.
- `wanderPhase`/`wanderFreq` — oscillation lente du cap autour de la direction cible ("drunken walk"), amplitude `ZOMBIE_WANDER_AMP` (ratio de cap).
- `hesitate` (s) — décompte d'une pause en cours (0 = aucun) ; démarre aléatoirement (`ZOMBIE_HESITATE_RATE` proba/s, durée `ZOMBIE_HESITATE_TIME`).
- `blockedSides` — compteur de blocages murs consécutifs, déclenche le contournement.

Règles de mouvement :
- En hésitation, le zombie ne se déplace pas.
- Sinon, le cap = direction cible + sinusoïde propre au zombie ; vitesse = `ZOMBIE_SPEED * speedFactor`.
- **Contournement des murs** : si bloqué par une planche, le zombie glisse le long du mur (biais latéral `ZOMBIE_WALL_SLIDE`, côté alterné dans le temps) au lieu de s'enliser.
- **Attraction par le bruit** : un tir nouvellement apparu attire les groupes à moins de `ZOMBIE_NOISE_RANGE` pendant `ZOMBIE_NOISE_TIME` s vers la position du tir (sans écraser un joueur proche ni un mur immédiat). Détecté via `state.lastShot` (diff du compteur `state._prevProjN`).

Constantes associées (`src/config.js`) : `ZOMBIE_SPEED_VAR`, `ZOMBIE_WANDER_AMP`, `ZOMBIE_WANDER_FREQ`, `ZOMBIE_HESITATE_TIME`, `ZOMBIE_HESITATE_RATE`, `ZOMBIE_NOISE_RANGE`, `ZOMBIE_NOISE_TIME`, `ZOMBIE_WALL_SLIDE`.

## Comportement d'attaque
Chaque zombie porte un rôle d'attaque (init à l'apparition) :
- `harasser` (bool, ~`ZOMBIE_HARASS_RATIO`) — éclaireur qui se détache du groupe pour traquer le joueur seul s'il le détecte à `ZOMBIE_HARASS_RANGE` (escouade divergente).
- `raider` (bool, ~`ZOMBIE_RAIDER_RATIO`) — pilleur ; si un groupe en contient (`grp.hasRaider`), il dévie sa cible vers les planches construites par le joueur (`built`) à `ZOMBIE_RAID_RANGE` plutôt que la mairie.
- `lunge`/`lungeDx`/`lungeDy` — télégraphie d'attaque : élan visuel vers l'avant pendant `ZOMBIE_LUNGE_TIME` après un coup (rendu dans `drawZombie`).

Règles d'attaque :
- Un zombie à moins de 14 px de sa cible frappe (joueur → `ZOMBIE_PLAYER_DMG` ; mur/mairie → `ZOMBIE_WALL_DMG` + bonus de meute).
- **Lunge** : chaque coup déclenche un élan visuel (`z.lunge`) dans la direction de la cible.
- **Attaque de meute** : les dégâts aux murs/mairie augmentent d'un bonus par assaillant voisin (`swarmBonus`, grille spatiale), capé à `ZOMBIE_SWARM_CAP` assaillants × `ZOMBIE_SWARM_BONUS` — impression de coups frappés ensemble.
- **Pilleurs** : un groupe avec `hasRaider` cible les planches `built` à portée au lieu de la mairie (menace le travail du joueur).
- **Harceleurs** : un `harasser` surcharge sa cible par le joueur dès qu'il est à `ZOMBIE_HARASS_RANGE`, indépendamment de la cible du groupe.

Rendu (`src/render.js`) : `drawZombie` applique un offset de lunge au sprite (penche vers l'avant au-dessus de son ombre) pendant `z.lunge > 0`. En multijoueur, `lunge`/`lungeDx`/`lungeDy` sont transmis dans le snapshot zombie (`server/game.js`).

Constantes associées (`src/config.js`) : `ZOMBIE_LUNGE_TIME`, `ZOMBIE_LUNGE_VIS`, `ZOMBIE_HARASS_RATIO`, `ZOMBIE_HARASS_RANGE`, `ZOMBIE_SWARM_BONUS`, `ZOMBIE_SWARM_CAP`, `ZOMBIE_SWARM_RADIUS`, `ZOMBIE_RAIDER_RATIO`, `ZOMBIE_RAID_RANGE`.

## Comportement de rassemblement
Chaque groupe porte une `formation` (0=anneau, 1=ligne, 2=coin, 3="V") tirée au sort à l'apparition, et un `formPhase` (décalage angulaire). La position de slot de chaque membre est calculée par `G.zombieSlot(grp, i, n)` selon la formation et le mode du groupe.

Champs de groupe : `formation`, `formPhase`, `isHorde`, `retreat`, `hordeMsgShown`.
Champs de zombie (rassemblement) : `slotAng`/`slotDist` (position actuelle, animée), `slotAngT`/`slotDistT` (cible), `isLeader` (index 0 du groupe).

Règles :
- **Formations variées** : anneau, ligne, coin ou "V" selon le groupe ; à la fusion, une nouvelle formation est tirée et les cibles de slots sont recalculées.
- **Hiérarchie visible (leader)** : le zombie d'index 0 (`isLeader`) est rendu plus gros et teinté (rouge/sang) dans `drawZombie` — objectif tactique. À sa mort, le suivant prend le relais. En multijoueur, `leader` est transmis dans le snapshot.
- **Fusion animée** : après une fusion, les slots convergent vers les nouvelles cibles via un lerp (`ZOMBIE_SLOT_LERP`) plutôt que d'être instantanés.
- **Mode horde** : un groupe de `≥ ZOMBIE_HORDE_THRESHOLD` membres devient une horde — formation resserrée (`ZOMBIE_HORDE_DENSE`), vitesse accrue (`ZOMBIE_HORDE_SPEED_BONUS`) et message HUD "La horde arrive !" (`state.hordeMsgTimer`).
- **Dispersion à la retraite** : en mode retraite, les slots s'élargissent (`ZOMBIE_RETREAT_SLOT_SCALE`) avec du bruit (`ZOMBIE_RETREAT_SLOT_NOISE`) — la horde se disperse au lever du jour.

Rendu (`src/render.js`) : `drawZombie` agrandit et teinte le leader. HUD (`src/hud.js`) : message horde. Multijoueur : `hordeMsgTimer` et `leader` transmis dans le snapshot (`server/game.js`), appliqués côté client (`src/net.js`).

Constantes associées (`src/config.js`) : `ZOMBIE_HORDE_THRESHOLD`, `ZOMBIE_HORDE_SPEED_BONUS`, `ZOMBIE_HORDE_DENSE`, `ZOMBIE_SLOT_LERP`, `ZOMBIE_RETREAT_SLOT_SCALE`, `ZOMBIE_RETREAT_SLOT_NOISE`.

## Étendre
- **Variante de zombie** : ajouter un `z.kind`/`z.variant` et brancher dans `updateZombies` + `drawZombie`.
- **Zombie plus résistant** : augmenter `z.hp` à l'apparition et gérer plusieurs PV dans `updateProjectiles` (déjà `- pr.dmg`).
- **Pathfinding** : remplacer la ligne droite leader→cible par un contour des murs.
- **Boss** : groupe singleton avec plus de PV et stats spéciales.
