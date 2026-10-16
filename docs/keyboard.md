# Clavier ZQSD — `src/keyboard.js`

## Contrat

Version « manette clavier » du jeu, pour les joueurs qui n'arrivent pas à jouer au trackpad (le mode par défaut Espace+souris exige un clic maintenu précis). **DÉSACTIVÉ PAR DÉFAUT** : un bouton « ⌨️ Clavier » en haut à droite (à côté du bouton 📱 Mobile) l'active/désactive ; le choix est persisté (`localStorage.flexKeyboardMode`). Calqué sur `src/touch.js` : le module écrit dans `state.keys` / `state.mouse` / `actionHeld`, aucune autre couche du jeu n'est modifiée.

## Commandes (une fois activé)

- **ZQSD / flèches** : déplacement direct du personnage (direction écran → monde : `wx = x + 2y`, `wy = 2y − x`). Aucune touche enfoncée = personnage immobile (`keys.space = false`).
- **Espace** : tir maintenu vers la souris (`actionHeld`, comme le clic gauche) — le `keydown` Espace de `input.js` n'arme plus `keys.space` dans ce mode.
- **B** : menu / mode planche (Z sert à MONTER, il ne bascule plus le mode planche).
- **R** : rotation de la palissade en mode pose (équivalent clavier de la molette).
- **Mode build** : les touches de déplacement pilotent AUSSI le rectangle de pose (`drawBuildHint` suit `mouse.wx/wy`, placés dans la direction enfoncée ou la dernière direction) ; **Espace** pose (front montant uniquement, pas de répétition auto) la palissade (`tryBuildWall` / `_buildWall` en ligne) ou le bâtiment sélectionné (`placeFromBuildMenu` / `_placeBuild`).

## Comportement

- `G.keyboardUpdate()` est appelé chaque frame avant la simulation (branché dans `main.js` aux côtés de `G.touchUpdate`).
- Bloqué hors partie / pause / bâtiment / menus / saisie chat, comme le reste des entrées.
- `G.setKeyboardMode(on)` met à jour le bouton, l'aide des commandes (`#hudHintBlock` dans `index.html`, re-généré par `refreshHints`) et coupe `actionHeld` à la désactivation.
- Le hint de pose canvas (`src/hud.js` `drawBuildHint`) affiche « R = rotation » quand le mode est actif.

## Contraintes

- Aucune couche de simulation ne doit lire ce module : tout passe par `state` (parité serveur intacte — `server/game.js` ne charge pas ce fichier, DOM-only).
- Le mode trackpad (Espace = avancer) reste intact tant que le mode clavier est OFF ; les deux modes (mobile + clavier) peuvent cohabiter.

## Tester

`test/menu/keyboard_mode.js` (stub DOM, même squelette que `touch_mode.js`) : OFF par défaut, bouton, aide dynamique, ZQSD/flèches, immobile à l'arrêt, tir Espace, pose build pilotée par les touches, Z = monter (pas le menu planche), désactivation.
