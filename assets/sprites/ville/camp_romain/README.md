# Camp romain (`camp_romain/`)

Ville decorative PNG, meme convention que `est/`, `laputa/`, `minas/`
(cf. `../README.md`).

Deposer ici exactement 2 PNG de **meme taille au pixel pres** :

- `ville.png` — le camp visible (pixel art)
- `ville_mask.png` — masque de collision / occlusion :
  - transparent/blanc : libre (le personnage circule)
  - rouge pur `rgb(255,0,0)` : collision (bloque joueur ET zombies)
  - vert pur `rgb(0,255,0)` : libre mais le personnage passe **derriere**

Tant que ces 2 fichiers sont absents, la ville est ignoree par `ville-sync`
(une ville sans PNG charge n'est pas posee sur la carte). Une fois le dossier
complet, elle est detectee automatiquement ; il reste a ajouter une entree
dans `G.VILLE_DEFS` (`src/config.js`) :

```js
{ name: "Camp romain", sprite: "camp_romain", x: <coordX>, y: <coordY> }
```
