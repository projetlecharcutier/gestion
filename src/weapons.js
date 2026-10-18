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

    // Mort d'un joueur par un autre joueur (friendly fire) : même voie que
    // la mort par zombie (zombies.js), la partie continue tant qu'il reste
    // un survivant. Le client local en solo n'a pas state.players : le
    // friendly fire n'existe qu'en multijoueur.
    function killPlayerFriendly(tgt, state) {
      tgt.hp = 0;
      tgt.alive = false;
      var anyAlive = false;
      for (var pai = 0; pai < state.players.length; pai++) {
        if (state.players[pai].alive) { anyAlive = true; break; }
      }
      if (!anyAlive) { state.gameOver = true; state.gameOverCause = "player"; }
    }

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
        // Soldats romains du camp : fragiles, tues par l'explosion aussi.
        var soldats = state.soldats || [];
        for (var si2 = 0; si2 < soldats.length; si2++) {
            var sd = soldats[si2];
            if (sd.hp <= 0) continue;
            var sdx2 = sd.x - x, sdy2 = sd.y - y;
            if (Math.sqrt(sdx2 * sdx2 + sdy2 * sdy2) <= r) {
                sd.hp -= dmg;
                sd.hitFlash = 0.25;
            }
        }
        // Animaux sauvages : l'explosion les tue aussi dans le rayon.
        for (var ai = 0; ai < (state.fauna || []).length; ai++) {
            var aa = state.fauna[ai];
            if (aa.hp <= 0) continue;
            var aadx = aa.x - x, aady = aa.y - y;
            if (Math.sqrt(aadx * aadx + aady * aady) <= r) {
                aa.hp -= dmg;
                if (aa.hp <= 0 && G.faunaDrop) G.faunaDrop(aa);
            }
        }
        // Dégâts alliés : l'explosion blesse aussi les joueurs dans le
        // rayon, sauf le propriétaire du tir (grenade, lance-flammes).
        if (state.players && pr.owner && pr.owner !== "tour" && pr.owner !== "local") {
          for (var ffbi = 0; ffbi < state.players.length; ffbi++) {
            var ffb = state.players[ffbi];
            if (!ffb.alive || ffb.id === pr.owner) continue;
            var ffdx = ffb.x - x, ffdy = ffb.y - y;
            if (Math.sqrt(ffdx * ffdx + ffdy * ffdy) <= r) {
              ffb.hp -= dmg;
              if (ffb.hp <= 0) killPlayerFriendly(ffb, state);
            }
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
    // Grille spatiale des entites mobiles pour les collisions projectiles.
    // Cellule 64 px : assez grande pour couvrir le deplacement max d'un
    // projectile entre deux frames (vitesse 600 px/s * 0.016 s = ~10 px),
    // assez petite pour filtrer 99% des entites lointaines. Reconstruite
    // UNE fois par frame dans updateProjectiles (les entites bougent, la
    // grille est jetee a la fin). evite le scan O(n_projectiles * n_zombies)
    // qui coutait ~620k tests/frame en pleine charge (120 projectiles x
    // 5000 zombies la nuit).
    var PROJ_CELL = 64;
    var projEntityGrid = null;
    var projEntityGridFrame = -1;
    function buildProjEntityGrid(state) {
        var grid = {};
        function addEnt(ent, kind) {
            if (!ent || ent.hp <= 0) return;
            var cx = Math.floor(ent.x / PROJ_CELL), cy = Math.floor(ent.y / PROJ_CELL);
            var k = cx + "," + cy;
            if (!grid[k]) grid[k] = [];
            grid[k].push({ ent: ent, kind: kind });
        }
        var zs = state.zombies || [];
        for (var i = 0; i < zs.length; i++) addEnt(zs[i], "zombie");
        var bs = state.birds || [];
        for (var bi = 0; bi < bs.length; bi++) addEnt(bs[bi], "bird");
        var ss = state.soldats || [];
        for (var si = 0; si < ss.length; si++) addEnt(ss[si], "soldat");
        var fs = state.fauna || [];
        for (var fi = 0; fi < fs.length; fi++) addEnt(fs[fi], "fauna");
        var ps = state.players || [];
        for (var pi = 0; pi < ps.length; pi++) if (ps[pi].alive) addEnt(ps[pi], "player");
        return grid;
    }
    function projEntitiesNear(grid, x, y, radius) {
        var out = [];
        var r = radius || 16;
        var cx0 = Math.floor((x - r) / PROJ_CELL), cx1 = Math.floor((x + r) / PROJ_CELL);
        var cy0 = Math.floor((y - r) / PROJ_CELL), cy1 = Math.floor((y + r) / PROJ_CELL);
        for (var gx = cx0; gx <= cx1; gx++) {
            for (var gy = cy0; gy <= cy1; gy++) {
                var arr = grid[gx + "," + gy];
                if (!arr) continue;
                for (var n = 0; n < arr.length; n++) out.push(arr[n]);
            }
        }
        return out;
    }

    // Déplacement des projectiles + collisions avec zombies et oiseaux. Appelé depuis update().
    G.updateProjectiles = function (dt) {
        var state = G.state;
        // Construit la grille spatiale des entites UNE fois par frame (les
        // projectiles partagent la meme grille pour toutes leurs collisions).
        var grid = buildProjEntityGrid(state);
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
            // 1. Collisions avec les entites proches (grille spatiale) :
            // zombies, oiseaux, soldats, faune, joueurs. Un seul balayage des
            // cellules voisines du projectile remplace 5 scans lineaires.
            var nearEnts = projEntitiesNear(grid, pr.x, pr.y, 16);
            for (var ei = 0; ei < nearEnts.length && !shouldDestroy; ei++) {
                var ne = nearEnts[ei];
                var z = ne.ent;
                if (pr.hitEntities.indexOf(z) !== -1) continue;
                var isZombie = ne.kind === "zombie";
                var isBird = ne.kind === "bird";
                var isSoldat = ne.kind === "soldat";
                var isFauna = ne.kind === "fauna";
                var isPlayer = ne.kind === "player";
                // Les fleches de tour ignorent oiseaux/soldats/faune/joueurs.
                if (pr.owner === "tour" && !isZombie) continue;
                // Friendly fire : jamais le proprietaire, jamais les tours.
                if (isPlayer && pr.owner && (pr.owner === "tour" || pr.owner === "local" || z.id === pr.owner)) continue;
                var hitR = isBird ? G.BIRD_HIT_R : (isFauna ? G.FAUNA_HIT_R : (isPlayer ? 12 : 14));
                var zdx = pr.x - z.x, zdy = pr.y - z.y;
                if (Math.sqrt(zdx * zdx + zdy * zdy) < hitR) {
                    if (pr.blast) {
                        G.blastAt(pr, pr.x, pr.y);
                        shouldDestroy = true;
                        break;
                    }
                    var wasAliveZ = z.hp > 0;
                    z.hp -= pr.dmg;
                    if (isZombie) {
                        if (wasAliveZ && z.hp <= 0) {
                            if (pr.owner === "tour") {
                                if (G.statsAddTowerKill) G.statsAddTowerKill();
                            } else if (!pr.owner || pr.owner === "local") {
                                if (G.statsAddKill) G.statsAddKill();
                            } else {
                                z.killedBy = pr.owner;
                            }
                        }
                    } else if (isBird) {
                        if (z.hp <= 0) G.birdDrop(z.x, z.y);
                    } else if (isSoldat) {
                        z.hitFlash = 0.25;
                    } else if (isFauna) {
                        if (z.hp <= 0) G.faunaDrop(z);
                    } else if (isPlayer) {
                        if (z.hp <= 0) killPlayerFriendly(z, state);
                    }
                    pr.hitEntities.push(z);
                    if (pr.piercing && pr.pierceCount > 0) {
                        pr.pierceCount--;
                        if (pr.pierceCount <= 0) shouldDestroy = true;
                    } else {
                        shouldDestroy = true;
                    }
                }
            }
            // 1b. Collisions avec les tours de siège (losange de base dans
            // les 5 % bas du PNG, cf. siege.js) : tout projectile les
            // endommage. La tour est solide pour les projectiles : pas de
            // transpercement.
            if (!shouldDestroy && G.hitsSiegeFoot) {
                var sg = G.hitsSiegeFoot(pr.x - 4, pr.y - 4, 8, 8);
                if (sg && pr.hitEntities.indexOf(sg) === -1) {
                    sg.hp -= pr.dmg;
                    pr.hitEntities.push(sg);
                    shouldDestroy = true;
                }
            }

            // Suppression si le projectile a touché sa limite de transpercement, sa vie (portée max), ou sort de la map
            if (shouldDestroy || pr.life <= 0 || pr.x < 0 || pr.x > G.WORLD || pr.y < 0 || pr.y > G.WORLD) {
                state.projectiles.splice(i, 1);
            }
        }
    };
})();