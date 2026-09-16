# Sprites de zombies

Place ici les PNG des zombies vivants (dans `alive/`) et les traces laissées
par les zombies morts (dans `dead/`).

## `dead/` — traces au sol

Quand un zombie meurt, il laisse une trace sur le sol (sang, débris...).
Le jeu charge **tous** les PNG de ce dossier et en **choisit un au hasard** à
chaque mort de zombie.

**Convention de nommage :** `deadzomb1.png`, `deadzomb2.png`, `deadzomb3.png`, ...
(le jeu sonde `deadzomb1`, puis `deadzomb2`, etc. et s'arrête après 3 numéros
manquants consécutifs). Commence à **1**.

- Il suffit d'ajouter `deadzomb1.png`, `deadzomb2.png`, ... ici pour qu'ils entrent
  dans le tirage aléatoire — rien à déclarer dans le manifeste.
- La trace est dessinée **juste au-dessus du fond** (derrière les objets, les
  bâtiments, les murs, les zombies et le joueur) : elle ne recouvre jamais
  un élément du décor, seul le fond vert reste en dessous.
- Format : pixel art, fond transparent (PNG avec canal alpha).
- Tolérant : si aucun PNG n'est présent, aucune trace n'est laissée (le jeu
  continue normalement).

## `alive/` — sprites des zombies vivants

Dossier réservé aux futurs sprites de zombies animés (non utilisé pour
l'instant par la mécanique de traces).
