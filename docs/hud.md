# HUD & overlays — `src/hud.js`

## Contrat
Met à jour le HUD DOM et dessine les overlays canvas (horloge, barre de vie joueur, hint de construction, game over). Dépend de `config.js`, `state.js`, `projection.js` (`proj`), **et des textures `G.TEXTURES.playerHpBar`/`clock`/`buildHint`/`gameOver`** (`src/textures/hud.js`). Couleurs et dimensions viennent des textures, pas du code.

## Exposé sur `G`
- `updateHud()` — met à jour les éléments DOM : nom, zone, position, inventaire, arme, PV, planches
- `drawClock()` — horloge jour/nuit ☀/🌙 en haut centre + "⚠ Vague de zombies" si vague active + "Jour N" en haut à droite
- `drawPlayerHpBar()` — barre de vie au-dessus du joueur (couleur selon ratio)
- `drawBuildHint()` — rectangle pointillé au curseur en mode construction (vert/rouge selon planches)
- `drawGameOver()` — écran de mort (jour survécu + invite recharger)

## Contraintes
- `updateHud` est appelé à chaque frame (dans `update`) ; les `draw*` canvas dans `render`.
- Couleurs de vie : <30% rouge, <60% orange, sinon vert (même logique murs/zombies).

## Étendre
- **Nouvel indicateur** : ajouter une `drawXxx` et l'appeler dans `render`.
- **Nouveau champ HUD DOM** : ajouter l'élément dans `index.html`, la réf dans `state.js`, la mise à jour dans `updateHud`.
