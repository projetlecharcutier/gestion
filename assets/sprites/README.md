# Assets / Sprites (Aseprite PNG)

Sprites charges par `src/assets.js` au demarrage.

## Structure

```
assets/sprites/
  player/   perso_face.png perso_gauche.png perso_droite.png
            persoHache_face.png ...   persoPistolet_face.png ...
            (et frames d'animation <base>-0.png <base>-1.png ...)
  bird/     idle.png  N.png  NE.png  E.png  SE.png  S.png  SW.png  W.png  NW.png
  tree/     foret.png  foret1.png  foret2.png ...   # forêts (variantes)
  building/ mairie.png  generic.png
  church/   church.png
  house/    H1.png  H2.png ...                      # maisons (variantes, auto)
  wall/     palissageNESO.png  palissageNoSe.png
  zomb/
    alive/                                      # sprites zombies vivants (reserve)
    dead/   deadzomb1.png deadzomb2.png ...    # traces de zombies morts (au sol)
  tour/      idle.png  chantier.png  gauche.png  droite.png   # tour d'attaque
  scierie/   idle.png  chantier.png                # scierie
```

## Tour d'attaque (`tour/`)

La tour d'attaque a 4 series, chargees automatiquement (repli dessin vectoriel
si absentes). **Chaque PNG contient la tour entiere** (elle ne pivote pas) :

| Serie | Sens | Contenu |
|-------|------|---------|
| `idle.png` | tour construite, inactive | tour + 2 archers immobiles |
| `chantier.png` | chantier (10 s) | echafaudage, montent au fur et a mesure |
| `gauche.png` | animation de tir **a gauche** | tour entiere, archer gauche qui tire |
| `droite.png` | animation de tir **a droite** | tour entiere, archer droite qui tire |

Les series s'animent avec la convention habituelle : `idle-0.png`, `idle-1.png`,
... (idle : 4 fps, chantier : 8 fps, tir : duree fixe). Les projectiles
(fleches) sont **ejectes depuis les 10 % les plus hauts** du PNG : garde les
archers en haut du dessin.

Les animations `gauche` et `droite` peuvent se jouer **en meme temps** : le
jeu decoupe chaque PNG complet en **moities gauche/droite disjointes** au
rendu, l'une sur l'autre, donc aucun recouvrement. Les deux series doivent
donc representer la **meme tour, au meme pixel pres** (meme taille de PNG),
seuls les archers different. L'empreinte de pose de la tour = taille du PNG
(dans le doute : 96x128, cf. manifeste `src/assets.js`).

## Scierie (`scierie/`)

Batiment unique debloquable a la mairie. Deux series animees : `idle.png`
(batiment construit) et `chantier.png` (construction). Emprise au sol
definie par `SCIERIE_SIDE` (`src/config.js`), pas par la taille du PNG.

## Traces de zombies morts (`zomb/dead/`)

Quand un zombie meurt, il laisse une trace au sol (sang, débris...). Le jeu
charge tous les `deadzomb1.png`, `deadzomb2.png`, ... du dossier `zomb/dead/`
(numérotation depuis **1**, sonde jusqu'à 3 numéros manquants consécutifs) et
en **choisit un au hasard** à chaque mort. Rien à déclarer dans le manifeste.
La trace est dessinée **juste au-dessus du fond**, derrière tous les autres
éléments. Voir `zomb/README.md`.

## Joueur (`player/`)

Le joueur n'utilise pas les 8 directions cardinales. Il a **3 états
d'équipement** × **3 directions**, soit 9 sprites de base :

| État | Fichiers |
|------|----------|
| mains nues | `perso_face.png` · `perso_gauche.png` · `perso_droite.png` |
| hache équipée | `persoHache_face.png` · `persoHache_gauche.png` · `persoHache_droite.png` |
| pistolet équipé | `persoPistolet_face.png` · `persoPistolet_gauche.png` · `persoPistolet_droite.png` |

La direction est choisie selon le mouvement :

- `face` : immobile, vers le haut (N), vers le bas (S)
- `droite` : vers la droite (E, NE, SE)
- `gauche` : vers la gauche (W, NW, SW)

### Animer un sprite du joueur

Comme partout : ajoute des frames `<base>-0.png`, `<base>-1.png`, ... à côté du
sprite de base. Si `-0.png` existe, le sprite est animé (cycle 8 fps), sinon
statique.

**Exemple** : marche mains nues vers la droite.

```
assets/sprites/player/
  perso_droite.png     <- perso_droite-0.png absent ? statique
  perso_droite-0.png   <- -0 présent ? animé : 3 frames
  perso_droite-1.png      frame 0
  perso_droite-2.png      frame 1
                         frame 2
                         -> cycle 0,1,2,0,1,2... à 8 fps
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
