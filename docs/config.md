# Config & constantes — `src/config.js`

## Contrat
Expose toutes les constantes du jeu et des helpers mathématiques/temporels sur `window.GAME`. **Aucune logique de jeu**, uniquement des valeurs et fonctions pures.

## Exposé sur `G`
- Dimensions : `WORLD`, `TOWN`, `TOWN_MIN`, `TOWN_MAX`
- Joueur : `PLAYER_W`, `PLAYER_H`, `PLAYER_HALF`, `SPEED`, `FOG_RADIUS`, `TS` (taille tuile)
- Armes : `WEAPON_STATS` — `{ nom: { speed, life, cd, dmg, color, spread, label } }`
- Cycle jour/nuit & zombies : `DAY_SECONDS`, `NIGHT_SECONDS`, `CYCLE_SECONDS`, `WAVE_EVERY`, `WAVE_LEAVE`, `ZOMBIE_SPEED`, `ZOMBIE_ATTACK_RANGE`, `ZOMBIE_PLAYER_DMG`, `ZOMBIE_WALL_DMG`, `ZOMBIE_WALL_CD`, `ZOMBIE_ATTACK_CD`, `ZOMBIE_HP`, `ZOMBIE_PER_WAVE_BASE`
- Murs : `WALL_MAX_HP`, `WALL_PLANKS`, `WALL_BUILD_RANGE`, `PLAYER_MAX_HP`
- Planches : `PLANK_LONG` (120), `PLANK_THICK` (24) — dimensions d'une planche posée
- Récolte hache : `TREE_CHOP_TIME` (4 s), `AXE_RANGE` (120 px)
- Groupes zombies : `GROUP_SIZE`, `GROUP_FORMATION`, `GROUP_MERGE_DIST`, `GROUP_MERGE_INTERVAL`
- Helpers : `isNight(clock)` (22h–02h), `rand(min,max)`, `randi(min,max)`, `clamp(v,a,b)`

## Étendre
- **Nouvelle arme** : ajouter une entrée à `WEAPON_STATS`. Automatiquement prise en compte par le tir, le sac et l'affichage des stats.
- **Nouvelle constante d'équilibrage** : l'ajouter ici, pas en dur dans un autre fichier.
