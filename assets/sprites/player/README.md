# Sprites du personnage joueur

Ce dossier contient les PNG du personnage. Le jeu choisit l'image selon la
**direction** (face / gauche / droite) et l'**équipement** (perso / hache / pistolet).

## Convention de noms

Chaque image = `perso` + suffixe d'équipement + suffixe de direction.

| État / équipement  | Suffixe     | Exemple de fichier      |
|--------------------|-------------|-------------------------|
| Normal (mains nues)| `perso`     | `perso_face.png`        |
| Hache équipée      | `persoHache`| `persoHache_face.png`   |
| Pistolet équipé    | `persoPistolet` | `persoPistolet_face.png` |

## Directions (3 images par état)

| Direction                          | Suffixe   | Utilisée quand                                  |
|------------------------------------|-----------|-------------------------------------------------|
| Statique / vers l'avant / vers le haut | `face`    | immobile, ou déplacement vers le bas ou le haut |
| Vers la gauche                      | `gauche`  | déplacement vers la gauche (W, NW, SW)          |
| Vers la droite                       | `droite`  | déplacement vers la droite (E, NE, SE)         |

## Liste complète des fichiers attendus (9 PNG)

```
perso_face.png
perso_gauche.png
perso_droite.png
persoHache_face.png
persoHache_gauche.png
persoHache_droite.png
persoPistolet_face.png
persoPistolet_gauche.png
persoPistolet_droite.png
```

Dépose tes PNG dans ce dossier avec ces noms exacts. Le jeu les détecte
automatiquement (taille lue sur l'image chargée). Si une image manque, le jeu
affiche le sprite 8-directions existant ou le fallback pixel art.

## Format

- PNG transparent (alpha).
- Taille libre (lue sur le PNG, ex: 32×48). Toutes les images d'un même état
  devraient avoir la même taille pour un rendu cohérent.
