# Statistiques — `src/stats.js`

## Contrat

Compteurs de partie, par joueur et globaux, alimentés par les autres systèmes au fil des événements. Pur data : aucune logique de jeu ici, juste des accumulateurs. Affichés par le HUD (`src/hud.js`) et les écrans de fin de partie.

## Exposé sur `G`

- `newPlayerStats()` / `newGlobalStats()` — objets de compteurs neufs (appelés à l'init et au redémarrage de partie)
- `statsAddGold(n)` / `statsAddPlanks(n)` — ressources accumulées
- `statsAddBuilt()` — constructions posées
- `statsAddKill()` / `statsAddShot()` — zombies tués, tirs émis
- `statsRecordWave(night, count, ramp, rawCount)` — trace de vague nocturne (numéro de nuit, volume, croissance, volume brut)
- `statsAddTowerKill()` — kills par tour d'attaque

## Étendre

- **Nouveau compteur** : l'ajouter à `newPlayerStats()`/`newGlobalStats()` ici + un helper `statsAdd<Quoi>()` sur le même modèle, appelé par le système concerné. Puis l'afficher dans `src/hud.js`.
