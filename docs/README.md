# Specs par système

Chaque fichier ci-dessous documente un système : son contrat, ses entrées/sorties, ses contraintes et où l'étendre. À consulter AVANT de modifier un système précis. Les conventions transverses (nommage code, sprites, sons, docs) sont dans [CONVENTIONS.md](CONVENTIONS.md).

| Système | Spec | Code |
|---------|------|------|
| **Conventions globales (nommage, principes, checklist)** | [CONVENTIONS.md](CONVENTIONS.md) | tout le repo |
| Config & constantes | [config.md](config.md) | `src/config.js` |
| État global & DOM | [state.md](state.md) | `src/state.js` |
| Projection isométrique | [projection.md](projection.md) | `src/projection.js` |
| Monde (génération) | [world.md](world.md) | `src/world.js` |
| Joueur | [player.md](player.md) | `src/player.js` |
| Murs & construction | [walls.md](walls.md) | `src/walls.js` |
| Récolte de planches (hache) | [chop.md](chop.md) | `src/chop.js` |
| Armes & projectiles | [weapons.md](weapons.md) | `src/weapons.js` |
| Zombies | [zombies.md](zombies.md) | `src/zombies.js` |
| Zombies — déplacement & attaque (détail) | [zombies-deplacement-attaque.md](zombies-deplacement-attaque.md) | `src/zombies.js` |
| Sac & inventaire | [bag.md](bag.md) | `src/bag.js` |
| HUD & overlays | [hud.md](hud.md) | `src/hud.js` |
| Rendu | [render.md](render.md) | `src/render.js` |
| Entrées | [input.md](input.md) | `src/input.js` |
| Boucle principale | [main.md](main.md) | `src/main.js` |
| Textures (sprites & couleurs) | [textures.md](textures.md) | `src/textures/` |
| Oiseaux | [birds.md](birds.md) | `src/birds.js` |
| Réseau client (WebSocket) | [net.md](net.md) | `src/net.js` |
| Flow field (navigation zombies) | [flowfield.md](flowfield.md) | `src/flowfield.js` |
| Assets PNG & animations | [assets.md](assets.md) | `src/assets.js`, `assets/manifest.json` |
| Sons & musique | [sound.md](sound.md) | `src/sound.js` |
| Statistiques | [stats.md](stats.md) | `src/stats.js` |
| Siège | [siege.md](siege.md) | `src/siege.js` |
