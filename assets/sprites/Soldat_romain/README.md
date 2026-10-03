# Soldat romain (`Soldat_romain/`)

PNG **optionnel** de remplacement de l'apparence procedurale des legionnaires
du camp romain (src/soldats.js). Tant qu'aucun PNG n'est pose ici, les soldats
sont dessines en pixel art procedurale (casque a crete rouge, armure, bouclier
doré, glaive).

Pour utiliser votre propre sprite :

1. Deposez un PNG ici : `assets/sprites/Soldat_romain/soldat.png`
2. Rechargez la page (le PNG est charge automatiquement au demarrage).

Aucune modification de code n'est necessaire ; changez simplement le fichier
`soldat.png` quand vous le souhaitez et rechargez.

Conseils de rendu :

- N'importe quelle taille (le sprite est mis a l'echelle automatiquement,
  hauteur ~7-8 cellules monde a l'ecran).
- Pieds du soldat en bas de l'image (ancrage bas-centre).
- Vue de profil ou 3/4 : le sprite est automatiquement mis en miroir quand le
  soldat court vers la gauche.
- Fond transparent pour l'occlusion correcte avec le sol et les batiments.
