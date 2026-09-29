# Villes decoratives PNG (`ville/`)

Grandes villes pre-dessinees posees sur la carte (ex. la Ville de l'Est).
Chaque ville est un **dossier** `assets/sprites/ville/<nom>/` contenant
exactement 2 PNG de **meme taille au pixel pres** :

```
assets/sprites/ville/
  est/
    ville.png        # la ville visible (pixel art)
    ville_mask.png   # le masque de collision / occlusion
```

## Convention du masque

Couleurs **pleines, opaques, sans anti-aliasing** (pas de degrades vers le
transparent) :

| Couleur | Signification |
|---|---|
| transparent ou blanc | libre : le personnage circule |
| **rouge pur** `rgb(255,0,0)` | **collision** : bloque joueur ET zombies |
| **vert pur** `rgb(0,255,0)` | libre, mais le personnage passe **derriere** le PNG |

Un pixel du masque correspond au **point de sol situe sous lui a l'ecran**
(projection iso). Peindre en rouge la facade d'une tour rend solide toute sa
projection au sol, vue du joueur. Dessinez le masque **par-dessus le PNG
visible** (calque dans Aseprite/GIMP/Krita/Photopea) pour garantir
l'alignement, puis exportez ce calque seul.

## Echelle et ancrage

Meme convention que les autres bâtiments : le PNG est ancre bas-centre sur
le bord sud de son losange d'emprise sol, et l'emprise vaut
`largeur du PNG * 2` (unites monde). La taille exacte vient du PNG ; la
position (coin nord-ouest du losange) est definie dans `G.VILLE_DEFS`
(`src/config.js`).

## Deposer des villes

Vous pouvez deposer **autant de villes que vous voulez** : chacune est un
dossier assets/sprites/ville/<nom>/ avec ville.png et ville_mask.png.
Le serveur DETECTE tout dossier valide au demarrage.

Regles de depot :

- **Jamais deux fois la meme ville** : deux dossiers dont le contenu PNG
  (ville + masque) est IDENTIQUE sont des doublons — seul le premier est
  garde, les copies sont ignorees (log [ville-sync] doublon ignore).
  Les villes configurees manuellement dans G.VILLE_DEFS gagnent toujours.
- **Placement automatique** : toute ville sans entree manuelle est posee
  autour de la ville principale, 2 par direction diagonale : sud-est,
  nord-est, sud-ouest, nord-ouest — la 1re paire sur l anneau proche
  (VILLE_AUTO_DIST), la 2e sur l anneau lointain (VILLE_AUTO_DIST*1.8),
  puis expansion par pas si besoin. Les emprises ne se superposent
  JAMAIS (test AABB + marge, hors ville de depart). Position persistee
  dans server/ville-positions.json (stable entre redemarrages).
- (Optionnel) Placement manuel : entree dans G.VILLE_DEFS (src/config.js)
  { name: "...", sprite: "<nom>", x: ..., y: ... } — x/y = coin nord-ouest
  de l emprise sol.
- (Optionnel) Relancer node server/gen-sprite-meta.js pour rafraichir
  server/sprite-meta.json (bornes opaques) ; les grilles de collision et
  le manifeste client (villes.js) sont regeneres automatiquement au
  demarrage du serveur par server/ville-sync.js.

Sans dossier PNG, la ville est simplement ignoree (tolerant) : le jeu
demarre normalement, sans la ville.

## Collision / rendu

- **Client** : le masque est decode une fois au chargement en une grille
  de collision (cellules de 1 px monde, plus petites que le joueur) par
  `src/ville.js`. Les cellules
  rouges bloquent le joueur (`_stepMove`), les zombies (collisions locales
  + flow field) et la pose de planches/tours.
- **Serveur** : les memes grilles sont lues depuis `server/ville-grids.json`
  (genere par `server/ville-sync.js`, lance au demarrage, avec la meme
  fonction pure que le client -> parite exacte des collisions).
- **Rendu** : le PNG est decoupe en bandes horizontales (~96 px) inserees
  dans le tri de profondeur `x+y` -> le personnage passe devant/derriere
  chaque facade selon sa position. Le canal vert du masque est reserve aux
  passages derriere non couverts par le tri des bandes.
