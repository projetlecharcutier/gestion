# Projection isométrique — `src/projection.js`

## Contrat
Conversions monde ↔ écran et helpers de visibilité. Fonctions pures (à part `viewW/viewH` qui lisent `canvas`). Dépend de `G.state.camera`, `G.state.zoom`, `G.canvas`.

## Exposé sur `G`
- `viewW()`, `viewH()` — dimensions utiles (canvas / devicePixelRatio)
- `proj(wx, wy)` → `[sx, sy]` — monde → écran
- `unproj(sx, sy)` → `[wx, wy]` — écran → monde
- `inTown(x, y)` → bool — dans le rectangle de la ville
- `visibleWorldBounds()` → `{ minX, minY, maxX, maxY }` — zone monde visible (+ marge `TS`)

## Formule
- `sx = (wx - wy) * 0.5 * z`, `sy = (wx + wy) * 0.25 * z`, décalage caméra + centrage écran.
- `unproj` inverse : `d = a/(0.5z) = wx-wy`, `s = b/(0.25z) = wx+wy`, d'où `wx=(d+s)/2`, `wy=(s-d)/2`.

## Étendre
- Changer la projection (ex. vraie iso 2:1) : modifier `proj`/`unproj` ensemble pour rester cohérent.
- Filtrage de visibilité : `visibleWorldBounds` est utilisé par le rendu pour cull arbres/zombies.
