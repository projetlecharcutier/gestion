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

## Étendre
- **Variante de zombie** : ajouter un `z.kind`/`z.variant` et brancher dans `updateZombies` + `drawZombie`.
- **Zombie plus résistant** : augmenter `z.hp` à l'apparition et gérer plusieurs PV dans `updateProjectiles` (déjà `- pr.dmg`).
- **Pathfinding** : remplacer la ligne droite leader→cible par un contour des murs.
- **Boss** : groupe singleton avec plus de PV et stats spéciales.
