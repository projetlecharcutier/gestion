# Tests Flex Survival

Tests Node.js sans framework, executables directement : `node test/<categorie>/<fichier>.js`
(code 0 = OK, 1 = echec). Runner global :

```bash
./test/run.sh            # tous les tests
./test/run.sh zombies    # une seule categorie
./test/run.sh loopback
```

Les tests sont autonomes (stubs DOM embarques, aucun navigateur requis) et
utilisent des chemins relatifs au repo : ils tournent depuis n'importe quel
emplacement de clone.

## Categories

### `zombies/` — IA et vagues
- `zombies_actifs.js` / `zombies_actifs_vague.js` : aucun zombie inactif (fenetre glissante 1 s),
  chaque zombie bouge ou attaque en permanence.
- `muraille_formation.js` : un groupe arrete a la muraille finit par attaquer le mur
  (membres loin du chef inclus), pas d'agglomeration sterile.
- `orbit_chef.js` / `voisins_slots.js` : un membre pousse vers l'objectif au lieu
  d'orbiter autour du chef ; non-regression des comportements de slots voisins.
- `flowfield_contournement.js` : le flow field (`src/flowfield.js`) bloque bien les
  cellules de foret, ses fleches descendent le gradient BFS, et un groupe bloque
  derriere un massif le contourne et atteint la palissade.
  N.B. `zombies_actifs.js` genere un monde aleatoire non seede : selon le tirage,
  des couloirs etroits entre massifs figent des groupes au-dessus du seuil de 1%
  meme sur `main` (pre-existant, sans lien avec le flow field).
- `ramp_mairie.js` : plafond 5000 zombies/nuit, ramp degats/PV/vitesse (cap +50%),
  la mairie reste l'objectif principal apres la destruction d'un mur.
- `vagues_directions.js` / `vagues_directions_srv.js` : directions des vagues tirees
  au hasard (1, 2 ou 4 bords), spawn hors ville, serveur inclus.
- `attaque_tour.js` : un zombie a portee d'une tour l'attaque meme si des murs
  existent ailleurs dans le monde (le mur hors de portee de sense ne masque pas la tour).

### `serveur/` — logique serveur (require direct de `server/game.js`)
- `smoke_config.js` : chargement du module + constantes tour/scierie.
- `flux_snapshot.js` : addPlayer -> buildSel/placeBuild -> tick -> snapshot.
- `taille_snapshot.js` / `taille_snapshot_culling.js` : taille du snapshot, culling
  par joueur (bande passante a 5000 zombies).
- `coffre_partage.js` : depot/retrait dans le coffre de la mairie via inputs.
- `vote_majorite.js` : vote a la majorite (scierie), deblocage tech.
- `batiments_ville_vote.js` : techs generiques, pose universite/montgolfiere.
- `bruit_tours.js` : les fleches des tours ne font pas de bruit (seuls les tirs
  joueur attirent les groupes).
- `reliques_nocturnes.js` : 5 reliques repop a chaque nouveau jour.

### `loopback/` — integration reelle client<->serveur (WebSocket sur 127.0.0.1)
- `integration_complete.js` : marche -> relique -> eglise (+100 or) -> vote scierie
  -> menu (buildSel) -> pose scierie -> chantier -> pose tour hors ville.
- `vote_pose_scierie.js` : variant courte (vote -> pose scierie).
- `smoke_ws.js` : serveur reel demarre, join, snapshots recus (towers/scierie/mairie).
- Ces tests font marcher un joueur vers une relique : si le monde aleatoire place
  un batiment sur le chemin, le test contourne puis passe a la relique suivante.

### `chop/` — coupe de bois a la hache
- `jitter_reseau.js` : inputs client a ~15 Hz avec serveur a 20 Hz, la coupe doit
  reussir (regression du bug "fire reset chaque tick").
- `flux_reel.js` : pickup hache -> equip -> fire maintenu -> planches creditees.
- `cinq_planches.js` : 5 planches par coup de hache (hors ville).
- `animation_hache_srv.js` : animation de hache et tir pistolet en ligne (serveur).
- `anim_arret_relachement.js` : apres un coup complet, le relachement du clic doit
  arreter l'emission de chop/chopAge (sinon l'animation de hache et le cercle de
  decompte bouclent cote client tant qu'on reste pres de l'arbre).

### `buildings/` — batiments de ville et tours
- `batiments_ville.js` / `chantiers.js` : scierie/universite/montgolfiere, chantiers
  (10 s), etats.
- `anim_tour_tailles.js` : animations de tir gauche/droite chargees, tailles
  (scierie, tour -30%).
- `cout_tour_reliques.js` : tour a 1 or, 5 reliques hors ville, spots valides.
- `scierie_config.js` : scierie -20% (64 px), message mairie, reliques.

### `menu/` — menu de construction (Z) et HUD
- `menu_build.js` : contenu du menu selon deblocages (palissade / scierie / tours).
- `menu_hud.js` : rendu du panneau, explications mairie.

### `world/` — monde et rendu
- `brouillard.js` : brouillard multi-sources (joueur + tours), union des trous,
  pas d'ecran noir en sortant de la ville.
- `taches_herbe.js` : taches de couleur au sol (densite, carres alignes, couleurs).

## Notes d'execution

- Node >= 18 requis (`server/package.json`).
- Les tests `loopback/` bindent des ports localhost (45742+) : ne pas les lancer
  en parallele ; le runner nettoie les serveurs residuels entre chaque test.
- Certains tests dependent d'un monde genere aleatoirement : ils re essaient
  plusieurs placements avant d'echouer (un echec isole peut etre re-run).
