# Récolte de planches (hache) — `src/chop.js`

## Contrat
Récolte de planches : avec une hache équipée, rester à côté d'un arbre pendant `TREE_CHOP_TIME` secondes donne 1 planche et fait disparaître l'arbre. Dépend de `config.js` (`TREE_CHOP_TIME`, `AXE_RANGE`), `state.js` (`player`, `trees`, `planks`, `axeEquipped`, `chopTarget`, `chopTimer`), `hud.js` (`updateHud`). Appelé chaque frame depuis `update()` (`src/main.js`).

## Exposé sur `G`
- `updateChop(dt)` — appelé chaque frame depuis `update()`. Gère le décompte de récolte.
- `chopProgress()` — ratio d'avancement `0..1` pour le cercle de décompte, ou `-1` si inactif (consommé par `src/hud.js` `drawChopProgress`).

## Logique
1. Garde : si `!started || paused || gameOver || inBuilding || bag.open || !axeEquipped` → réinitialise `chopTarget`/`chopTimer` et retourne.
2. Trouve l'arbre le plus proche à `< AXE_RANGE` du joueur (`nearestChoppableTree()`).
   - Aucun arbre → réinitialise et retourne.
3. Si l'arbre visé change (`chopTarget !== target`) → relance le décompte (`chopTimer = 0`).
4. Accumule `chopTimer += dt`.
5. À `chopTimer >= TREE_CHOP_TIME` : `planks += 1`, retire l'arbre de `state.trees`, réinitialise `chopTarget`/`chopTimer`, rafraîchit le HUD.

## Contraintes
- La hache est un objet `kind:"outil"`, équipé via le sac (`src/bag.js`) → booléen `state.axeEquipped`.
- Pas de combat : la hache ne sert qu'à la récolte (n'affecte pas le tir).
- 1 planche par arbre, 4 s par arbre.
- Le décompte se réinitialise si le joueur s'éloigne de tous les arbres ou change de cible.

## Étendre
- **Arbre à plusieurs planches** : ajouter un champ `tree.yield` et l'utiliser au lieu de `+1`.
- **Différentes haches** : remplacer le booléen `axeEquipped` par une référence d'objet et ajuster `AXE_RANGE`/`TREE_CHOP_TIME` selon la hache.
- **Coupure instantanée** : exposer une fonction de récolte directe et l'appeler depuis un clic.
