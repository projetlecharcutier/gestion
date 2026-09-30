# Serveur multijoueur — `server/`

## Grands principes

1. **Serveur autorité** : un serveur Node (dépendance `ws` uniquement) héberge une **partie unique** (max 20 joueurs) et simule tout (déplacement, collisions, zombies, projectiles, mairie, récolte, vagues, game over). Les clients ne font que le rendu et envoient leurs inputs.
2. **Parité exacte client/serveur** : `server/game.js` charge les **mêmes** `src/*.js` que le navigateur via `eval` + un stub DOM (`server/dom-stub.js`). Toute logique de simulation reste donc compatible Node sans navigateur.
3. **Tolérance** : le serveur démarre même si des assets manquent (`hasSprite → false`, canvas factice) et survit aux erreurs non fatales (dépôts en lecture seule, `safe.directory` git).

## Lancer

```bash
cd server
npm install        # ws
npm start          # écoute sur PORT (8080 par défaut), HTTP statique + WebSocket sur le même port
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `server/index.js` | Serveur WebSocket, boucle 20 Hz, broadcast lobby (2 Hz) + état (10 Hz), connexions/déconnexions, redémarrage auto |
| `server/game.js` | État du monde + simulation, charge les modules `src/*.js` partagés, joueurs, vagues, game over |
| `server/dom-stub.js` | Stub DOM + assets pour exécuter `buildWorld()` sans navigateur (dimensions calées sur les PNG réels) |
| `server/ville-sync.js` | Détection auto des villes déposées (`assets/sprites/ville/<nom>/`), placement, régénération des grilles, manifeste client `villes.js` |
| `server/gen-sprite-meta.js` | Génère `ville-grids.json` avec la **même fonction pure** que le client (`villeGridFromPixels`) → parité exacte |
| `server/ville-grids.json` / `ville-grids-sigs.json` / `ville-positions.json` | Grilles de collision, signatures (ne pas committer un changement de date seul), positions auto persistées |
| `server/sprite-meta.json` | Métadonnées de sprites générées |

## Cycle de vie de la partie

1. Aucun joueur → partie arrêtée. 2. Premier joueur → compte à rebours de 30 s. 3. Partie lancée → vagues nocturnes, mairie attaquable. 4. Mairie détruite → game over, redémarrage auto après 10 s si des joueurs sont présents. 5. Max 20 places, libérées à la déconnexion.

## Convention de nommage

Fichiers minuscules, kebab-case (`ville-sync.js`, `gen-sprite-meta.js`). Fichiers générés/persistés en kebab-case avec tiret : `ville-grids.json` (généré — ne pas éditer à la main), `ville-positions.json` (positions auto persistées).

## Étendre

- **Nouvel input joueur** : payload dans `src/net.js` (`netInput`) → traitement dans `server/index.js` → simulation (`server/game.js`).
- **Nouveau message broadcast** : émission dans `server/index.js`, réception dans `netHandle` (`src/net.js`).
- **Nouvelle ville PNG** : déposer un dossier `assets/sprites/ville/<nom>/ville.png` + `ville_mask.png` — tout le reste (détection, placement, grilles, manifeste) est automatique au redémarrage du serveur. Voir `docs/ville.md`.
- **Changer le port** : `PORT=3030 npm start`.

## Déploiement

`deploy/` contient un watcher (`deploy.sh` + service systemd `flex.service`) qui tire `main` et redémarre le serveur à chaque commit. Voir `deploy/README.md`.
