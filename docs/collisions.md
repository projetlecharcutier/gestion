# Collisions — audit global (`src/player.js`, `src/world.js`, `src/ville.js`, `src/zombies.js`, `src/walls.js`, `src/towers.js`)

Recense TOUS les mécanismes de collision et leurs contrats. Deux familles coexistent
et **ne doivent pas être mélangées** : les éléments de décor/forêts/maisons (AABB de
bâtiment) et les villes PNG (masque pixel). Specs détaillées : [world.md](world.md)
(décors/forêts), [ville.md](ville.md) (villes PNG).

## Vue d'ensemble — qui teste quoi

| Entité | Décors & forêts & bâtiments | Villes PNG (masque) | Murs/planches | Sièges |
|---|---|---|---|---|
| **Joueur** (déplacement `tryMove`) | AABB `PLAYER_W`×`PLAYER_W` centrée (`aabbHitsBuildings`, `b.hit` si défini, `decorPassable` ignoré) | **POINT unique sous les pieds** (`playerHitsVilles` → `aabbHitsVilles(point)`) : rouge bloque, vert/transparent passent | AABB pleine | AABB (`aabbHitsSieges`) |
| **Zombies** | Forêts uniquement (`aabbHitsForets`) + `hitsObstacle` combine forêts + villes via `aabbHitsVillesCenter` (AABB, demi-côté `ZOMBIE_HALF`) ; traversent les autres bâtiments (cible = mairie) | AABB pleine (cellules rouges) | — (attaquent) | — |
| **Flow field** (`rebuildNavGrid`) | cellules couvertes par forêts | `villeBlockNav` marque les cellules nav 32 px dont le **centre** tombe sur une cellule rouge | non | non |
| **Pose de planches** (`walls.js`) | `aabbHitsBuildings` | `aabbHitsVilles` AABB pleine | autres planches | — |
| **Pose de tours** (`towers.js`) / soldats | AABB pleine | `aabbHitsVilles` AABB pleine | — | — |
| **Génération** (forêts, maisons, items, décors, torches) | `nearBuilding` + `decorBoxHitsBuildings` (grille spatiale 512 px) | `villeBoxHits` (emprise **peinte** du PNG via carte d'opacité) / repli `villeAt` | `aabbHitsWalls` | — |
| **Faune** | `aabbHitsBuildingsBox` | `aabbHitsVillesCenter` | — | — |

Le joueur est donc la **seule entité** avec un contrat « point sous les pieds » sur
les villes ; tous les autres gardent un test AABB. C'est voulu (commit
33c8cd5) : le personnage est représenté par le pixel sous ses pieds contre les
villes, et par sa boîte contre tout le reste. Ne pas uniformiser sans relire
`test/ville/point_pieds_joueur.js`.

**Anti-tunneling obligatoire** (`tryMove`, `src/player.js`) : `_stepMove` ne
teste que le point d'ARRIVÉE de chaque sous-pas — un sous-pas de 8 px saute
les murs rouges fins des masques (régression 33c8cd5 : le joueur traversait
les façades de toutes les villes). `STEP_VILLE = 1` px dès que le joueur
approche une grille de ville (via `villeCellInfo` ou AABB 8×8 de détection) ;
le pas standard de 8 px reste en campagne. Non-régression :
`test/ville/antitunnel_murs_ville.js`.

## Mécanisme 1 — Éléments de décor, forêts, maisons (AABB de bâtiment)

Code : `makeDecor` / `makeForet` / `makeBuilding` (`src/world.js`), testé par
`aabbHitsBuildingsBox` (`src/player.js`, grille spatiale + repli linéaire).

Un décor est un objet bâtiment `isDecor` avec trois modes (`DECOR_SPECS`) :

| Mode | Drapeau | Collision | Rendu |
|---|---|---|---|
| `bloquant` | — | AABB = **zone opaque réelle du PNG** (`shrinkToOpaque`), sauf cas spécial montagne | tri `depth = x + y` standard |
| `nonbloquant` | `decorPassable: true` | aucune (ignoré par `aabbHitsBuildings`) | tri standard (le joueur passe dessus) |
| `dessous` | `decorPassable` + `decorSous: true` | aucune | dessiné APRÈS le joueur (depth max) — le joueur passe SOUS la texture (éoliennes, cerf géant) |

Règles clés :

- **Hitbox = zone opaque du PNG**, jamais le losange complet :
  `shrinkToOpaque(b, "elementdecord", frame)` resserre `b.hit` sur les pixels
  opaques. `aabbHitsBuildingsBox` teste `b.hit || b`.
- **Cas montagne** (`bloquant/montagne`, PNG plein cadre) : hitbox ancrée au
  **SUD** (~55 % de l'emprise), codée en dur — le massif visible occupe le bas
  du losange, une hitbox centrée couvrait du ciel.
- **`renderScale`** (ex. église de Lisieux ×0.4) : échelle du **rendu seulement**.
  L'emprise sol (collision + placement) reste `sprite.w * 2`, taille réelle du
  PNG — un décor rendu plus grand ne déborde ni sur ses voisins, ni sur les
  collisions.
- **Forêts** : même logique (`makeForet` + `shrinkToOpaque`), avec
  `refitForet(b)` qui **recalcule la hitbox à chaque état de coupe** (sprite
  `s0`→`s4` plus petit) et `foretDepleted(b)` qui rend une forêt entièrement
  coupée **traversable**.
- **Placement** (`spawnDecor`) : filtre losange (side×side) contre
  villes/murailles, filtre **hitbox shrinked** contre bâtiments/forêts,
  `decorBoxHitsBuildings` avec une grille spatiale 512 px pour éviter le O(n²).
  **Miroir vertical** `decorFlip` 50/50 à la pose pour les modes non bloquants
  (sérialisé dans le snapshot serveur).
- **Parité client/serveur** : le serveur charge `world.js` tel quel
  (`server/game.js`) ; `dom-stub.js` fournit des dimensions de sprites calées
  sur les PNG réels — **toute divergence de dimension fausse la simulation**
  (historique : des forêts factices 128 → massifs 256×256 en simulation).
  `hit`, `decorPassable`, `decorSous`, `decorRenderScale` sont sérialisés dans
  le snapshot (`server/game.js`).

## Mécanisme 2 — Villes PNG (masque pixel, grille 1 px)

Code : `src/ville.js`. Chaque ville = `ville.png` + `ville_mask.png` (même
taille, couleurs pleines sans anti-aliasing) :

- **rouge** = solide : bloque joueur (point pieds), zombies (AABB), planches,
  tours, soldats, navigation (flow field)
- **vert** = libre : le personnage passe **DERRIERE** le PNG (occlusion)
- **transparent/blanc** = libre : le personnage passe **DEVANT** (tri naturel)

Contrats (détail dans [ville.md](ville.md)) :

| Fonction | Contrat |
|---|---|
| `aabbHitsVilles(bx, by, bw, bh, opts)` | AABB contre cellules rouges ; `opts.point` → test du point seul (contrat joueur) |
| `aabbHitsVillesCenter(x, y, half)` | variante demi-côté (zombies, faune) |
| `playerHitsVilles(x, y)` | point sous les pieds : **rouge seul bloque** ; c'est le même point qui décide collision ET occlusion (`villeCellInfo`/`villeMaskAtFoot`) — les deux ne peuvent pas diverger |
| `villeMaskAtFoot(x, y)` | 1 rouge / 2 vert / 0 transparent / -1 hors ville — source de vérité unique |
| `villeBlockNav(blocked, cols, rows, cell)` | marque les cellules nav 32 px dont le centre est rouge (flow field) |
| `villeBoxHits` / `villeAt` | emprise **peinte** (carte d'opacité) pour écarter la génération ; la partie transparente du PNG accepte le recouvrement avec les décors, jamais avec les façades |
| `villeEscape(x, y)` | direction du bord le plus proche — extraction d'un zombie pris dans une cellule solide |

Règles clés :

- **Grille 1 px, décodée une fois** : `villeGridFromPixels` (fonction PURE)
  partagée client (canvas) et serveur (`server/ville-grids.json` généré par
  `gen-sprite-meta.js`) → parité exacte. Le masque couvre la projection écran
  du PNG **entier** (élévation comprise), pas seulement l'emprise au sol.
- **Occlusion par bandes** : `villeBands` découpe le PNG en bandes
  horizontales insérées dans le tri `depth = x + y` de `render()` ; le masque
  des pieds (`villeCellInfo`) tranche le mode (devant/derrière), et chaque
  bande chevauchant le joueur échantillonne le masque à sa hauteur
  (`villeCellAtScreen`) — seule la partie verte du PNG passe devant lui.
- **Grilles tardives** : `villeCellInfo` re-tente `buildVilleGrids()` si une
  grille manque (join serveur plus rapide que le chargement des assets) —
  sans cela l'occlusion ne s'appliquait jamais.
- **Zombies coincés** : spawn dans une cellule rouge → `villeEscape` pousse
  vers le bord (comme `foretAt` pour les massifs).
- **Filtre de sol carré, pas losange** (L1) — le losange ignorait le bas du
  PNG (le joueur traversait les façades hautes).

## Contraintes transverses

- **Ne jamais mélanger les contrats** : point-pieds = joueur vs villes
  uniquement ; AABB = tout le reste. Un futur changement (ex. boîte joueur vs
  villes) doit mettre à jour `test/ville/point_pieds_joueur.js` et
  `villeCellInfo` en même temps (collision et occlusion partagent le point).
- **Le flow field doit rester en parité avec les collisions réelles** (villes
  via `villeBlockNav`, forêts dans `rebuildNavGrid`) : une divergence = zombies
  coincés ou traversant les murs (`docs/flowfield.md`).
- **Parité client/serveur stricte** : mêmes PNG, mêmes dimensions de sprites,
  même fonction pure de décodage des masques. Tout ajout de source de blocage
  doit être ajouté des deux côtés.
- **Règles de rendu établies** : jamais de fond sous les décors (le jaune ne
  concerne que les vrais bâtiments, PNG jamais modifiés) ; champs toujours
  dessous le joueur (mode `dessous`).

## Tests de référence

| Test | Couverture |
|---|---|
| `test/ville/point_pieds_joueur.js` | contrat point-pieds joueur vs villes (rouge bloque, vert/transparent passent) |
| `test/ville/antitunnel_murs_ville.js` | anti-tunneling : le joueur ne saute jamais un mur rouge continu (sous-pas 1 px près des villes) |
| `test/ville/occlusion_masque.js`, `occlusion_haut_png.js`, `occlusion_grilles_tardives.js`, `ordre_biais_occlusion.js` | occlusion du joueur par les bandes, grille couvrant l'élévation, grilles tardives |
| `test/ville/masque_vert_nogent.js`, `recouvrement_transparent.js`, `bords_carte.js` | masque vert, recouvrement zones transparentes, bords de carte |
| `test/world/elements_decor.js`, `decor_hitbox_murs.js`, `decor_flip.js`, `decor_anim_frames.js`, `lisieux_groupe.js` | modes de décor, hitbox shrinked, miroir, échelle de rendu, placement |
| `test/world/anneau_unique.js`, `torches_poteaux.js` | placement torches/anneaux vs villes et bâtiments |

Note : les tests ville/world sont coûteux en mémoire ; en run parallèle complet
ils peuvent être tués (rc=137) par le sandbox — un échec doit être vérifié **en
isolé** (`node test/ville/xxx.js`) avant de conclure à une régression.
