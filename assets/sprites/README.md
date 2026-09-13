# Assets / Sprites (approche A — Aseprite PNG)

Les sprites sont charges par `src/assets.js` au demarrage du jeu.

## Structure

```
assets/sprites/
  player/
    idle.png        # statique (face camera)
    N.png  NE.png  E.png  SE.png  S.png  SW.png  W.png  NW.png
  bird/
    idle.png
    N.png  NE.png  E.png  SE.png  S.png  SW.png  W.png  NW.png
  tree/
    town.png  edge.png  wild.png
  building/
    mairie.png  generic.png   # mairie (128x128) + batiments genériques (96x96)
  church/
    church.png                 # église (batiment dédié, 128x128)
  house/                      # maisons décoratives (non cliquables)
    H1.png  H2.png  H3.png ... # détection auto : H1, H2, ... jusqu'au 1er manquant
  wall/                       # palissades
    palissageNESO.png  # diagonale NE-SO (mur orient "h" / axe X monde)
    palissageNoSe.png  # diagonale NO-SE (mur orient "v" / axe Y monde)
```

## Format des PNG

- **PNG transparent** (alpha), pixel art.
- **Une seule frame par fichier** pour les directions statiques (idle + 8 dirs).

## Animation par frames (automatique)

N'importe quel sprite peut etre anime en ajoutant des frames numerotees depuis 0,
separees du nom de base par un tiret : `<base>-0.png`, `<base>-1.png`, ...

Le jeu detecte automatiquement les frames au chargement. Si `-0.png` existe,
l'objet est anime (cycle a 8 fps) ; sinon il reste statique sur `<base>.png`.

Exemples :

```
assets/sprites/bird/
  SE.png            # statique : 1 image pour la direction SE
  SE-0.png          # anime : 3 frames -> ailes qui battent
  SE-1.png
  SE-2.png

assets/sprites/house/
  H1.png            # statique : maison H1 immobile
  H1-0.png          # anime : la variante H1 s'anime (fumee de cheminee, etc.)
  H1-1.png

assets/sprites/building/
  mairie.png        # statique
  mairie-0.png      # anime (ex : drapeau qui ondule)
  mairie-1.png
```

Regles :
- La numrotation commence a **0** (`-0`, `-1`, ...).
- Toutes les frames d'une animation ont la **meme taille**.
- Le chargement s'arrete a la premiere frame absante (tolere les trous : 3
  absences consecutives avant abandon).
- Combine avec les **variantes** : `H1`/`H2`/... = maisons differentes
  (choix aleatoire), `H1-0`/`H1-1` = frames d'animation de H1.
- Aucune config : deposes les PNG, le reste est automatique.

## Manifeste : assets/manifest.json

Decrit les frames de chaque sprite. Exemple :

```json
{
  "player": {
    "idle":  { "src": "assets/sprites/player/idle.png", "w": 32, "h": 48 },
    "N":     { "src": "assets/sprites/player/N.png",    "w": 32, "h": 48 },
    "NE":    { "src": "assets/sprites/player/NE.png",   "w": 32, "h": 48 },
    "E":     { "src": "assets/sprites/player/E.png",     "w": 32, "h": 48 },
    "SE":    { "src": "assets/sprites/player/SE.png",   "w": 32, "h": 48 },
    "S":     { "src": "assets/sprites/player/S.png",    "w": 32, "h": 48 },
    "SW":    { "src": "assets/sprites/player/SW.png",   "w": 32, "h": 48 },
    "W":     { "src": "assets/sprites/player/W.png",    "w": 32, "h": 48 },
    "NW":    { "src": "assets/sprites/player/NW.png",    "w": 32, "h": 48 }
  },
  "bird": { ...meme structure... }
}
```

## Directions

8 directions tous les 45 degres, calculees a partir de l'angle de deplacement
`atan2(dy, dx)` :
- N  = haut (vers y decroissant)
- S  = bas (vers y croissant)
- E  = droite (x croissant)
- W  = gauche (x decroissant)
- NE / SE / SW / NW = diagonales

Si le personnage est immobile, on affiche `idle`.
