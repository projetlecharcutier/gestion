# Nogent (ville décorative PNG)

Dossier de la ville « nogent ». Le serveur la détecte automatiquement au
démarrage (`server/ville-sync.js`) : placement auto sur le cercle autour de
la ville principale, génération des grilles, publication dans le manifeste
`assets/sprites/ville/villes.js`.

## Fichiers attendus

| Fichier | Role |
|---|---|
| `ville.png` | ville visible de référence (taille du losange, repli statique si pas de frames) |
| `ville_mask.png` | masque de collision, MEME taille au pixel près — jamais animé |
| `ville-0.png` … `ville-15.png` | les 16 frames d'animation, toutes de la MÊME TAILLE que `ville.png` |

## Règles pour l'animation sur 16 frames

1. La série peut commencer à `ville-0.png` OU `ville-1.png` (les exports
   d'outils numérotent souvent depuis 1) ; le chargement s'arrête au
   premier numéro manquant. Pour 16 frames complètes :
   `ville-0.png` … `ville-15.png` (16 fichiers).
2. Chaque frame a EXACTEMENT les dimensions de `ville.png` (sinon le rendu
   en bandes les déforme).
3. Seul le visuel s'anime : les zones solides ne bougent pas, le masque
   de collision reste `ville_mask.png` unique.
4. Cadence : `ANIM_FPS` (`src/assets.js`, 10 fps par défaut) — 16 frames
   = un cycle de 1,6 s.
5. Après dépôt des PNG : `node server/gen-sprite-meta.js` puis committer
   les fichiers générés (`server/sprite-meta.json`, `server/ville-grids.json`,
   `server/ville-positions.json`, `server/ville-grids-sigs.json`,
   `assets/sprites/ville/villes.js`) avec les PNG.

Masque : rouge `rgb(255,0,0)` = collision, vert `rgb(0,255,0)` = le joueur
passe derrière, transparent = libre. PNG 8-bit RGBA non entrelacé.
