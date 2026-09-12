# Boucle principale — `src/main.js`

## Contrat
Logique par frame `update(dt)` et boucle `loop(now)`. Doit être chargé en **dernier** (tous les systèmes exposés avant). C'est le chef d'orchestre de la simulation.

## Exposé sur `G`
- `update(dt)` — toute la logique par frame (hors dessin)
- `loop(now)` — boucle `requestAnimationFrame` (privée mais lancée au chargement)

## `update(dt)` étape par étape
1. `state.time += dt` ; lissage `zoom` vers `targetZoom` ; décrémente `shootCd`
2. Si non paused/gameOver : `elapsed += dt` ; `clock` avance (`12/DAY_SECONDS * dt`) ; rollover 24h → `day++`
3. `updateZombies(dt)` (sauf gameOver)
4. Déplacement joueur suit la souris si `mouse.inside && dist>5` et non bloqué (bâtiment/pause/sac/gameOver) ; met à jour `face`
5. `handleShooting()` → `updateProjectiles(dt)`
6. `cleanupZombies()` + `cleanupWalls()`
7. Caméra interpole vers le joueur (`dt*6`)
8. Refresh souris monde (zoom a changé) + `updateHud()`

## `loop(now)`
- `dt = (now - last)/1000`, plafonné à 0.1 s (évite les grands sauts après tab inactif)
- Si `started` → `update(dt)` ; toujours `render()` ; `requestAnimationFrame(loop)`

## Contraintes
- `update` ne dessine rien ; `render` ne simule rien. Séparation stricte.
- `shootCd` est décrémenté **une fois** ici, pas dans `handleShooting`.

## Étendre
- **Nouveau système à tick** : ajouter son appel dans `update` (ex. `G.updateX(dt)`), entre les étapes existantes selon l'ordre logique.
- **Pause d'un système** : le garder sous la même garde `!paused && !gameOver` que le reste.
- **Tick fixe** : si besoin d'un pas fixe, découper `dt` en sous-pas avant d'appeler la simulation.
