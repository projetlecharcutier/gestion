# Ville Isométrique

Un jeu d'aventure isométrique (vue de haut) jouable dans un navigateur, en HTML/CSS/JavaScript natif (aucune dépendance).

## Lancer le jeu

Ouvrez `index.html` dans un navigateur récent (Chrome, Firefox, Edge, Safari).

## Comment jouer

- Au démarrage, entrez votre nom.
- Vous apparaissez au centre d'une carte de **100 000 × 100 000 px**.
- Au centre se trouve une **ville de 5 000 × 5 000 px** (bâtiments plus petits).
- **Déplacement** : le personnage suit la souris.
- **Tir** : appuyez sur **Espace** (le tir va vers la souris).
- **Sac** : appuyez sur **A** pour ouvrir/fermer le sac. Les **objets et armes** ramassés au sol y sont rangés.
- **Armes & tir** : dans le sac, **cliquez sur une arme** pour l'équiper (recliquez pour la déséquiper). L'arme équipée modifie le tir :
  - **Mains nues** : dégâts 1, portée ~600, cadence ~3,3/s, dispersion 10 %.
  - **Pistolet** : dégâts 2, portée ~1080, cadence ~4,5/s, dispersion 3 %.
  - **Fusil** : dégâts 5, portée ~2240, cadence ~2,2/s, dispersion 1 %.
  - **Arc** : dégâts 3, portée ~1400, cadence ~2,5/s, dispersion 2 %.
  - **Couteau** : dégâts 2, portée ~208, cadence 4/s, dispersion 0 %.
  - **Bâton** : dégâts 3, portée ~544, cadence 2/s, dispersion 6 %.
  L'arme équipée s'affiche dans le HUD en haut à gauche.
- **Zoom / dézoom** : molette de la souris.
- **Pause** : touche **Échap**.
- **Bâtiments** : cliquez sur la **porte** d'un bâtiment (quand vous êtes à proximité) pour y entrer ; cliquez sur **Sortir** pour ressortir.
- **Objets & armes** : cliquez sur un objet/une arme au sol (à proximité) pour le/la ramasser ; il/elle va dans le sac.
- **Arbres** : quelques arbres en ville, beaucoup d'arbres (forêt) en dehors de la ville.
- **Collisions** : le personnage est bloqué par les murs des bâtiments.
- **Brouillard de guerre** : dans la ville, tout est visible ; hors de la ville, vous ne voyez qu'à **200 px** autour du personnage.

## Caractéristiques

- Personnage pixelisé : **6 px de large × 15 px de haut**.
- Rendu très pixelisé (zoom par défaut plus important).
- Projection isométrique (vue de haut), caméra qui suit le joueur.
- Bâtiments en 3D isométrique avec toit et porte (échelle réduite avec la ville).
- Objets et armes au sol ramassables, rangés dans le sac.
- Arbres (forêt dense hors ville, quelques-uns en ville).

## Fichiers

- `index.html` — page et écrans (nom, pause, intérieur de bâtiment)
- `style.css` — interface (HUD, panneaux, overlays)
- `game.js` — moteur du jeu (projection iso, monde, ville, joueur, collisions, tir, brouillard, zoom)

## Technologies

HTML, CSS et JavaScript natif (vanilla) sur un `<canvas>`. Aucune build, aucun paquet, aucune dépendance externe.
