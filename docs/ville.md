# Villes decoratives PNG (`src/ville.js`)

Grandes villes pre-dessinees (PNG) posees sur la carte, avec collisions par
zones et occlusion correcte du personnage. Spec : contrat, entrees/sorties,
contraintes.

## Assets

Chaque ville = un dossier `assets/sprites/ville/<sprite>/` :

| Fichier | Role |
|---|---|
| `ville.png` | ville visible (pixel art), meme convention d'ancrage que les bâtiments (bas-centre sur le bord sud du losange, emprise = largeur PNG * 2) |
| `ville_mask.png` | masque de collision, MEME taille au pixel pres |

Masque (couleurs PLEINES, sans anti-aliasing) :

- transparent/blanc : libre
- rouge `rgb(255,0,0)` : collision (bloque joueur ET zombies)
- vert `rgb(0,255,0)` : libre, personnage passe DERRIERE le PNG

Un pixel du masque correspond au point de sol situe sous lui a l'ecran
(projection iso). Le masque se dessine par-dessus le PNG visible (calque).

## Contrats principaux

| Fonction | Role |
|---|---|
| `villeSetup(state)` | pose les villes de `VILLE_DEFS` dans `state.villes` + construit les grilles. Appele par `buildWorld` (world.js) et net.js (mode serveur, apres reception de la carte) |
| `villeGridFromPixels(iw, ih, rgba, x, y, side, cell)` | PURE : masque RGBA -> grille monde `Uint8Array` (0 libre, 1 solide, 2 derriere). Utilisee par le client (canvas) ET gen-sprite-meta.js (Node) -> parite exacte |
| `aabbHitsVilles(bx, by, bw, bh)` / `aabbHitsVillesCenter(x, y, half)` | test AABB contre les cellules solides (1). Branches dans `_stepMove` (player.js), les collisions zombies (zombies.js `hitsObstacle`), la pose de planches (walls.js) et de tours (towers.js `towerSpotFree`) |
| `villeBlockNav(blocked, cols, rows, cell)` | marque les cellules solides dans la grille nav 32 px (appele par `rebuildNavGrid`, flowfield.js) |
| `villeAt(x, y, pad)` | position dans l'emprise d'une ville -> la generation (forets, maisons, items) evite les villes |
| `villeEscape(x, y)` | direction du bord le plus proche (zombie pie dans une cellule solide) |
| `villeBands(v)` / `drawVilleBand(v, band, entry)` | decoupe le PNG en bandes horizontales (~`VILLE_BAND_H` px) chacune inseree dans le tri `depth = x + y` de render() -> le joueur passe devant/derriere chaque facade selon sa position, sans logique dediee |

## Multi-villes

Tout est parametre par `G.VILLE_DEFS` (`src/config.js`) :

```js
G.VILLE_DEFS = [
  { name: "Ville de l'Est", sprite: "est", x: 6800, y: 4200 }
];
```

- `x, y` : coin nord-ouest de l'emprise sol (losange iso).
- Emprise par defaut : `largeur du PNG * 2` (overridable via `w`).
- Ajouter une ville = deposer le dossier PNG dans
  `assets/sprites/ville/<nom>/` : le serveur la DETECTE au demarrage
  (server/ville-sync.js) et la place automatiquement si elle n'a pas
  d'entree VILLE_DEFS.
- Une ville sans dossier PNG est ignoree (tolerant) : le jeu demarre
  normalement. Plusieurs villes peuvent coexister, y compris avec des
  sprites partages (cache de bandes clee par sprite + position).

## Parite client/serveur

- **Client** : masque charge par `probeVilles` (src/assets.js), grille
  extraite au `finish` du chargement via `buildVilleGrids` (canvas
  `getImageData`, une seule fois).
- **Serveur** : `server/ville-sync.js` (lance automatiquement par
  server/index.js au demarrage) scanne `assets/sprites/ville/`, decode le
  masque PNG (decodeur RGBA manuel, 8-bit non entrelace) et genere
  `server/ville-grids.json` (RLE) en appelant la MEME fonction pure
  `villeGridFromPixels` chargee par `eval` depuis src/. `dom-stub.js`
  expose les grilles brutes (`G._villeGridsRaw`) que src/ville.js decode
  au chargement. Les positions automatiques sont persistees dans
  `server/ville-positions.json` (stables entre redemarrages) et publiees
  au client via le manifeste genere `assets/sprites/ville/villes.js`.
- **Resultat** : collisions strictement identiques des deux cotes (meme
  fonction, meme cellule de 1 px — plus petite que le joueur, la precision
  du masque est preservee et les bascules devant/derriere suivent le
  masque peint).

## Contraintes

- Le masque doit etre exporte en PNG **8-bit RGBA non entrelace**
  (standard Aseprite/GIMP) pour le decodeur serveur.
- Le canal vert (derriere) ne bloque pas : au sol, il place le joueur
  DERRIERE le PNG au rendu (les bandes de la ville passent devant lui) ;
  le transparent au sol le laisse DEVANT. L'ELEVATION (moitie haute du
  PNG, au-dessus de l'horizon) ne produit AUCUNE collision : seuls les
  pixels du masque projetes dans le losange de sol comptent.
- Les villes ne remplacent pas la ville principale : mairie, eglise,
  bâtiments interactifs restent des objets reels. Les villes PNG sont du
  decor + collisions (comme les maisons `isDecor`).
- `inTown` (brouillard, HUD, zone de construction) ne tient PAS compte des
  villes PNG : elles sont purement decoratives.
- Apres tout ajout/modification de PNG : relancer `node
  server/gen-sprite-meta.js` (bornes opaques des sprites) et committer les
  fichiers generes (`server/sprite-meta.json`,
  `server/ville-grids.json`, `server/ville-positions.json`,
  `server/ville-grids-sigs.json`, `assets/sprites/ville/villes.js`) avec
  les PNG. En production, le serveur regenere lui-meme les grilles et le
  manifeste au demarrage (ville-sync.js), mais les committer garantit un
  premier demarrage correct meme sans sync.
