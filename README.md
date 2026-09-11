# Ville Isométrique

Un jeu d'aventure isométrique (vue de haut) jouable dans un navigateur, en HTML/CSS/JavaScript natif (aucune dépendance).

## Lancer le jeu

Ouvrez `index.html` dans un navigateur récent (Chrome, Firefox, Edge, Safari).

## Comment jouer

- Au démarrage, entrez votre nom.
- Vous apparaissez au centre d'une carte de **100 000 × 100 000 px**.
- Au centre se trouve une **ville de 10 000 × 10 000 px**.
- **Déplacement** : le personnage suit la souris.
- **Tir** : appuyez sur **Espace** (le tir va vers la souris).
- **Zoom / dézoom** : molette de la souris.
- **Pause** : touche **Échap**.
- **Bâtiments** : cliquez sur la **porte** d'un bâtiment (quand vous êtes à proximité) pour y entrer ; cliquez sur **Sortir** pour ressortir.
- **Objets** : cliquez sur un objet au sol (à proximité) pour le ramasser ; l'inventaire s'affiche en haut à gauche.
- **Collisions** : le personnage est bloqué par les murs des bâtiments.
- **Brouillard de guerre** : dans la ville, tout est visible ; hors de la ville, vous ne voyez qu'à **50 px** autour du personnage.

## Caractéristiques

- Personnage pixelisé : **6 px de large × 15 px de haut**.
- Projection isométrique (vue de haut), caméra qui suit le joueur.
- Bâtiments en 3D isométrique avec toit et porte.
- Objets au sol ramassables.

## Fichiers

- `index.html` — page et écrans (nom, pause, intérieur de bâtiment)
- `style.css` — interface (HUD, panneaux, overlays)
- `game.js` — moteur du jeu (projection iso, monde, ville, joueur, collisions, tir, brouillard, zoom)

## Technologies

HTML, CSS et JavaScript natif (vanilla) sur un `<canvas>`. Aucune build, aucun paquet, aucune dépendance externe.
