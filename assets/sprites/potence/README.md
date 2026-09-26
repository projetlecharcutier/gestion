# Potence (`assets/sprites/potence/`)

Batiment unique debloquable a la mairie (registre `TOWN_BUILDINGS`, `src/config.js`).
Trois series animees :

| Serie | Declencheur | Contenu |
|-------|-------------|---------|
| `idle.png` | Potence construite, animation standard qui tourne en boucle | potence idle (corde qui balance legerement) |
| `chantier.png` | Construction (10 s) | echafaudage, un seul tour |
| `exec.png` | Vote de pendaison aboutit a l'execution d'un joueur | animation d'execution, un seul tour puis figee sur la derniere frame |

## Conventions de nommage (les DEUX fonctionnent)

Le jeu charge les frames d'une serie dans `assets/sprites/potence/` avec les
deux conventions, au choix (ou melangees) :

1. **Standard du jeu** : `idle.png` (frame 0) puis `idle-0.png`, `idle-1.png`,
   `idle-2.png`, ... La sonde s'arrete au premier numero manquant.
2. **Format Aseprite "Sprite-0101"** : `idle-0101.png`, `idle-0102.png`,
   `idle-0103.png`, ... (bloc de 4 chiffres, les deux derniers incrementent
   pour chaque frame). La sonde s'arrete au premier numero manquant.

Exemple de depot pour l'animation d'execution :

```
assets/sprites/potence/
  idle.png            # frame 0 de l'animation standard (ou idle-0101.png...)
  idle-0.png ...      # OU idle-0101.png, idle-0102.png, ...
  chantier.png
  chantier-0.png ...
  exec.png            # frame 0 de l'animation d'execution
  exec-0101.png       # frames suivantes : exec-0102.png, exec-0103.png...
```

Si le PNG de base (`idle.png`, `exec.png`...) est absent mais que des frames
existent, la serie est quand meme chargee (la premiere frame devient la base).

## Dossier distinct (optionnel)

L'animation d'execution peut AUSSI etre deposee dans un sous-dossier dedie :

```
assets/sprites/potence/exec/
  exec-0101.png
  exec-0102.png
  ...
```

Le jeu sonde ce dossier UNIQUEMENT si aucun PNG `exec` n'a ete trouve a la
racine de `assets/sprites/potence/`. Les deux conventions de nommage
(standard `-0..N` et Aseprite `-0101...`) y sont egalement acceptees.

L'emprise au sol est definie par `side` dans le registre (`src/config.js`),
pas par la taille du PNG.
