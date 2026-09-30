# Conventions du projet — à lire avant d'ajouter quoi que ce soit

Ce document rassemble les **grands principes** et les **conventions de nommage** qui traversent tout le repo. Chaque dossier a ensuite sa propre doc (`docs/`, `assets/sprites/README.md`, `test/README.md`, `deploy/README.md`) qui détaille les règles locales.

## Grands principes

1. **Zéro dépendance, zéro build.** JS vanilla chargé par balises `<script>` dans l'ordre de `index.html`. Pas de bundler, pas d'ES modules, pas de TypeScript.
2. **Objet global unique `window.GAME`** (alias local `G` dans chaque fichier). Tout partage de fonction passe par `G`, jamais par des imports.
3. **Un fichier = un système**, enveloppé dans `(function () { "use strict"; ... })()`. Chaque fichier expose ses fonctions sur `G` et ne touche qu'à son domaine.
4. **Config centralisée** : toute constante d'équilibrage vit dans `src/config.js` (`G.<CONSTANTE>`), jamais codée en dur ailleurs.
5. **État mutable unique** : `G.state` (`src/state.js`). Tous les systèmes lisent/écrivent dedans.
6. **Client-serveur à parité exacte** : le serveur (`server/game.js`) exécute les **mêmes** `src/*.js` via `eval` + stub DOM (`server/dom-stub.js`). Toute logique de simulation doit donc rester compatible Node sans navigateur (pas d'accès direct au DOM, tolérer l'absence d'assets).
7. **Tolérance de repli** : un asset manquant ne casse jamais le jeu (repli sur les textures vectorielles `G.TEXTURES` ; sons absents = silence).
8. **Textures ≠ rendu** : les sprites pixel art et palettes vivent dans `src/textures/`, le rendu les consomme sans les définir.

## Convention de nommage — code

| Élément | Convention | Exemple |
|---|---|---|
| Fichier source | minuscules, un mot par système | `src/flowfield.js` |
| Constante | `MAJUSCULE_AVEC_UNDERScores`, préfixée par son système sur `G` | `G.ZOMBIE_SPEED`, `G.BIRD_COUNT` |
| Fonction exposée | `camelCase`, verbe d'action | `G.tryBuildWall`, `G.updateBirds` |
| Fonction de mise à jour par frame | `update<Système>(dt)` | `updateChop(dt)` |
| Fonction de nettoyage | `cleanup<Système>()` | `cleanupZombies()` |
| Fonction de test de collision | `<quoi>Hits<Quoi>` / `aabbHits*` | `aabbHitsVilles` |
| Nouveau système complet | créer `src/<nom>.js`, l'ajouter dans `index.html` **avant `main.js`**, exposer sur `G`, le documenter dans `docs/<nom>.md` + `docs/README.md` + `CONTEXT.md` |

## Convention de nommage — sprites PNG (`assets/sprites/`)

Voir `assets/sprites/README.md` pour le détail. Résumé des trois conventions, qui ne se chevauchent jamais :

| Convention | Sens | Exemple |
|---|---|---|
| `<base>.png` | objet statique | `SE.png` |
| `<base>1.png`, `<base>2.png`… | **variantes** (objets différents, choix aléatoire) | `H1.png`, `H2.png` |
| `<base>-0.png`, `<base>-1.png`… | **animation** (frames d'un même objet, cycle 8-10 fps) | `SE-0.png`, `SE-1.png` |
| `<base>s<N>.png` | états de coupe des forêts (suffixe `s`) | `foret1s0.png`…`foret1s4.png` |
| `<base>-0101.png`… | export Aseprite padding 4 chiffres (accepté en plus du standard) | `exec-0101.png` |

Rien à déclarer : `src/assets.js` détecte tout automatiquement (arrêt à la 1re frame absente).

## Convention de nommage — sons (`assets/sounds/`)

Déposer `assets/sounds/<nom>.mp3` puis appeler `G.playSfx("<nom>")` dans le code. camelCase pour le nom du fichier (`siegeCasse.mp3`, pas `siege_casse.mp3`).

## Convention — documentation

| Dossier | Doc d'entrée | Contenu |
|---|---|---|
| Racine | `README.md` (présentation, comment jouer), `CONTEXT.md` (carte du projet pour l'agent/développeur) | vue d'ensemble, architecture, leçons de bugs |
| `docs/` | `docs/README.md` (index) | une spec courte par système : **Contrat / Exposé sur `G` / Contraintes / Étendre** |
| `src/textures/` | `docs/textures.md` | schéma de chaque texture |
| `assets/sprites/` | `assets/sprites/README.md` | structure, animations, variantes, états |
| `assets/sounds/` | `assets/sounds/README.md` | fichiers attendus, ajout d'un effet |
| `server/` | `server/README.md` | lancement, architecture serveur |
| `test/` | `test/README.md` | catégories, env vars `TEST_SEED` / `TEST_START_PLANKS` |
| `deploy/` | `deploy/README.md` | installation VM OVH, systemd |

**Règle** : quand on ajoute un système, on crée `docs/<nom>.md` avec les 4 sections standard (Contrat, Exposé sur `G`, Contraintes, Étendre) et on l'ajoute à l'index `docs/README.md`.

## Convention — tests (`test/`)

Tests Node sans framework : `node test/<categorie>/<fichier>.js` (0 = OK, 1 = échec), stubs DOM embarqués. Un fichier de test par comportement, nommé en `snake_case` décrivant le cas (`jitter_reseau.js`, `cinq_planches.js`). Voir `test/README.md`.

## Checklist « ajouter quelque chose »

1. **Nouvelle arme** → entrée dans `G.WEAPON_STATS` (`src/config.js`). Rien d'autre.
2. **Nouveau niveau de tour** → entrée dans `G.TOWER_STATS` + PNG `assets/sprites/tour/`. Le reste est automatique.
3. **Nouveau bâtiment de ville** → entrée dans le registre `TOWN_BUILDINGS` (`src/config.js`) + dossier PNG `{idle,chantier}-N.png`.
4. **Nouvel objet ramassable / arbre** → `state.items[]` / `state.trees[]` dans `buildWorld` (`src/world.js`).
5. **Nouvel outil (modèle hache)** → objet `kind:"outil"` dans `buildWorld`, équipement dans `handleBagClick` (`src/bag.js`), logique dans un nouveau `src/<nom>.js` (modèle `src/chop.js`).
6. **Nouveau système complet** → `src/<nom>.js` + `index.html` avant `main.js` + `docs/<nom>.md` + index + `CONTEXT.md`.
7. **Nouveau son** → `assets/sounds/<nom>.mp3` + `G.playSfx("<nom>")`.
8. Toujours : constantes dans `config.js`, test dans `test/`, doc à jour.
