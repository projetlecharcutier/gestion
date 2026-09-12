# Textures — `src/textures/`

## Contrat
Isoler les **sprites pixel art + palettes de couleurs** des fonctions de dessin, pour pouvoir modifier l'apparence d'un objet sans toucher à la logique de rendu. Exposées sur `G.TEXTURES.<type>`. Doivent être chargées après `state.js` et avant `render.js`/`hud.js`/`bag.js` (qui les consomment).

## Convention sprite pixel art
Un sprite est un tableau de chaînes, une par ligne. Chaque caractère est une clé de palette ou `.` (transparent). Rendu case par case avec `cell = zoom*0.5` (pixelisé). Le joueur se flipe horizontalement selon `face`.

```
sprite: ["..hh..", ".hhhh.", ...]
palette: { h: "#3b2a1a", s: "#e8b98a", ... }
```

## Fichiers par type

| Fichier | Clé `G.TEXTURES` | Schéma |
|---------|------------------|--------|
| `index.js` | — | initialise `G.TEXTURES = {}` |
| `player.js` | `player` | `{ sprite[], palette, shadow }` |
| `zombie.js` | `zombie` | `{ sprite[], palette, shadow }` |
| `building.js` | `building` | `{ faces:{sideX,sideY}, roof, door }` |
| `wall.js` | `wall` | `{ faces:{sideX,sideY}, top, hpBar:{low,mid,high}, hpBarBg }` |
| `tree.js` | `tree` | `{ trunk, shadow, foliage:{town,edge,wild}:{light,dark} }` |
| `item.js` | `item` | `{ shadow, stroke, shine, weaponHandle, weaponStroke, defaultColor }` |
| `ground.js` | `ground` | `{ town, wild, border, skyNight, skyDay }` |
| `fog.js` | `fog` | `{ color, stops[{at,alpha}] }` |
| `crosshair.js` | `crosshair` | `{ color, radius, gap, tick }` |
| `projectile.js` | `projectile` | `{ defaultColor, stroke, trailAlpha, trailSize, trailSizeStep, sizeBase, sizePerDmg, trailMax }` |
| `hud.js` | `playerHpBar`, `clock`, `buildHint`, `gameOver` | couleurs + dimensions des overlays |
| `bag.js` | `bag` | couleurs du panneau + icônes |

## Consommateurs
- `src/render.js` : player, zombie, building, wall, tree, item, ground, fog, crosshair, projectile
- `src/hud.js` : playerHpBar, clock, buildHint, gameOver
- `src/bag.js` : bag

## Étendre
- **Repeindre un objet** : changer les valeurs dans `src/textures/<type>.js` uniquement.
- **Nouveau sprite d'entité** : créer `src/textures/<type>.js` exposant `{ sprite, palette }`, l'ajouter à `index.html` après `textures/index.js`, l'utiliser dans une `drawX` (`src/render.js`).
- **Variante d'apparence par état** (ex. zombie blessé) : ajouter un sprite alternatif dans la texture et le sélectionner dans `drawZombie` selon `z.hp`.
- **Thème (jour/nuit, saison)** : dupliquer un bloc de textures et sélectionner le bon dans le rendu selon `state.clock`/`state.season`.
