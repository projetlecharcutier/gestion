## Perche Pixel: LE JEU de survie Mutlijoueur INCONTOURNABLE de 2026


- « Un chef-d'œuvre absolu qui marque durablement les esprits. » — Le Monde
- « Bouleversant et magistral, une véritable claque artistique. » — Le Figaro
- « Une réussite totale qu'il faut courir voir. » — Libération
- « Aussi singulier qu'irrésistible, un ovni indispensable. » — Le Parisien
- « Une proposition artistique audacieuse et d'une folle originalité. » — Télérama
- « Le renouveau d'un genre, porté par une audace formelle rare. » — Les Inrockuptibles
- « Un rythme effréné et une énergie purement jubilatoire. » — Première
- « Captivant de bout en bout, impossible de décrocher. » — Le Nouvel Obs

Un jeu d'aventure isométrique (vue de haut) jouable dans un navigateur, en HTML/CSS/JavaScript natif (aucune dépendance).

## Lancer le jeu

Ouvrez `index.html` dans un navigateur récent (Chrome, Firefox, Edge, Safari).

## Comment jouer

- Au démarrage, entrez votre nom.
- Vous apparaissez au centre d'une carte de **10 000 × 10 000 px**.
- Au centre se trouve une **ville de 1 000 × 1 000 px** (bâtiments plus petits).
- **Déplacement** : le personnage suit la souris, mais s'arrête quand la souris est sur lui (hover).
- **Tir** : appuyez sur **Espace** (le tir va vers la souris). Désactivé en mode pose de planche.
- **Sac** : appuyez sur **A** pour ouvrir/fermer le sac. Les **objets, outils et armes** ramassés au sol y sont rangés.
- **Rappel des touches (HUD haut gauche)** : `A : Ouvrir le sac`, `Z : Poser une planche / Entrer en mode pose de planche`.
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
- **Mode pose de planche** : appuyez sur **Z** pour l'activer/désactiver. En mode pose, le clic pose une planche (coût : 4 planches, portée limitée). **Espace** fait tourner la planche de 90° (horizontale/verticale). Les planches peuvent **se superposer**.
- **Arbres** : quelques arbres en ville, beaucoup d'arbres (forêt) en dehors de la ville.
- **Collisions** : le personnage est bloqué par les murs des bâtiments.
- **Brouillard de guerre** : dans la ville, tout est visible ; hors de la ville, vous ne voyez qu'à **200 px** autour du personnage.

## Cycle jour/nuit & zombies

- **Cycle jour/nuit** : 12h in-game = 5 min réel (24h = 10 min). **La nuit va de 23h à 7h du matin**. L'heure s'affiche en haut (☀ le jour, 🌙 la nuit).
- **Compteur de jours** en haut à droite (commence à **Jour 0**), s'incrémente à chaque cycle complet.
- **Vagues de zombies** : une vague toutes les **7 min** la nuit ; **50 zombies** attaquent la ville la 1ère nuit et **doublent à chaque nuit** (+100%), et **repartent après 10 min**. Le **compteur de zombies** s'affiche en haut à droite pendant une vague.
- **Zombies** : 2× plus lents que le joueur (on peut les fuir), n'attaquent qu'**à la main**. **Un coup de feu les tue**. Ils se déplacent en **petits groupes** (formation autour d'un chef) qui **fusionnent progressivement** quand ils sont proches.
- **Cible des zombies** : ils attaquent le joueur s'il est à **150 px** autour d'eux ; sinon ils attaquent les **murs**.
- **Murs** : la ville est entourée d'un mur de **1 planche d'épaisseur** au départ. Mur = **100 PV**. Les zombies font **-5 PV au mur toutes les 20 s**.
- **Barre de vie des murs** sous chaque mur ; **orange** à moins de 30 PV, **rouge** à moins de 10 PV.
- **Joueur** : **100 PV**. **5 attaques de zombie = mort** (game over). **Mairie détruite = game over** aussi.
- **Récolte de planches (hache)** : des **haches** sont trouvées **hors de la ville**. Ramassez-en une, **équipez-la** dans le sac (cliquez dessus). Restez à côté d'un arbre (portée de hache) pendant **4 secondes** : un **cercle de décompte** apparaît à côté du personnage. **Chaque arbre donne 1 planche** (l'arbre disparaît).
- **Bois & murs** : une fois des planches récoltées, appuyez sur **Z** puis cliquez pour **poser une planche** (4 planches par planche posée, à portée limitée). **Espace** pivote la planche.
- **Armes au sol** : trouvées **uniquement en dehors de la ville** dès le début.
- **Hôpital** : dans la ville ; cliquez sur sa porte avec une **pièce d'or** dans le sac pour **retrouver toute votre vie**.
- **🏛️ Mairie** : bâtiment central (bleu, blanc et rouge), **1000 PV**. Cliquez sur sa porte pour ouvrir le **coffre** et y **déposer des objets** (armes, planches, argent…). Les zombies convergent vers la mairie et l'attaquent : **si elle est détruite, fin de partie**. Ses PV s'affichent dans le HUD.

## Caractéristiques

- Personnage pixelisé : **6 px de large × 15 px de haut**.
- Rendu très pixelisé (zoom par défaut plus important).
- Projection isométrique (vue de haut), caméra qui suit le joueur.
- Bâtiments en 3D isométrique avec toit et porte (**≤ 20× la taille du joueur**, soit ≤ 120 px), dont un **Hôpital**.
- Objets et armes au sol ramassables, rangés dans le sac.
- Arbres (forêt dense hors ville, quelques-uns en ville), récoltés à la hache (4 s/arbre) pour faire des planches.
- Murs (planches) avec barre de vie, constructibles (mode pose de planche Z, rotation Espace, superposition possible).
- Hache (outil hors ville) : récolte de planches avec cercle de décompte.
- Zombies pixelisés, vagues nocturnes, cycle jour/nuit, compteur de jours.

## Fichiers

- `index.html` — page et écrans (nom, pause, intérieur de bâtiment)
- `style.css` — interface (HUD, panneaux, overlays)
- `src/` — moteur du jeu, découpé par système (voir `CONTEXT.md` pour la carte et `docs/` pour les specs)
- `src/textures/` — sprites pixel art & palettes de couleurs par type d'objet (joueur, zombie, bâtiment, mur, arbre, sol, UI…)
- `CONTEXT.md` — carte du projet (architecture, état global, points d'extension)
- `docs/` — spec courte par système

## Technologies

HTML, CSS et JavaScript natif (vanilla) sur un `<canvas>`. Aucune build, aucun paquet, aucune dépendance externe.

## Mode multijoueur

Le jeu est jouable en **multijoueur** (jusqu'à 20 joueurs) via un serveur Node.js léger.

### Lancer le serveur

```bash
cd server
npm install        # installe ws
npm start          # écoute sur le port PORT (8080 par défaut)
```

### Rejoindre une partie

Ouvrez `index.html` dans un navigateur pendant que le serveur tourne. Le menu d'accueil affiche :

- l'**heure dans le monde** du serveur (jour/nuit),
- le **nombre de joueurs connectés** et leur nom,
- le statut (en attente, départ dans Xs, partie en cours).

Entrez votre nom et cliquez sur **Lancer une partie** pour rejoindre.

### Règles de la partie serveur

- Une **partie unique** est hébergée par le serveur.
- La partie se **lance 30 s** après l'arrivée du premier joueur.
- Si **aucun joueur n'est connecté**, la partie est arrêtée (relancée à la prochaine connexion).
- Si la **mairie est détruite**, la partie redémarre automatiquement.
- Les places (max 20) sont **libérées à la déconnexion**.
