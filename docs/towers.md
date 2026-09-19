# Spec — Scierie & Tours d'attaque

> Système : déverrouillage d'une technologie à la mairie (scierie), pose du
> bâtiment scierie, menu de construction, tours d'attaque automatiques
> (niveau 1 : tour en bois). Module partagé client + serveur : `src/towers.js`,
> chargé **avant** `zombies.js` (l'IA zombie lit l'état des tours).

## 1. Vue d'ensemble

- **Scierie** : technologie débloquée au coffre de la mairie (100 planches +
  10 or), puis **bâtiment unique** posable dans la ville.
- **Menu de construction** : touche **Z** → liste des bâtiments constructibles
  (palissade toujours ; scierie si débloquée et non posée ; tours si la
  scierie est construite) → clic sur un bâtiment → clic sur la carte pour le
  poser. Clic droit / Échap annule.
- **Tour en bois** : défense automatique, 2 archers (gauche/droite) qui tirent
  des flèches sur les zombies uniquement. Posable partout (ville incluse,
  hors ville incluse).
- L'architecture est **table-driven** via `G.TOWER_STATS` (`src/config.js`) :
  chaque niveau futur (pierre, métal…) est une nouvelle entrée, aucun autre
  fichier à toucher pour le gameplay du niveau.

## 2. Économie et coffre de la mairie

- **Or commun** : le compteur de référence est le coffre de la mairie
  (`state.mairieGold`). Les achats tech et les tours se paient dessus.
  L'église (reliques) alimente le coffre.
- **100 pièces au sol** au démarrage (`buildWorld`, `src/world.js`), hors
  ville, réparties aléatoirement (mécanique d'item identique à la relique).
- **Oiseaux** : à la mort, drop d'une pièce d'or avec probabilité
  `BIRD_GOLD_CHANCE = 0.5`, en plus du drop aléatoire existant.
- **Ramassage** : clic sur la pièce → crédit **direct** au coffre de la mairie
  (pas par le sac). Floater « +1 pièce ».

## 3. Déverrouillage tech + vote (mairie)

- Section **Technologies** dans le coffre de la mairie :
  « Scierie — 100 planches + 10 or ».
- **Solo** : achat immédiat si le coffre suffit.
- **Multijoueur** : le joueur lance une proposition → vote **15 s**, majorité
  **stricte des joueurs connectés**, l'initiateur compte « pour », refus →
  aucun débit, **cooldown 30 s** avant nouvelle proposition. Le serveur est
  autoritaire sur le vote et le débit.
- Une fois débloquée : `state.scierieUnlocked = true` (synchronisé). Le
  bâtiment scierie est **unique** : on ne peut en poser qu'une.

## 4. Pose des bâtiments (scierie et tours)

- **Z** → mode pose (`state.buildMode`, comme les palissades).
- **Clic sur la scierie** (hors mode pose, rayon de clic comme mairie/église)
  → **menu de construction** listant les bâtiments constructibles :
  « Palissade », « Tour en bois » (généré depuis les tables : toute nouvelle
  entrée de `TOWER_STATS` s'affiche automatiquement).
- Sélection → mode pose avec **empreinte = taille du PNG** (même règle que
  `wallSpriteDims` : collision = 4× le PNG, comme les bâtiments). La tour
  **ne pivote pas**.
- Pose : vérif chevauchement bâtiments/murs, paiement au coffre (tour :
  50 or + 20 planches), grace period + `pushPlayerOutOfWall` réutilisés.
  - Scierie : **dans la ville uniquement** (`G.inTown`).
  - Tour : **partout**.
- **Chantier 10 s** (`G.TOWER_BUILD_TIME`) pour la scierie ET la tour :
  anim `chantier` en **un seul tour complet** sur la durée (frame =
  progression `builtAt → builtAt + TOWER_BUILD_TIME`, figée sur la dernière
  frame ensuite), aucun fonctionnement pendant le chantier,
  bâtiment **dès le début** solide et attaquable.

## 5. Sprites (`assets/sprites/tour/`, `assets/sprites/scierie/`)

Nomenclature (sondage auto des frames `-0.png, -1.png…`, cf. README assets) :

| Frames | Rôle |
|---|---|
| `tour/chantier-0..N.png` | **un seul tour** pendant les 10 s de construction |
| `tour/idle-0..N.png` | boucle lente une fois construite — **ne doit pas toucher aux pixels des archers** |
| `tour/gauche-0..N.png` | overlay tir gauche — **PNG complet de la tour**, découpé en **moitié gauche** au rendu |
| `tour/droite-0..N.png` | overlay tir droite — idem, **moitié droite** |
| `scierie/idle.png`, `scierie/chantier.png` | scierie construite / en chantier |

Règles de dessin :
- Toutes les frames d'une même série ont **exactement les mêmes dimensions**.
- Chaque archer reste **entièrement dans sa moitié** du PNG.
- Entre `idle` et les overlays, seule la zone de l'archer change.
- Les archers sont en haut du PNG → **le projectile part des 10 % les plus
  hauts** de la tour.
- Tour détruite : aucune trace, **son** dédié (`assets/sounds/tourCasse.mp3`).

## 6. Rendu des tours (ordre par frame)

1. En chantier : draw `chantier` (frame = progression du chantier, **un seul
tour** sur `TOWER_BUILD_TIME`, dernière frame figée ensuite).
2. Construite : draw `idle` (boucle lente).
3. Si `animL > 0` : draw `gauche` restreint au rect source **moitié gauche**,
   frame calculée depuis `animL`.
4. Si `animR > 0` : draw `droite` restreint à la **moitié droite**.

`animL`/`animR` sont deux timers indépendants (durée dans `TOWER_STATS`),
décrémentés par frame. Les tirs simultanés gauche/droite sont gérés sans
conflit grâce à la découpe en moitiés disjointes. Coût max 3 `drawImage`
par tour, et 1 draw tant qu'aucun tir récent.

## 7. Combat

- **Ciblage par côté** : demi-espace par `x` (`z.x < tour.x` → gauche, sinon
  droite). Chaque côté a son cooldown indépendant et tire sur le **zombie le
  plus proche** de son demi-espace à portée.
- **Stats tour en bois** (`G.TOWER_STATS.bois`, `src/config.js`) :

| Champ | Valeur |
|---|---|
| `hp` | 500 |
| `dmg` | 25 |
| `range` | 300 px |
| `cd` | 1,0 s (par côté) |
| `arrowSpeed` | 500 px/s |
| `fogRadius` | 300 px |
| `cost` | 50 or + 20 planches |
| `animDur` | durée d'anim de tir (s) |
| `idleFps` | vitesse de la boucle idle (le chantier n'a plus de fps dédié :
  un seul tour calé sur `TOWER_BUILD_TIME`) |

Puissance / portée / cadence **identiques gauche et droite** (une seule
entrée : la parité est structurelle).

- **Flèche** : projectile `type: "fleche"` dans `state.projectiles` — rendu
  **trait noir orienté** selon `dx, dy` (pas une boule). **Non-perforante**
  (premier zombie touché), **passe au-dessus des palissades** (aucune
  collision projectile-mur), **ignore joueurs et oiseaux** (champ
  `owner: "tour"`, filtre zombies uniquement).
- **PV** : la tour est dégradée comme une palissade (`ZOMBIE_WALL_DMG` +
  `swarmBonus`, `wallCd` identique), dès le début du chantier.

## 8. Priorité des zombies (modif `src/zombies.js`)

Ordre de ciblage, « si accessible » (détection à `ZOMBIE_WALL_SENSE = 60` px) :

1. **Palissade** (comme aujourd'hui)
2. **Tour** (tour à portée de sense → cible effective)
3. Mairie / joueur (comportement inchangé)

Une tour derrière une palissade intacte reste protégée (la palissade capte
l'aggro). Détruite pendant le chantier : ressources **perdues**.

## 9. Brouillard (`src/render.js` — `drawFog` multi-sources)

- Sources de lumière : le joueur (`FOG_RADIUS`, inchangé) + **chaque tour
  construite** (`fogRadius` depuis `TOWER_STATS`).
- Composition de dégradés radiaux (union des zones dégagées), uniquement hors
  ville (la ville reste toujours visible). Effet : sentiment de sécurité à
  proximité d'une tour, même hors les murs.

## 10. Multijoueur (serveur autoritaire)

- `src/towers.js` chargé par `server/game.js` via le mécanisme eval existant →
  la simulation (chantier, ciblage, tirs, PV, priorité zombie, vote) tourne
  **côté serveur** à 20 Hz.
- Snapshot : `towers[]` (position, pv, niveau, timers d'anim compressés en
  `lastShotL/R`), `scierieUnlocked`, `mairieGold`, état du vote en cours.
- Client : rendu + inputs (`netInput` étendu : `poseScierie`, `selectBuild`,
  `poseTower`, `vote`).
- Animations recalculées côté client depuis les timestamps du snapshot.

## 11. Fichiers touchés

| Fichier | Changement |
|---|---|
| `src/towers.js` | **nouveau** : module complet scierie + tours |
| `src/config.js` | `TOWER_STATS`, `TOWER_BUILD_TIME`, `BIRD_GOLD_CHANCE`, constantes vote |
| `src/world.js` | 100 pièces au sol (item type pièce) |
| `src/birds.js` | drop pièce (p = 0.5) |
| `src/input.js` | clic scierie → menu build, pose tour/scierie, votes |
| `src/zombies.js` | priorité tour entre palissade et mairie |
| `src/render.js` | `drawTower` (4 étapes), `drawProjectiles` flèche, `drawFog` multi-sources |
| `src/assets.js` | manifeste `tour` + `scierie` |
| `src/player.js` | coffre mairie : section technologies + vote |
| `src/net.js` / `server/game.js` | snapshot towers/vote/or, inputs, simu partagée |
| `index.html` | charger `towers.js` avant `zombies.js` |
| `assets/sounds/` | son destruction tour (`tourCasse.mp3`) |
| `CONTEXT.md` / `docs/` | documentation du système |

## 12. Découpage en étapes (une PR/commit par étape, testable à chaque fois)

1. **Économie** : coffre mairie, 100 pièces, drop oiseaux, ramassage → coffre.
2. **Déverrouillage scierie** + vote (solo : achat direct).
3. **Pose scierie** (chantier 10 s, rendu) + menu de construction.
4. **Pose tour** (empreinte PNG, chantier, rendu, collisions joueur/zombies).
5. **Combat tour** (ciblage demi-espace, flèches, anims L/R par moitiés).
6. **Priorité zombies** + destruction/son.
7. **Brouillard multi-sources**.
8. **Multijoueur** (snapshot, votes, sync).
