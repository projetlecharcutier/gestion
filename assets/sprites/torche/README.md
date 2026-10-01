# Poteau de torche (`torche/`)

Poteau de torche pose pres de chaque ville (Ville de l'Est, Laputa, Minas)
et de chaque regroupement de maisons hors ville. Au clic (a portee), le
joueur recupere une torche : le brouillard est degage sur un rayon 5x plus
grand pendant 1 minute (jauge "Torche" en bas de l'ecran).

## Fichiers

| Fichier | Contenu |
|---------|---------|
| `idle.png` | poteau allume, image de base |

## Animation

Comme pour tous les objets : ajoute des frames `idle-0.png`, `idle-1.png`,
... a cote de `idle.png`. Si `idle-0.png` existe, le poteau est anime
(cycle a 8 fps, convention habituelle), sinon il est statique. La flamme
peut ainsi vaciller.

Les frames peuvent aussi se nommer `idle-0101.png`, `idle-0102.png`, ...
(bloc padding a 2 chiffres, cf. potence/exec).

Rien a declarer : le jeu detecte les frames tout seul (probeAnimFrames).
Le PNG peut faire n'importe quelle taille (l'emprise au sol = largeur du
PNG x 2, ancre bas-centre sur le bord sud, comme les maisons).
