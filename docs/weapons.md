# Armes & projectiles — `src/weapons.js`

## Contrat
Stats de l'arme équipée, tir du joueur, déplacement des projectiles et collisions avec zombies. Dépend de `config.js` (`WEAPON_STATS`, `PLAYER_H`), `state.js`. Appelé depuis `update()` (`src/main.js`).

## Exposé sur `G`
- `equippedStats()` → stats de l'arme équipée (ou "Mains nues" par défaut)
- `handleShooting()` — tire si `state.keys.space` et `shootCd <= 0`, en respectant bloqueurs (bâtiment/pause/sac/game over). **Ne décrémente pas `shootCd`** (fait dans `update`).
- `updateProjectiles(dt)` — déplace les projectiles, gère la traîne, teste collision (rayon 14 px) avec zombies, retire hors-monde/vie-finie.

## Projectile
`{ x, y, vx, vy, life, dmg, color, trail[] }`. Limite de 120 projectiles simultanés (FIFO).

## Contraintes
- Le tir utilise la position souris monde (`state.mouse.wx/wy`) comme cible ; dispersion appliquée sur l'angle.
- `shootCd` est décrémenté **une seule fois** par frame (dans `update`), `handleShooting` ne le touche pas.

## Étendre
- **Nouvelle arme** : ajouter dans `WEAPON_STATS` (`config.js`). C'est tout.
- **Munitions** : ajouter `state.ammo[arme]` et le décrémenter dans `handleShooting`.
- **Tir chargé / rechargement** : ajouter un état de rechargement et un `reloadCd`.
- **Projectiles perforants** : ne pas `break` après le premier zombie touché dans `updateProjectiles`.
