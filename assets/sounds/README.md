# Sons d'effets (SFX)

Dépose tes fichiers sonores dans ce dossier. Le jeu les charge automatiquement
quand un effet est déclenché (tolérant : aucun fichier = pas de son).

## Format

- Format : `.mp3` (recommandé), `.wav` ou `.ogg`.
- Durée conseillée : court (< 1 s), en boucle non requise.

## Fichiers attendus

| Fichier          | Déclencheur                  |
|------------------|------------------------------|
| `shoot.mp3`      | Tir du joueur (Espace)       |
| `zombie_die.mp3` | Un zombie est tué            |
| `church.mp3`     | Clic sur l'église (dépot de relique) |

Pour ajouter un nouvel effet : dépose le fichier `assets/sounds/<nom>.mp3`
puis appelle `G.playSfx("<nom>")` dans le code au moment voulu.

## Bouton « Effets »

Le bouton en haut à droite (à côté de « Son ») active/désactive tous les
effets sonores. La musique (SoundCloud) est contrôlée séparément par « Son ».
