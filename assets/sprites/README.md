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
  barricade/
    NE_SO.png   # diagonale NE-SO (mur orient "h" / axe X monde)
    NO_SE.png   # diagonale NO-SE (mur orient "v" / axe Y monde)
```

## Format des PNG

- **PNG transparent** (alpha), pixel art.
- **Une seule frame par fichier** pour les directions statiques (idle + 8 dirs).
- Pour animer la marche plus tard : plusieurs frames horizontales dans le meme
  PNG (sprite sheet), le manifeste `assets/manifest.json` decriera la taille
  de chaque frame et la duree.

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
