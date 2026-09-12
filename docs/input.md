# Entrées — `src/input.js`

## Contrat
Toutes les entrées (souris, molette, clavier) + le formulaire de démarrage. Configure aussi le `resize` du canvas. Dépend de `config.js`, `state.js`, `projection.js` (`unproj`), `world.js` (`buildWorld`), `player.js`, `walls.js` (`tryBuildWall`), `chop.js` (logique de récolte via `updateChop`, pas appel direct ici), `bag.js`, `hud.js` (`updateHud`). Doit être chargé avant `main.js`.

## Comportements
- `resize` — adapte le canvas au viewport (DPR), `imageSmoothingEnabled=false`
- `mousemove` — stocke souris écran + monde (`unproj`)
- `mouseleave` — `mouse.inside = false`
- `click` — selon l'état :
  1. Sac ouvert → `handleBagClick`
  2. Mode pose de planche (`buildMode`) → `tryBuildWall`
  3. Porte de bâtiment proche → entre (ou `tryHealAtHospital` si "Hôpital")
  4. Objet/outil/arme proche → ramasse dans le sac
  - **Note** : l'ancien abattage d'arbre par clic a été supprimé (remplacé par la récolte à la hache dans `src/chop.js`).
- `wheel` — zoom `targetZoom` (clamp 1..40)
- `keydown` —
  - **Espace** : en mode pose de planche → `rotatePlank()` (rotation 90°, pas de tir) ; sinon → `state.keys.space = true` (tir).
  - **Échap** : ferme le sac → ferme le mode pose → met en pause.
  - **A** (et `q`/`Q` fallback AZERTY) : ouvre/ferme le sac.
  - **Z** (et `w`/`W` fallback AZERTY) : active/désactive le mode pose de planche (`buildMode`).
- `keyup` — relâche Espace (`state.keys.space = false`)
- `startForm submit` — démarre la partie : reset état + `buildWorld`. Réinitialise aussi `buildMode`, `plankRotation`, `axeEquipped`, `chopTarget`, `chopTimer`.
- `resumeBtn` / `leaveBuildingBtn` — boutons

## Contraintes
- Le clic est bloqué si `!started || paused || inBuilding || gameOver`.
- Le mode pose est bloqué si sac ouvert.
- Le tir est désactivé en mode pose de planche (voir `src/weapons.js` `handleShooting`).
- Ramassage : objet à `< 70` du clic ET joueur à `< 120`.
- "Hôpital" est un nom testé en dur — voir `world.md`.

## Étendre
- **Nouvelle touche** : ajouter une branche dans `keydown` (préférer `e.code`).
- **Nouvelle action au clic** : insérer une étape dans le `click` avant le ramassage.
- **Raccourci clavier pour objet** : gérer dans `keydown` avec l'état du sac.
