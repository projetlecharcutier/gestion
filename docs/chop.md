# Récolte de planches (hache) — `src/chop.js`

## Contrat
Récolte de planches : avec une hache équipée, rester à côté d'une forêt pendant `TREE_CHOP_TIME` secondes donne `FORET_PLANKS_PER_CHOP` (4) planches et fait avancer la forêt d'un état de coupe. La forêt a `FORET_STAGES` (5) états (s0 = pleine → s4 = entièrement coupée) ; à l'état final elle n'est plus récoltable et devient traversable. Chaque jour écoulé, la forêt regagne un état (`G.regenForets`). Dépend de `config.js` (`TREE_CHOP_TIME`, `AXE_RANGE`, `FORET_STAGES`, `FORET_PLANKS_PER_CHOP`), `state.js`, `hud.js`. Appelé chaque frame depuis `update()` (`src/main.js`).

## Exposé sur `G`
- `updateChop(dt)` — appelé chaque frame depuis `update()`. Gère le décompte de récolte.
- `chopProgress()` — ratio d'avancement `0..1` pour le cercle de décompte, ou `-1` si inactif (consommé par `src/hud.js` `drawChopProgress`).

## Logique
1. Garde : si `!started || paused || gameOver || inBuilding || bag.open || !axeEquipped` → réinitialise `chopTarget`/`chopWall`/`chopTimer` et retourne. Clic relâché (`!actionHeld`) → même réinitialisation complète (sinon le serveur ré-armait `chopStartedAt` en boucle et le client rejouait l'animation de hache + le cercle après un coup fini).
2. Trouve l'arbre le plus proche à `< AXE_RANGE` du joueur (`nearestChoppableTree()`).
   - Aucun arbre → réinitialise et retourne.
3. Si l'arbre visé change (`chopTarget !== target`) → relance le décompte (`chopTimer = 0`).
4. Accumule `chopTimer += dt`.
5. À `chopTimer >= TREE_CHOP_TIME` : `planks += FORET_PLANKS_PER_CHOP` (4), `foretStage += 1` sur la forêt. Si `foretStage >= FORET_STAGES-1` la forêt devient non récoltable et traversable (grille de collision reconstruite). Réinitialise `chopTarget`/`chopTimer`, rafraîchit le HUD.

## Contraintes
- La hache est un objet `kind:"outil"`, équipé via le sac (`src/bag.js`) → booléen `state.axeEquipped`.
- Pas de combat : la hache ne sert qu'à la récolte (n'affecte pas le tir).
- 4 planches par coup de hache (`FORET_PLANKS_PER_CHOP`), 1 coup = `TREE_CHOP_TIME` secondes.
- 5 états de coupe (`FORET_STAGES`) ; l'état final est non récoltable + traversable.
- Régénération : 1 état regagné par jour écoulé (`G.regenForets`).
- Le décompte se réinitialise si le joueur s'éloigne de tous les arbres ou change de cible.

## Étendre
- **Arbre à plusieurs planches** : ajouter un champ `tree.yield` et l'utiliser au lieu de `+1`.
- **Différentes haches** : remplacer le booléen `axeEquipped` par une référence d'objet et ajuster `AXE_RANGE`/`TREE_CHOP_TIME` selon la hache.
- **Coupure instantanée** : exposer une fonction de récolte directe et l'appeler depuis un clic.
