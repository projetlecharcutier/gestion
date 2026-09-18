// Armes & projectiles : stats de l'arme équipée et tir du joueur.
(function () {
    "use strict";
    var G = window.GAME = window.GAME || {};

    G.equippedStats = function () {
        var name = G.state.equipped || "Mains nues";
        return G.WEAPON_STATS[name] || G.WEAPON_STATS["Mains nues"];
    };

    // Gère le tir quand le clic gauche est maintenu (actionHeld). Appelé depuis
    // update(). shootCd est décrémenté une fois par update() dans main.js.
    G.handleShooting = function () {
        var state = G.state;
        if (state.inBuilding || state.paused || state.bag.open || state.chestOpen || state.gameOver || state.buildMode) return;
        if (!state.equipped) return; // pas de tir sans arme équipée
        if (!state.actionHeld || state.shootCd > 0) return;
        var p = state.player;
        var tx = state.mouse.wx, ty = state.mouse.wy;
        var st = G.equippedStats();
        state.shootCd = st.cd;
        if (G.playSfx) G.playSfx("shoot");

        var ax = tx - p.x, ay = ty - p.y;
        var baseAng = Math.atan2(ay, ax);
        var weaponType = st.type || "pistolet"; // ex: "arc", "fusil", "pistolet"

        // Gestion du Fusil (Shotgun) : plusieurs projectiles en cône
        if (weaponType === "fusil") {
            var pelletCount = st.pellets || 5; // Nombre de projectiles par défaut
            var coneSpread = st.coneSpread || 0.3; // Largeur du cône en radians

            for (var i = 0; i < pelletCount; i++) {
                var offset = (pelletCount > 1) ? (i / (pelletCount - 1) - 0.5) * coneSpread : 0;
                var ang = baseAng + offset + (Math.random() * 2 - 1) * st.spread;

                state.projectiles.push({
                    x: p.x, y: p.y - G.PLAYER_H * 0.5,
                    vx: Math.cos(ang) * st.speed,
                    vy: Math.sin(ang) * st.speed,
                    life: st.life,
                    dmg: st.dmg,
                    color: st.color,
                    size: st.size || 3,       // <-- Taille personnalisée (ex: 2 pour le fusil, 5 pour le pistolet)
                    type: st.type || "pistolet", // <-- Permet de savoir si c'est un arc, fusil, etc.
                    trail: [],
                    piercing: false,
                    hitEntities: [] // Évite de toucher plusieurs fois la même entité par projectile unique
                });
            }
        }
        // Gestion de l'Arc, Pistolet et autres armes standards (1 projectile)
        else {
            var sp = (Math.random() * 2 - 1) * st.spread;
            var ang = baseAng + sp;

            state.projectiles.push({
                x: p.x, y: p.y - G.PLAYER_H * 0.5,
                vx: Math.cos(ang) * st.speed,
                vy: Math.sin(ang) * st.speed,
                life: st.life,
                dmg: st.dmg,
                color: st.color,
                size: st.size || 3,       // <-- Taille personnalisée (ex: 2 pour le fusil, 5 pour le pistolet)
                type: st.type || "pistolet", // <-- Permet de savoir si c'est un arc, fusil, etc.
                trail: [],
                piercing: !!st.piercing, // true pour l'arc (transperçant)
                pierceCount: st.pierceCount || (st.piercing ? 3 : 0), // Nombre max de cibles transpercées
                hitEntities: [] // Pour s'assurer qu'un projectile transperçant ne touche pas 10 fois la même cible sur la même frame
            });
        }

        if (state.projectiles.length > 120) state.projectiles.shift();
    };

    // Déplacement des projectiles + collisions avec zombies et oiseaux. Appelé depuis update().
    G.updateProjectiles = function (dt) {
        var state = G.state;
        for (var i = state.projectiles.length - 1; i >= 0; i--) {
            var pr = state.projectiles[i];
            pr.trail.push([pr.x, pr.y]);
            if (pr.trail.length > 8) pr.trail.shift();
            pr.x += pr.vx * dt;
            pr.y += pr.vy * dt;
            pr.life -= dt;

            var shouldDestroy = false;

            // 1. Collisions avec les Zombies
            for (var zi = 0; zi < state.zombies.length; zi++) {
                var z = state.zombies[zi];

                // Vérifier si ce projectile a déjà touché ce zombie précis
                if (pr.hitEntities.indexOf(z) !== -1) continue;

                var zdx = pr.x - z.x, zdy = pr.y - z.y;
                if (Math.sqrt(zdx * zdx + zdy * zdy) < 14) {
                    z.hp -= pr.dmg;
                    pr.hitEntities.push(z);

                    if (pr.piercing && pr.pierceCount > 0) {
                        pr.pierceCount--;
                        if (pr.pierceCount <= 0) {
                            shouldDestroy = true;
                        }
                    } else {
                        shouldDestroy = true;
                    }
                    break;
                }
            }

            // 2. Collisions avec les Oiseaux (si le projectile n'est pas déjà détruit)
            if (!shouldDestroy) {
                for (var bi = 0; bi < state.birds.length; bi++) {
                    var b = state.birds[bi];

                    if (pr.hitEntities.indexOf(b) !== -1) continue;

                    var bdx = pr.x - b.x, bdy = pr.y - b.y;
                    if (Math.sqrt(bdx * bdx + bdy * bdy) < G.BIRD_HIT_R) {
                        b.hp -= pr.dmg;
                        if (b.hp <= 0) G.birdDrop(b.x, b.y);
                        pr.hitEntities.push(b);

                        if (pr.piercing && pr.pierceCount > 0) {
                            pr.pierceCount--;
                            if (pr.pierceCount <= 0) {
                                shouldDestroy = true;
                            }
                        } else {
                            shouldDestroy = true;
                        }
                        break;
                    }
                }
            }

            // Suppression si le projectile a touché sa limite de transpercement, sa vie (portée max), ou sort de la map
            if (shouldDestroy || pr.life <= 0 || pr.x < 0 || pr.x > G.WORLD || pr.y < 0 || pr.y > G.WORLD) {
                state.projectiles.splice(i, 1);
            }
        }
    };
})();