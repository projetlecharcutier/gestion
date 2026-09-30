# Réseau client — `src/net.js`

## Contrat

Couche WebSocket côté client : connexion au serveur, lobby du menu d'accueil, envoi des inputs, réception de l'état. Le rendu n'est jamais modifié par ce fichier. L'URL est auto-détectée : même hôte et même port que la page HTTP (le serveur sert le client ET le WebSocket sur un seul port) ; en `file://`, repli sur `ws://localhost:8080`. Reconnexion automatique toutes les 2 s.

## Exposé sur `G`

- `netConnect()` — ouvre la connexion (garde : pas de double connexion)
- `netJoin(name)` — rejoint la partie (différé si la connexion n'est pas encore ouverte)
- `netInput(input)` — envoie un input `{ dx, dy, fire, build, buildWall, aimX, aimY, pickup, equip, toggleAxe, rotate, techVote, buildSel, placeBuild }`
- `netHandle(msg)` — traite `lobby` / `joined` / `state` / `restart` / `full`
- `applyRemoteState(s)` — applique le snapshot serveur au state local (interpolation position joueur, sac, équipement, planches)
- `updateLobbyDisplay()` — affiche le lobby (heure du monde, joueurs, statut)

## Contraintes

- Le serveur est **autorité** à 10 Hz : le client fait de l'optimiste local (position, équipement) mais **réconcilie** sur chaque snapshot. Horodatage dédié pour l'équipement (`equipSentAt`/`pendingEquip`) afin que le snapshot serveur n'écrase pas la valeur optimiste avant traitement.
- Les compteurs "floater" (planches récoltées) ne se comparent **pas** à `state.planks` (écrasé à chaque snapshot) mais à une mémoire dédiée (`lastPlanksSeen`).
- Mode solo/local : ce module n'est pas chargé/actif, tout le reste du code doit fonctionner sans réseau.

## Étendre

- **Nouvel input joueur** : l'ajouter au payload de `netInput`, le traiter dans `server/index.js` puis dans la simulation (`server/game.js`).
- **Nouveau message serveur** : l'émettre côté serveur, l'ajouter au `switch` de `netHandle`.
