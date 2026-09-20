# Mécanismes des zombies — déplacement & attaque

> Spécifique : tout ce qui concerne la façon dont les zombies **se déplacent**
> et **attaquent**. Référence de code : `src/zombies.js` (`updateZombies`,
> `spawnWave`, `mergeGroups`, `cleanupZombies`), constantes dans
> `src/config.js` (`ZOMBIE_*`, `GROUP_*`). Documentation générale du
> système : [zombies.md](zombies.md).

## Vue d'ensemble

Chaque zombie appartient à un **groupe** (8 membres, `GROUP_SIZE`). Le groupe
a un **chef** (`isLeader`, membre d'index 0) qui choisit seul la destination ;
les membres suivent leur **position de slot** autour du chef (formation). Le
choix de cible se fait à deux niveaux :

1. **Cible du groupe** (choisie par le chef) : joueur proche → mur qui barre
   la route → planches construites (pilleurs) → mairie.
2. **Cible effective de chaque zombie** (surcharge individuelle) : mur/tour
   détecté à portée personnelle, ou joueur traqué par un harceleur.

La nuit est le moteur des vagues (spawn à **22h**, `NIGHT_WAVE_HOUR`),
mais les zombies restent agressifs **jour et nuit** : seule la **retraite à
8h** (`ZOMBIE_RETREAT_HOUR`) les éloigne de la ville.

---

## 1. Cycle des vagues (horloge de jeu)

| Heure (jeu) | Événement |
|---|---|
| **8h** | Réarmement (`waveSpawnedForDay = false`) + pré-tirage de la vague du soir (`rollWave(day + 1)` → `state.pendingWave`, annoncé par la montgolfière) |
| **22h** (`NIGHT_WAVE_HOUR`) | `spawnWave()` : la vague apparaît, `zombieMode = "attack"`, message HUD « Vague de zombies ! » pendant 8 s |
| **8h (lendemain)** | `zombieMode = "retreat"` : les groupes survivants s'éloignent de la ville |

- Le spawn est **piloté par l'horloge** (détection du passage de 22h entre
  deux ticks), pas par un timer d'elapsed — une nuit sautée ne déclenche
  rien, un seul spawn par jour (`waveSpawnedForDay`).
- **Volume** : `ZOMBIE_PER_WAVE_BASE` (50) × `ZOMBIE_WAVE_GROWTH` (2)^jour →
  50, 100, 200, 400… plafonné à `ZOMBIE_WAVE_MAX` (5000).
- **Ramp de difficulté** : chaque nuit où la vague demandée dépasse le
  plafond monte les dégâts/s, les PV et la vitesse de **+10%**
  (`ZOMBIE_RAMP_STEP`), capé à **+50%** (`ZOMBIE_RAMP_MAX`). Le ramp
  s'applique aux zombies déjà en jeu comme aux futurs spawns.
- **Directions d'arrivée** : tirées par vague — 1 bord (1/3), 2 bords (1/3)
  ou les 4 bords (1/3). Chaque groupe arrive par un des bords tirés, à
  40–200 px du bord de la carte.

---

## 2. Organisation en groupes

- **Groupe** : `{ x, y, members[], formation, formPhase, isHorde, retreat, ... }`
  — `x,y` = position du chef.
- **Fusion** : toutes les `GROUP_MERGE_INTERVAL` (2 s), deux groupes dont les
  chefs sont à moins de `GROUP_MERGE_DIST` (320 px) fusionnent ; le plus gros
  absorbe l'autre, une nouvelle formation est tirée et les slots convergent
  de façon **animée** (lerp `ZOMBIE_SLOT_LERP` = 4/s) au lieu de sauter.
- **Formations** (`zombieSlot`) : anneau (défaut), ligne (perpendiculaire au
  mouvement, étagée), coin (quart de cercle), « V » (deux bras en éventail).
  Rayon de base `GROUP_FORMATION` (90 px).
- **Mode horde** : un groupe de ≥ `ZOMBIE_HORDE_THRESHOLD` (40) membres devient
  une horde — formation resserrée (`ZOMBIE_HORDE_DENSE` = 0.7), vitesse
  **+18%** (`ZOMBIE_HORDE_SPEED_BONUS`), message HUD « La horde arrive ! »
  (une fois par groupe).
- **Dispersion à la retraite** : en mode retraite, les slots s'élargissent
  (`ZOMBIE_RETREAT_SLOT_SCALE` = 1.6) avec du bruit
  (`ZOMBIE_RETREAT_SLOT_NOISE` = 40 px) — la horde se disperse au petit jour.

---

## 3. Choix de la cible

### Cible du groupe (chef)

Priorité décroissante :

1. **Joueur** : si `dist(groupe, joueur) < ZOMBIE_ATTACK_RANGE` (150 px).
2. **Mur qui barre la route** : le mur le plus proche du groupe, uniquement
   s'il est à moins de 40 px **et** plus proche que la mairie. Quand la
   planche attaquée tombe, la brèche rend le mur suivant plus loin que la
   mairie : le groupe re-vise la mairie au lieu de ronger toute la palissade.
3. **Planches construites** (pilleurs) : si le groupe contient au moins un
   `raider`, il dévie vers les planches `built` du joueur à moins de
   `ZOMBIE_RAID_RANGE` (520 px) — menace le travail du joueur.
4. **Mairie** (objectif par défaut, centre-ville) ; mairie détruite →
   `gameOver` (`gameOverCause: "mairie"`).
5. **Bruit** : un tir de joueur nouvellement apparu attire les groupes à
   moins de `ZOMBIE_NOISE_RANGE` (1600 px) pendant `ZOMBIE_NOISE_TIME` (4 s)
   vers le point du tir — **sans écraser** un joueur proche ni un mur
   immédiat. Seuls les tirs des **joueurs** font du bruit (les flèches des
   tours sont ignorées). Une fois arrivé sur le point de tir, le groupe
   reprend son objectif principal.

### Cible effective de chaque zombie (surcharge individuelle)

Chaque zombie détecte **individuellement** (à partir de sa propre position,
pas celle du groupe) :

1. **Mur à portée de sense** (`ZOMBIE_WALL_SENSE` = 60 px) — sauf si le
   joueur est déjà sa cible :
   - **Démolisseur** (`wallBreaker`, 50% = `ZOMBIE_BREAKER_RATIO`) : fonce
     droit sur le point le plus proche du mur et le frappe.
   - **Fouisseur** (les 50% restants) : longe le mur dans un sens fixe
     (`seekDir`, ±1 tiré au sort) à la recherche d'une **faille** (trou dans
     la palissade) — vitesse de longe `ZOMBIE_SEEK_SLIDE` (90 px/s).
2. **Tour à portée de sense** (60 px) : si **aucun** mur n'est à portée
   personnelle, la tour la plus proche est ciblée et attaquée comme une
   palissade (mêmes dégâts/cooldown). Un mur *hors* portée de sense ne masque
   pas la priorité tour.
3. **Joueur traqué** : un `harasser` (~15% = `ZOMBIE_HARASS_RATIO`) se
   détache du groupe et traque le joueur seul dès qu'il le détecte à
   `ZOMBIE_HARASS_RANGE` (620 px) — escouade divergente qui harcèle le joueur
   pendant que le reste du groupe fonce sur la mairie/les murs.

### Mode retraite (après 8h)

Le groupe s'éloigne du centre-ville jusqu'à `ZOMBIE_RETREAT_DIST` (700 px)
au-delà du périmètre, **mais** un mur à moins de 40 px reste ciblé et attaqué
avant de fuir (un mur collé reste attaqué, de nuit comme de jour).

---

## 4. Déplacement

### Le chef trace la route

- Vitesse du chef : `ZOMBIE_SPEED` (117 px/s, ~2× plus lent que le joueur)
  × ramp × bonus horde (+18%).
- Si le chef est à plus de 10 px de sa cible, il avance par **sous-pas de
  16 px** en testant la collision à chaque pas (murs + forêts).
- **Cap de base** : suit le **champ de navigation** (`G.navStep`, BFS vers la
  ville) quand il est disponible — il contourne les massifs de forêts par le
  chemin le plus court. Repli sur la ligne droite vers la cible.
- **Whisker** : si le cap direct est bloqué par une forêt, on essaie des caps
  de plus en plus déviés (15° → 180°, des deux côtés, sens préférentiel fixe
  par groupe `foretSeekDir`). Le premier cap libre est **mémorisé**
  (`foretCurAng`) ; à chaque tick on retente d'abord le cap direct (retour
  de trajectoire) → vrai contournement du massif plutôt qu'enlisement.
  Cul-de-sac total : inversion du sens de longe.
- **Chef piégé dans une forêt** : il marche vers le bord du massif situé
  dans la direction de sa cible (projection du cap sur l'AABB) pour en
  sortir.

### Les membres suivent

- Chaque membre vise sa **position de slot** : `chef + (cos(slotAng),
  sin(slotAng)) × slotDist`. Les slots convergent en continu vers leurs
  cibles recalculées (lerp `ZOMBIE_SLOT_LERP`).
- **Arrivée sur l'objectif** : quand le groupe est arrivé (chef à l'arrêt à
  portée de mur/tour/mairie, ou cible individuelle détectée), le membre ne
  reste pas en orbite autour du chef — il **pousse en continu** vers le point
  d'attaque tant qu'il n'est pas à portée de coup (signal stable, pas
  d'oscillation slot/objectif).
- Vitesse de chaque membre : `ZOMBIE_SPEED` × ramp × bonus horde ×
  `speedFactor` — facteur propre tiré à l'apparition dans
  [`1−ZOMBIE_SPEED_VAR`, `1+ZOMBIE_SPEED_VAR`] (±50%), clampé 0.4–1.6 :
  certains traînent, d'autres sont plus rapides.
- **Mouvement vivant** (« drunken walk ») : le cap de marche est dérivé
  d'une sinusoïde propre au zombie — amplitude `ZOMBIE_WANDER_AMP`
  (±0.5 rad), fréquence `wanderFreq` (~2.4 rad/s, variée par zombie), phase
  aléatoire.
- Déplacement par **sous-pas de 8 px** avec test AABB par axe (murs via
  `aabbHitsWalls`, forêts via `aabbHitsForets`) — un zombie ne traverse
  jamais une planche fine en un seul pas.

### Contournement quand il est bloqué

- **Bloqué par un mur** : glisse le long (biais latéral
  `ZOMBIE_WALL_SLIDE` = 60 px/s, côté alterné toutes les 0.5 s ; sens fixe
  pour un fouisseur). Un fouisseur épuisé (`blockedSides > 12`) qui n'a pas
  trouvé de faille ne reste pas inactif : **il attaque le mur qu'il longe**.
- **Bloqué par une forêt** :
  1. se réoriente vers le mur le plus proche à moins de
     `ZOMBIE_FORET_REORIENT` (360 px) pour rejoindre la palissade ;
  2. sinon glisse le long du massif dans un sens fixe propre au zombie ;
  3. coin de massif (les deux sens bloqués, `blockedSides > 8`) : s'échappe
     en s'écartant du centre de la forêt, puis reprend le glissement.
- **Zombie à l'intérieur d'une forêt** (spawn, repoussement de séparation) :
  aucune position intérieure n'est valide en collision — il marche droit
  vers le bord le plus proche pour en sortir avant toute autre chose.

### Séparation

Grille spatiale (cellules de 32 px, recalculée chaque tick pendant une
vague) : deux zombies trop proches se repoussent pour garder **1 px
d'écart** (`ZOMBIE_HALF` × 2 + 1). La séparation ne pousse **jamais** un
zombie à l'intérieur d'une forêt. Superposition exacte : poussée dans une
direction aléatoire.

### Spawn

- Position initiale : formation autour du chef, **clampée** à 12 px du bord
  de la carte (une formation ne déborde jamais hors du monde).
- **Jamais dans une forêt** : si le point de spawn tombe dans un massif, on
  pousse le point vers l'extérieur du groupe par pas de 20 px (jusqu'à 16
  essais).

---

## 5. Attaque

### Portées et fréquences

| Cible | Portée de coup | Dégâts | Cooldown |
|---|---|---|---|
| Joueur | < 14 px | `ZOMBIE_PLAYER_DMG` (20) × ramp | `ZOMBIE_ATTACK_CD` (1 s) |
| Mur / tour / mairie | < `ZOMBIE_WALL_HIT` (22 px, distance au bord) | `ZOMBIE_WALL_DMG` (1) × ramp + bonus de meute | `ZOMBIE_WALL_CD` (10 s) |

- **5 coups = mort du joueur** (100 PV). Un zombie ne frappe le joueur qu'à
  la main, jamais à distance.
- PV d'un zombie : `ZOMBIE_HP` (1) × ramp → un coup de feu le tue (hors
  ramp, qui peut demander plusieurs balles les nuits de dépassement).

### Attaque de meute (`swarmBonus`)

Les dégâts aux murs/tours/mairie augmentent d'**un point par assaillant
voisin** (`ZOMBIE_SWARM_BONUS` = 1) à moins de `ZOMBIE_SWARM_RADIUS`
(24 px), capé à `ZOMBIE_SWARM_CAP` (5) assaillants — une meute collée au
même mur frappe plus fort, impression de coups frappés ensemble.

### Télégraphie (lunge)

Chaque coup déclenche un **élan visuel** vers la cible pendant
`ZOMBIE_LUNGE_TIME` (0.15 s) : le sprite penche vers l'avant
(`lunge`/`lungeDx`/`lungeDy`, offset visuel `ZOMBIE_LUNGE_VIS` = 3 px dans
`drawZombie`). Même en cooldown, un zombie collé à sa cible continue de
presser/frapper (lunge répété sans dégâts) — il ne reste jamais figé.

### Hiérarchie visible

Le chef (`isLeader`) est rendu plus gros et teinté rouge/sang. À sa mort, le
membre suivant prend le relais (index 0 recalculé à chaque tick et à chaque
fusion).

---

## 6. Mort et nettoyage (`cleanupZombies`)

- Un zombie à 0 PV est retiré du groupe et du monde ; les groupes vides
  disparaissent.
- **Trace de sang** : chaque mort dépose une tache au sol (variante tirée au
  hasard, légère rotation aléatoire), taille réglée par
  `DEAD_TRACES_SCALE` (×3). Plafond `DEAD_TRACES_MAX` (500 traces, les plus
  récentes) pour éviter une croissance infinie du snapshot/rendu.

---

## 7. Récapitulatif des constantes (`src/config.js`)

| Constante | Valeur | Sens |
|---|---|---|
| `NIGHT_WAVE_HOUR` | 22 | Heure de spawn de la vague |
| `ZOMBIE_RETREAT_HOUR` | 8 | Heure de retraite |
| `ZOMBIE_RETREAT_DIST` | 700 | Distance de fuite hors ville (px) |
| `ZOMBIE_PER_WAVE_BASE` | 50 | Zombies à la 1re vague |
| `ZOMBIE_WAVE_GROWTH` | 2 | ×2 zombies chaque nuit |
| `ZOMBIE_WAVE_MAX` | 5000 | Plafond de zombies par vague |
| `ZOMBIE_RAMP_STEP` / `ZOMBIE_RAMP_MAX` | 0.10 / 0.50 | +10%/nuit au plafond, capé +50% (dégâts, PV, vitesse) |
| `GROUP_SIZE` | 8 | Membres par groupe |
| `GROUP_FORMATION` | 90 | Rayon de base des slots (px) |
| `GROUP_MERGE_DIST` / `GROUP_MERGE_INTERVAL` | 320 / 2.0 | Fusion des groupes proches (px / s) |
| `ZOMBIE_SPEED` | 117 | Vitesse de base (px/s, ~2× plus lent que le joueur) |
| `ZOMBIE_SPEED_VAR` | 0.5 | Variation de vitesse individuelle (±50%) |
| `ZOMBIE_WANDER_AMP` / `ZOMBIE_WANDER_FREQ` | 0.5 / 2.4 | Amplitude (rad) et fréquence du « drunken walk » |
| `ZOMBIE_ATTACK_RANGE` | 150 | Portée de détection du joueur par le groupe (px) |
| `ZOMBIE_HARASS_RATIO` / `ZOMBIE_HARASS_RANGE` | 0.15 / 620 | Proportion / portée de traque des harceleurs |
| `ZOMBIE_RAIDER_RATIO` / `ZOMBIE_RAID_RANGE` | 0.20 / 520 | Proportion / portée des pilleurs (planches `built`) |
| `ZOMBIE_WALL_SENSE` | 60 | Portée de détection individuelle d'un mur/tour (px) |
| `ZOMBIE_WALL_HIT` | 22 | Portée de coup sur mur/tour/mairie (px) |
| `ZOMBIE_BREAKER_RATIO` | 0.5 | Démolisseurs (fonce sur le mur) vs fouisseurs (longe) |
| `ZOMBIE_WALL_DMG` / `ZOMBIE_WALL_CD` | 1 / 10 s | Dégâts aux structures / cooldown (hors bonus de meute) |
| `ZOMBIE_PLAYER_DMG` / `ZOMBIE_ATTACK_CD` | 20 / 1 s | Dégâts au joueur / cooldown |
| `ZOMBIE_SWARM_BONUS` / `ZOMBIE_SWARM_CAP` / `ZOMBIE_SWARM_RADIUS` | 1 / 5 / 24 | Bonus de meute par assaillant proche |
| `ZOMBIE_WALL_SLIDE` | 60 | Vitesse de glissement le long d'un mur (px/s) |
| `ZOMBIE_SEEK_SLIDE` | 90 | Vitesse de longe d'un fouisseur (px/s) |
| `ZOMBIE_FORET_REORIENT` | 360 | Portée de réorientation vers le mur quand bloqué par une forêt (px) |
| `ZOMBIE_NOISE_RANGE` / `ZOMBIE_NOISE_TIME` | 1600 / 4 s | Attraction par le bruit des tirs du joueur |
| `ZOMBIE_HORDE_THRESHOLD` | 40 | Membres min. pour le mode horde |
| `ZOMBIE_HORDE_SPEED_BONUS` / `ZOMBIE_HORDE_DENSE` | 0.18 / 0.7 | Vitesse accrue / formation resserrée en horde |
| `ZOMBIE_SLOT_LERP` | 4.0 | Vitesse de convergence des slots (fusion animée) |
| `ZOMBIE_RETREAT_SLOT_SCALE` / `ZOMBIE_RETREAT_SLOT_NOISE` | 1.6 / 40 | Dispersion des slots à la retraite |
| `ZOMBIE_LUNGE_TIME` / `ZOMBIE_LUNGE_VIS` | 0.15 / 3.0 | Durée (s) / amplitude (px) de l'élan visuel |
| `ZOMBIE_HP` | 1 | PV de base (× ramp) |
| `DEAD_TRACES_SCALE` / `DEAD_TRACES_MAX` | 3 / 500 | Taille des taches de sang / plafond de traces |
