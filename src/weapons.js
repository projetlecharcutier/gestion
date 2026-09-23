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
        // Stats de fin de partie : un "coup de feu" par declenchement du tir
        // (le fusil compte 1 coup, pas 5 pellets).
        if (G.statsAddShot) G.statsAddShot();
        // Horodatage du tir pour l'animation d'action du personnage
        // (frames de tir de l'arme, 1 frame = 0.1 s, cycle = cadence).
        state.lastShotAt = G.state.time;
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
                    dmg: G.weaponDmg(state.equipped),
                    color: st.color,
                    size: st.size || 3,       // <-- Taille personnalisée (ex: 2 pour le fusil, 5 pour le pistolet)
                    type: st.type || "pistolet", // <-- Permet de savoir si c'est un arc, fusil, etc.
                    trail: [],
                    piercing: false,
                    hitEntities: [] // Évite de toucher plusieurs fois la même entité par projectile unique
                });
            }
        }
        // Lance-flammes : jets de flammes courts, dégâts de zone au contact,
        // cadence très rapide. Pas de transpercement : la flamme consume en zone.
        else if (weaponType === "flamme") {
            var fang = baseAng + (Math.random() * 2 - 1) * st.spread;
            var fspd = st.speed * (0.85 + Math.random() * 0.3);
            state.projectiles.push({
                x: p.x, y: p.y - G.PLAYER_H * 0.5,
                vx: Math.cos(fang) * fspd, vy: Math.sin(fang) * fspd,
                life: st.life, dmg: G.weaponDmg(state.equipped),
                color: st.color, size: st.size || 8,
                type: "flamme", blast: true, blastRadius: st.blastRadius || 30,
                trail: [], piercing: false, pierceCount: 0, hitEntities: []
            });
        }
        // Grenade : projectile en cloche qui explose en zone à l'impact
        // (ou à court terme de vie), dégâts à tous les zombies dans le rayon.
        else if (weaponType === "grenade") {
            var gang = baseAng + (Math.random() * 2 - 1) * st.spread;
            state.projectiles.push({
                x: p.x, y: p.y - G.PLAYER_H * 0.5,
                vx: Math.cos(gang) * st.speed, vy: Math.sin(gang) * st.speed,
                life: st.life, dmg: G.weaponDmg(state.equipped),
                color: st.color, size: st.size || 6,
                type: "grenade", blast: true, blastRadius: st.blastRadius || 120,
                trail: [], piercing: false, pierceCount: 0, hitEntities: []
            });
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
                dmg: G.weaponDmg(state.equipped),
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

    // Explosion de zone (grenade, lance-flammes) : applique les degats du
    // projectile a toutes les entites vivantes dans blastRadius autour du
    // point d'impact (zombies, oiseaux). Les flammes ont un petit rayon qui
    // prolonge le cone de feu, la grenade un grand rayon devastateur.
    G.blastAt = function (pr, x, y) {
        var state = G.state;
        var r = pr.blastRadius || 60;
        var dmg = pr.dmg || 0;
        for (var zi = 0; zi < state.zombies.length; zi++) {
            var z = state.zombies[zi];
            if (z.hp <= 0) continue;
            var dx = z.x - x, dy = z.y - y;
            if (Math.sqrt(dx * dx + dy * dy) <= r) {
                var wasAlive = z.hp > 0;
                z.hp -= dmg;
                // Attribution du kill (stats de fin de partie) : le zombie
                // porte l'id du tueur pour que le serveur credite le bon
                // joueur avant le cleanup. Sans owner = tir local (solo).
                if (wasAlive && z.hp <= 0) {
                    if (!pr.owner || pr.owner === "local") {
                        if (G.statsAddKill) G.statsAddKill();
                    } else {
                        z.killedBy = pr.owner;
                    }
                }
            }
        }
        for (var bi = 0; bi < state.birds.length; bi++) {
            var b = state.birds[bi];
            if (b.hp <= 0) continue;
            var bdx = b.x - x, bdy = b.y - y;
            if (Math.sqrt(bdx * bdx + bdy * bdy) <= r) {
                b.hp -= dmg;
                if (b.hp <= 0 && G.birdDrop) G.birdDrop(b.x, b.y);
            }
        }
        // Tours de siège : l'explosion les endommage aussi (centre de la
        // tour dans le rayon de blast).
        if (G.hitsSiegeFoot) {
            var sieges = state.sieges || [];
            for (var si = 0; si < sieges.length; si++) {
                var st = sieges[si];
                if (st.hp <= 0) continue;
                var sdx = st.x - x, sdy = st.y - y;
                if (Math.sqrt(sdx * sdx + sdy * sdy) <= r) st.hp -= dmg;
            }
        }
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

            // Projectiles a explosion (grenade, lance-flammes) : en fin de vie
            // (portee atteinte) ou sortie de carte, les degats s'appliquent en
            // zone autour du point d'impact. L'impact direct sur un zombie est
            // gere plus bas par la collision standard puis l'explosion.
            if (pr.blast && (pr.life <= 0 || pr.x < 0 || pr.x > G.WORLD || pr.y < 0 || pr.y > G.WORLD)) {
                G.blastAt(pr, pr.x, pr.y);
                state.projectiles.splice(i, 1);
                continue;
            }
            // 1. Collisions avec les Zombies
            for (var zi = 0; zi < state.zombies.length; zi++) {
                var z = state.zombies[zi];

                // Vérifier si ce projectile a déjà touché ce zombie précis
                if (pr.hitEntities.indexOf(z) !== -1) continue;

                var zdx = pr.x - z.x, zdy = pr.y - z.y;
                if (Math.sqrt(zdx * zdx + zdy * zdy) < 14) {
                    // Projectile explosif : la collision declenche l'explosion
                    // en zone (tous les zombies dans le rayon) et le projectile
                    // disparait immediatement.
                    if (pr.blast) {
                        G.blastAt(pr, pr.x, pr.y);
                        shouldDestroy = true;
                        break;
                    }
                    var wasAliveZ = z.hp > 0;
                    z.hp -= pr.dmg;
                    // Kill attribue au proprietaire du projectile (stats fin
                    // de partie). Sans owner = tir local (solo).
                    if (wasAliveZ && z.hp <= 0) {
                        if (pr.owner === "tour") {
                            if (G.statsAddTowerKill) G.statsAddTowerKill();
                        } else if (!pr.owner || pr.owner === "local") {
                            if (G.statsAddKill) G.statsAddKill();
                        } else {
                            z.killedBy = pr.owner;
                        }
                    }
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

            // 1b. Collisions avec les tours de siège (emprise basse 10 % du
            // PNG, cf. siege.js) : tout projectile les endommage. La tour est
            // solide pour les projectiles : pas de transpercement.
            if (!shouldDestroy && G.hitsSiegeFoot) {
                var sg = G.hitsSiegeFoot(pr.x - 4, pr.y - 4, 8, 8);
                if (sg && pr.hitEntities.indexOf(sg) === -1) {
                    sg.hp -= pr.dmg;
                    pr.hitEntities.push(sg);
                    shouldDestroy = true;
                }
            }

            // 2. Collisions avec les Oiseaux (si le projectile n'est pas déjà détruit)
            // Les flèches de tour ignorent les oiseaux (cible : zombies uniquement).
            if (!shouldDestroy && pr.owner !== "tour") {
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