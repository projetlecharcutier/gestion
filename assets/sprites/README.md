# Assets / Sprites (Aseprite PNG)

Sprites charges par `src/assets.js` au demarrage.

## Structure

```
assets/sprites/
  player/   idle.png  N.png  NE.png  E.png  SE.png  S.png  SW.png  W.png  NW.png
  bird/     idle.png  N.png  NE.png  E.png  SE.png  S.png  SW.png  W.png  NW.png
  tree/     foret.png  foret1.png  foret2.png ...   # forêts (variantes)
  building/ mairie.png  generic.png
  church/   church.png
  house/    H1.png  H2.png ...                      # maisons (variantes, auto)
  wall/     palissageNESO.png  palissageNoSe.png
```

## Animation

**Regle :** ajoute des frames `<base>-0.png`, `<base>-1.png`, ... pour animer.
Si `-0.png` existe -> l'objet est anime (cycle a 8 fps). Sinon -> statique.
**Rien a declarer** : le jeu detecte tout seul.

### Exemple concret : oiseau qui bat des ailes

```
assets/sprites/bird/
  SE.png        <- SE-0.png absent ? oiseau SE statique
  SE-0.png      <- -0 present ? animé : 3 frames
  SE-1.png         frame 0 : ailes en haut
  SE-2.png         frame 1 : ailes au milieu
                   frame 2 : ailes en bas
                   -> cycle 0,1,2,0,1,2... a 8 fps
```

### Exemple concret : maison animée (variante H1)

```
assets/sprites/house/
  H1.png        <- H2, H3... restent statiques
  H1-0.png      <- H1 animé seule (fumée de cheminée)
  H1-1.png
```

### Exemple concret : mairie animée

```
assets/sprites/building/
  mairie-0.png  <- drapeau qui ondule
  mairie-1.png
```

## Règles

- Numérotation depuis **0** (`-0`, `-1`, ...).
- Toutes les frames d'une animation ont la **même taille**.
- Chargement auto : s'arrête à la 1re frame absente (tolère 3 absences consécutives).
- Combinable avec les **variantes** : `H1`/`H2` = maisons différentes (choix aléatoire) ; `H1-0`/`H1-1` = animation de H1.
- Vitesse du cycle : `ANIM_FPS = 8` dans `src/assets.js` (modifiable).

## Variantes vs animation

| Convention | Sens | Exemple |
|------------|------|---------|
| `<base>.png` | 1 objet statique | `SE.png` |
| `<base>1.png`, `<base>2.png`... | **variantes** (objets différents, choix aléatoire) | `H1.png`, `H2.png` |
| `<base>-0.png`, `<base>-1.png`... | **animation** (frames d'un même objet, cycle) | `SE-0.png`, `SE-1.png`, `SE-2.png` |
| `<base>1-0.png`, `<base>1-1.png`... | variante 1 **animée** | `H1-0.png`, `H1-1.png` |

## États de coupe des forêts

Les forêts ont **5 états de coupe** (s0 = pleine, s4 = entièrement coupée).
Un coup de hache récolte 4 planches et fait passer la forêt à l'état suivant.
À l'état final (s4), la forêt n'est plus récoltable et devient traversable.
Chaque jour écoulé, la forêt regagne un état (remonte vers s0).

**Convention de nommage : `<base>s<index>.png`** (suffixe `s` + index).

```
assets/sprites/tree/
  foret1.png     <- sprite de base (état implicite s0 / repli)
  foret1s0.png   <- état 0 : forêt pleine
  foret1s1.png   <- état 1
  foret1s2.png   <- état 2
  foret1s3.png   <- état 3
  foret1s4.png   <- état 4 : forêt entièrement coupée
```

**Pas de conflit avec l'animation** : l'animation utilise `<base>-N.png`
(tiret), les états utilisent `<base>s<N>.png` (lettre `s`). Les deux
conventions ne se chevauchent jamais (`foret1-0.png` ≠ `foret1s0.png`).

**Tolérant** : si un sprite d'état manque, le rendu repli sur le sprite de
base. Les états ne sont pas déclarés dans le manifeste : ils sont détectés
automatiquement par `probeForetStages` (voir `src/assets.js`).

## Manifeste

`assets/manifest.json` decrit les frames de base. Les frames d'animation (`-N`) ne
s'y declarrent pas : elles sont detectees automatiquement.

## Directions

8 directions tous les 45° (calculees via `atan2(dy, dx)`) :
N (haut) · S (bas) · E (droite) · W (gauche) · NE · SE · SW · NW.
Immobile -> `idle`.
