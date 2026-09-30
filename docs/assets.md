# Assets PNG & animations — `src/assets.js`

## Contrat

Charge asynchronement les sprites PNG decrits par `assets/manifest.json` et expose `G.SPRITES.<entite>.<frame> = { img, w, h, frames? }`. Tolérant : un PNG manquant (404) ne casse rien, le rendu replie sur les textures vectorielles `G.TEXTURES`.

## Exposé sur `G`

- `G.SPRITES` — dictionnaire des sprites chargés
- `G.assetsReady()` — bool, tous les sprites du manifeste sont chargés
- `G.animImg(sprite, time)` — image d'une animation en boucle (10 fps) ou image statique
- `G.actionFrame(sprite, t)` — frame d'une animation d'action (tir/hache) qui **ne boucle pas** : démarre au déclenchement, reste figée sur la dernière frame
- `G.animCount(sprite)` — nombre de frames (1 = statique)

## Détection automatique

Rien n'est déclaré pour les animations : `probeAnimFrames` sonde les frames aux deux conventions de nommage (standard `<base>-N.png` depuis 0, et bloc Aseprite padding `<base>-0101.png`), tolère 3 absences consécutives, et une série peut mélanger les deux. Cache-buster automatique (`?v=Date.now()`) pour éviter les PNG 404 restés en cache.

## Étendre

- **Nouveau sprite** : ajouter l'entrée dans `assets/manifest.json`, poser le PNG dans le bon dossier `assets/sprites/<dossier>/`, respecter les conventions de `assets/sprites/README.md` (variantes `<base>N`, animation `<base>-N`, états `<base>s<N>`).
- **Changer la vitesse d'animation** : `ANIM_FPS` dans `src/assets.js` (10 fps standard ; certaines séries comme la tour ont leur propre cadence).
