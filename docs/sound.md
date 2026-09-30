# Sons — `src/sound.js`

## Contrat

Effets sonores (SFX) courts déclenchés par le code + musique de fond (SoundCloud, contrôlée à part). Tolérant : fichier absent = silence, aucune erreur.

## Exposé sur `G`

- `playSfx(name)` — joue `assets/sounds/<name>.mp3` (waivers silencieux si absent)
- `toggleSfx()` — bouton « Effets » on/off
- `toggleSound()` — bouton « Son » (musique) on/off
- `updateMusic()` — maintien du lecteur SoundCloud (boucle, volume)

## Convention de nommage

`assets/sounds/<nom>.mp3`, nom en camelCase (`siegeCasse.mp3`, `tourCasse.mp3`). Voir `assets/sounds/README.md` pour la liste des fichiers attendus.

## Étendre

- **Nouvel effet** : déposer le fichier `assets/sounds/<nom>.mp3`, puis appeler `G.playSfx("<nom>")` au point de déclenchement. Rien d'autre à déclarer (chargement paresseux).
