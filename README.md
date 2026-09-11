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

## Cycle jour/nuit & zombies

- **Cycle jour/nuit** : 12h in-game = 5 min réel (24h = 10 min). L'heure s'affiche en haut (☀ le jour, 🌙 la nuit).
- **Compteur de jours** en haut à droite (commence à **Jour 0**), s'incrémente à chaque cycle complet.
- **Vagues de zombies** : une vague toutes les **7 min** la nuit ; **milliers de zombies** attaquent la ville et **repartent après 10 min**.
- **Zombies** : 2× plus lents que le joueur (on peut les fuir), n'attaquent qu'**à la main**. **Un coup de feu les tue**. Ils se déplacent en **petits groupes** (formation autour d'un chef) qui **fusionnent progressivement** quand ils sont proches.
- **Cible des zombies** : ils attaquent le joueur s'il est à **150 px** autour d'eux ; sinon ils attaquent les **murs**.
- **Murs** : la ville est entourée d'un mur de **1 planche d'épaisseur** au départ. Mur = **100 PV**. Les zombies font **-5 PV au mur toutes les 20 s**.
- **Barre de vie des murs** sous chaque mur ; **orange** à moins de 30 PV, **rouge** à moins de 10 PV.
- **Joueur** : **100 PV**. **5 attaques de zombie = mort** (game over).
- **Bois & murs** : on peut **débiter les arbres** (clic sur un arbre à proximité) pour obtenir des **planches**. Appuyez sur **B** puis cliquez pour **construire un mur** (4 planches par mur, à portée limitée).
- **Armes au sol** : trouvées **uniquement en dehors de la ville** dès le début.
- **Hôpital** : dans la ville ; cliquez sur sa porte avec une **pièce d'or** dans le sac pour **retrouver toute votre vie**.

## Caractéristiques

- Personnage pixelisé : **6 px de large × 15 px de haut**.
- Rendu très pixelisé (zoom par défaut plus important).
- Projection isométrique (vue de haut), caméra qui suit le joueur.
- Bâtiments en 3D isométrique avec toit et porte (échelle réduite avec la ville), dont un **Hôpital**.
- Objets et armes au sol ramassables, rangés dans le sac.
- Arbres (forêt dense hors ville, quelques-uns en ville), abattables pour faire des planches.
- Murs (planches) avec barre de vie, constructibles.
- Zombies pixelisés, vagues nocturnes, cycle jour/nuit, compteur de jours.

## Fichiers

- `index.html` — page et écrans (nom, pause, intérieur de bâtiment)
- `style.css` — interface (HUD, panneaux, overlays)
- `game.js` — moteur du jeu (projection iso, monde, ville, joueur, collisions, tir, murs, zombies, cycle jour/nuit, brouillard, zoom)

## Technologies

HTML, CSS et JavaScript natif (vanilla) sur un `<canvas>`. Aucune build, aucun paquet, aucune dépendance externe.
