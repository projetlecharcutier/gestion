# Sac & inventaire — `src/bag.js`

## Contrat
Disposition du panneau Sac, rendu du sac, clic pour équiper une arme. Dépend de `config.js` (via `equippedStats`), `state.js`, `render.js` (`G.roundRect`), **et des textures `G.TEXTURES.bag`** (`src/textures/bag.js`). Le sac s'ouvre/ferme via la touche A (`src/input.js`).

## Exposé sur `G`
- `bagLayout()` → `{ W, H, px, py, pw, ph, listY, lineH, maxLines }` — géométrie du panneau
- `handleBagClick(sx, sy)` — équipe/déséquipe l'arme cliquée (`state.equipped` = nom ou null), ou bascule la hache (`kind==="outil"`, `name=="Hache"` → `state.axeEquipped`)
- `drawBag()` — dessine le panneau (titre, arme équipée + stats, liste des objets)

## Contraintes
- Le clic agit sur `kind === "arme"` (équipement d'arme) et sur `kind === "outil"` `name === "Hache"` (équipement de hache) ; les autres objets sont juste affichés.
- `maxLines` adapte le nombre d'objets affichés à la taille du panneau (scroll non géré).
- Le sac bloque le déplacement, le tir et la récolte (testé dans `update`/`handleShooting`/`updateChop`).

## Étendre
- **Empiler / utiliser un objet** : ajouter une action au clic pour `kind === "objet"` (ex. boire une Potion).
- **Tri / catégories** : filtrer/trier `state.bag.contents` dans `drawBag`.
- **Capacité limitée** : bloquer le ramassage dans `src/input.js` si `contents.length >= max`.
