# Tour de siège — sprites PNG

Place ici les PNG de la **tour de siège** (ennemis qui avancent vers la
palissade la nuit, dès le 2ᵉ jour d'attaque).

## Dossiers

| Dossier | Contenu |
|---|---|
| `sud-est-vers-nord-ouest/` | tour qui se déplace du Sud-Est vers le Nord-Ouest |
| `sud-ouest-vers-nord-est/` | tour qui se déplace du Sud-Ouest vers le Nord-Est |
| `nord-est-vers-sud-ouest/` | tour qui se déplace du Nord-Est vers le Sud-Ouest |
| `nord-ouest-vers-sud-est/` | tour qui se déplace du Nord-Ouest vers le Sud-Est |
| `destruction/` | PNG de la trace laissée au sol quand la tour est détruite |

## Chaque dossier de déplacement : 2 états

- `ferme.png` — état **fermé** (par défaut, pendant le déplacement).
- `ouvert.png` — état **ouvert**, uniquement quand la tour est en contact
  avec un mur (elle s'y colle, s'arrête et libère 100 zombies de l'autre
  côté de la palissade).

Toutes les frames d'une même série ont exactement les mêmes dimensions.
Animation éventuelle avec la convention habituelle : `ferme-0.png`,
`ferme-1.png`, ... / `ouvert-0.png`, `ouvert-1.png`, ...

## Règles de rendu (cf. specs du système)

- Collisions joueurs/zombies : uniquement les **10 % les plus bas** du PNG.
- La trace de `destruction/` ne collisionne plus rien et n'est plus un
  obstacle : un seul PNG, par exemple `destruction.png`.
