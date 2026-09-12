# État global & DOM — `src/state.js`

## Contrat
Récupère les éléments du DOM et initialise l'objet `G.state` (mutable, partagé entre tous les systèmes). Doit être chargé après `config.js` (utilise `G.PLAYER_MAX_HP`, `G.WAVE_EVERY`).

## Exposé sur `G`
- DOM : `canvas`, `ctx`, `hud`, `hudName`, `hudZone`, `hudPos`, `hudInv`, `hudWeapon`, `hudAxe`, `hudHp`, `hudPlanks`, `startScreen`, `startForm`, `nameInput`, `pauseScreen`, `resumeBtn`, `buildingScreen`, `buildingName`, `buildingMsg`, `leaveBuildingBtn`
- `state` : voir le schéma complet dans le fichier / dans `CONTEXT.md`.

## Contraintes
- `state` est le **seul** état mutable partagé. Tous les systèmes le lisent/écrivent via `G.state`.
- Le joueur démarre au centre (50000, 50000), zoom 8, clock 8h, jour 0.
- Champs ajoutés pour la pose de planches et la hache : `buildMode` (bool), `plankRotation` (0=horizontal/1=vertical), `axeEquipped` (bool), `chopTarget` (arbre ou null), `chopTimer` (accumulateur s). Réinitialisés dans le `submit` du formulaire (`src/input.js`).

## Étendre
- **Nouveau champ d'état** : l'ajouter à `state` ici, le réinitialiser dans le `submit` du formulaire (`src/input.js`) si besoin.
- **Nouvel élément DOM** : l'ajouter à `index.html` et récupérer la référence ici.
