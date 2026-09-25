# Spec — Tour de siège

> Système : ennemi nocturne qui avance vers la palissade à mi-vitesse des
> zombies, s'y colle, s'ouvre et libère 100 zombies de l'autre côté du mur.
> Module partagé client + serveur : `src/siege.js`, chargé **avant**
> `zombies.js` (les zombies ignorent les tours de siège : elles ne sont pas
> une cible de l'IA, mais ils entrent en collision avec leur emprise basse).

## 1. Vue d'ensemble

- **Apparition** : dès la **2ᵉ nuit d'attaque**. Nuit 1 : aucune. Nuit 2 :
  1 tour. Nuits suivantes : la même croissance que les vagues de zombies
  (`ZOMBIE_WAVE_GROWTH`, ×2 par nuit), plafonnée à `SIEGE_MAX_TOWERS = 10`.
  Le spawn a lieu au passage de 22h (`NIGHT_WAVE_HOUR`), une fois par jour
  (`siegeSpawnedForDay`, réarmé à 8h) — en même temps que la vague de
  zombies.
- **Compteur** : `G.siegeCountForDay(day)` (jour 0-indexé) renvoie le nombre
  de tours de la nuit du jour `day`. Le scan de la montgolfière affiche ce
  nombre pour la nuit à venir (`Tours de siège : N`, masqué si 0).
- **Vitesse** : `SIEGE_SPEED = ZOMBIE_SPEED * 0.5` (deux fois moins vite
  qu'un zombie), modulée par la montée en difficulté `zombieRamp()`.
- **Objectif** : se coller au mur **le plus proche** (palissade construite
  la plus proche ; sans mur, le centre-ville). Sauf si elle croise un
  bâtiment, la tour va tout droit jusqu'à une palissade.
- **Contact mur** (écart AABB ≤ `SIEGE_CONTACT_GAP`) : la tour s'arrête,
  passe à l'état **ouvert** (sprite `ouvert` au lieu de `ferme`) et libère
  100 zombies (`SIEGE_RELEASE_COUNT`) de l'autre côté du mur, côté ville,
  en éventail autour de l'axe tour → mur (jamais derrière la tour). Chaque
  point de spawn est re-projeté hors des murs et des forêts. La libération
  a lieu **dès le tick de contact** (champ `released`, une seule fois).
- **Résistance** : `SIEGE_HP = 100` PV, soit 100 × un zombie
  (`ZOMBIE_HP = 1`). Dégâts par projectiles et explosions
  (`src/weapons.js`).
- **Forêts** : la tour passe dessus **sans collision**. Toute forêt
  chevauchée par son losange de base passe **directement à l'état coupé
  final** (`foretStage 4`, sprite `<fichier>s4` — `flattenForetsUnder`,
  appelé à chaque tick), puis **repousse normalement** comme une forêt
  coupée par un joueur (`regenForets` fait remonter d'un état par jour).
  Seuls les **bâtiments** (hors forêts) et les **murs** l'arrêtent.
- **Collision** : seule la **base isométrique** de la tour collisionne —
  un losange inscrit dans les **5 % les plus bas** du PNG
  (`SIEGE_COLLIDE_BOTTOM = 0.05`, `G.siegeDiamond`) avec les zombies et
  les personnages (joueur inclus). Les projectiles testent aussi cette
  emprise. Beaucoup plus étroit qu'un bloc plein : la pointe avant du
  losange s'insinue entre les obstacles et réduit les blocages.
- **Destruction** : une tour détruite laisse une **trace au sol**
  (`state.siegeTraces`) dessinée avec les PNG de `destruction/`. Cette
  trace ne collisionne plus rien et n'est plus un obstacle.

## 2. Directions & sprites

`G.SIEGE_DIRS` : les 4 diagonales de la carte, nommées par le sens de
marche (celui des dossiers de PNG) :

| key | sens |
|---|---|
| `sud-est-vers-nord-ouest` | du Sud-Est vers le Nord-Ouest |
| `sud-ouest-vers-nord-est` | du Sud-Ouest vers le Nord-Est |
| `nord-est-vers-sud-ouest` | du Nord-Est vers le Sud-Ouest |
| `nord-ouest-vers-sud-est` | du Nord-Ouest vers le Sud-Est |

Chaque direction a 2 états : `ferme` (déplacement, par défaut) et
`ouvert` (collée au mur). PNG dans
`assets/sprites/siege/<direction>/ferme.png` et `ouvert.png`
(éventuelles séries animées `ferme-0.png`, ...), traces dans
`assets/sprites/siege/destruction/` (`destruction.png` seul ou
`destruction1.png`, `destruction2.png`, ...). Chargement tolérant
(`src/assets.js`) : sans PNG, repli vectoriel dans `src/render.js`.
Le sens de marche est fixé au spawn et ne change pas en cours de route.

## 3. État & réseau

- Champs d'une tour : `x, y, w, h, dir, dx, dy, hp, maxHp, open, released,
  state ("move"|"open"), isSiege`.
- Snapshot serveur (`server/game.js`) : format compact
  `[x, y, dir, hp, open]` ; le client (`src/net.js`) réaligne les tours
  vivantes et crée les nouvelles. `siegeTraces` en objet `{x, y, v}`.
- Événements diffusés : `siegeOpen` (contact mur) et `siegeCasse`
  (destruction) — sons positionnés côté client (`EVENT_SFX`, `src/net.js`).
- Messages HUD : `siegeMsgTimer` (« Tours de siège en approche ! ») et
  floater à la libération.

## 4. Tests

`test/siege/tour_siege.js` : compteur par nuit, annonce montgolfière,
spawn au passage de 22h (et pas de double spawn), vitesse = moitié d'un
zombie, contact mur (arrêt + ouverture + 100 zombies côté ville +
immobilité), collisions tour ↔ tour, forêts (aplatissement direct à
l'état coupé final + repousse via `regenForets`), bâtiment (la tour ne
le traverse pas), résistance 100 PV, destruction → trace non
collisionnable, emprise de collision = losange de base (5 % du bas).
