# Entrées — `src/input.js`

## Contrat
Toutes les entrées (souris, molette, clavier) + le formulaire de démarrage. Configure aussi le `resize` du canvas. Dépend de `config.js`, `state.js`, `projection.js` (`unproj`), `world.js` (`buildWorld`), `player.js`, `walls.js`, `bag.js`, `hud.js` (`updateHud`). Doit être chargé avant `main.js`.

## Comportements
- `resize` — adapte le canvas au viewport (DPR), `imageSmoothingEnabled=false`
- `mousemove` — stocke souris écran + monde (`unproj`)
- `mouseleave` — `mouse.inside = false`
- `click` — selon l'état :
  1. Sac ouvert → `handleBagClick`
  2. Mode construction → `tryBuildWall`
  3. Porte de bâtiment proche → entre (ou `tryHealAtHospital` si "Hôpital")
  4. Arbre proche → abat (donne 2–4 planches)
  5. Obet/arme proche → ramasse dans le sac
- `wheel` — zoom `targetZoom` (clamp 1..40)
- `keydown` — Espace (tir), Échap (pause/ferme sac), A (sac), B (mode construction)
- `keyup` — relâche Espace
- `startForm submit` — démarre la partie (reset état + `buildWorld`)
- `resumeBtn` / `leaveBuildingBtn` — boutons

## Contraintes
- Le clic est bloqué si `!started || paused || inBuilding || gameOver`.
- Abattage : arbre à `< r*0.6` du clic ET joueur à `< WALL_BUILD_RANGE`.
- Ramassage : objet à `< 70` du clic ET joueur à `< 120`.
- "Hôpital" est un nom testé en dur — voir `world.md`.

## Étendre
- **Nouvelle touche** : ajouter une branche dans `keydown` (préférer `e.code`).
- **Nouvelle action au clic** : insérer une étape dans le `click` avant le ramassage.
- **Raccourci clavier pour objet** : gérer dans `keydown` avec l'état du sac.
