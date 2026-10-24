# Transition de jour (`src/jour.js`)

Au passage de minuit (`state.day` change — moment de la régénération des
forêts, `regenForets`, qui peut freezer une frame), tout l'écran passe au
noir quelques secondes avec « Jour N » et une phrase de palier. Le petit
freeze de minuit devient un moment de jeu au lieu d'un bug visible.

## Contrat

- `G.updateJour(dt)` — appelé chaque frame par `main.js` (solo ET multi :
  le serveur est autorité sur `state.day`, mis à jour par `applyRemoteState`
  à 10 Hz). Au premier appel d'une partie (`state.lastJourShown == null`),
  initialisation **silencieuse** (pas d'écran au lancement/join). À chaque
  changement de `state.day` ensuite : arme le timer `G.JOUR_SCREEN_TIME`.
- `G.drawJour()` — appelé en **dernier** dans `render()` (par-dessus
  l'HUD et l'écran de mort) : voile noir avec fondu symétrique
  (`G.JOUR_FADE` entrée/sortie), titre « Jour N » or + ombre portée pixel
  (style du menu), phrase de palier en dessous.
- `G.jourQuote(day)` — phrase du jour : **déterministe** (palier le plus
  élevé atteint, rotation par numéro de jour — tous les clients affichent
  la même phrase le même jour).

## Paliers de phrases (`G.JOUR_QUOTES`)

Univers : zombie, Normandie (parler normand, cidre, brouillard, fange,
cloches), pixel art. Paliers : 2, 4, 7, 10, 15, 21, 30, 50 jours — 4 phrases
chacun, rotation déterministe. Pour ajouter un palier : pousser
`{ from: N, lines: [...] }` dans le tableau (garder `from` croissant).

## Contraintes

- Module **client uniquement** : `index.html` le charge ; le serveur ne le
  charge pas (pas de simulation, aucun effet gameplay — l'écran ne pause
  rien, la nuit continue dessous).
- `state.lastJourShown` est propre à ce module : ne pas le confondre avec
  `state.lastDay` (serveur, déclenche `regenForets`).
- L'écran ne s'affiche **pas** au lancement/join (première init
  silencieuse), ni pendant `gameOver`.

## Étendre

- **Nouveau palier** : ajouter à `G.JOUR_QUOTES` (test : toute journée
  2..N a une phrase non vide et déterministe).
- **Changer la durée** : `G.JOUR_SCREEN_TIME` (s), `G.JOUR_FADE` (s de
  fondu). 3.2 s / 0.5 s par défaut.

## Tests

`test/menu/jour_transition.js` : init silencieuse au premier jour, armement
au changement de jour, voile + titre + phrase dessinés, fin après le timer,
phrases déterministes sur tous les jours 2..60, pas d'écran en `gameOver`,
branchement vérifié dans `main.js`/`render.js`/`index.html`.
