
window.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('gameCanvas');
    const ctx    = canvas.getContext('2d');

    // SPRITE CONFIGURATION
    // Sprites face RIGHT in the image (0 degrees).
    const SPRITES = {
        player: { src: 'assets/jason.png', img: null, loaded: false },
        zombie: { src: 'assets/jason.png', img: null, loaded: false },
    };

    // Loads all sprites and returns a Promise that resolves when every image has either loaded or errored.
    function loadSprites() {
        const jobs = Object.entries(SPRITES).map(([key, sprite]) => new Promise(resolve => {
            const image = new Image();
            image.onload  = () => { sprite.img = image; sprite.loaded = true; resolve({ key, ok: true }); };
            image.onerror = () => { console.error('Could not load: ' + sprite.src); resolve({ key, ok: false }); };
            image.src = sprite.src;
        }));
        return Promise.all(jobs);
    }

    // Draws a PNG sprite centred at (x, y), rotated to `angle`, sized radius*2.
    // Shows a coloured placeholder rectangle only while the image is still loading.
    function drawSprite(sprite, x, y, radius, angle, placeholderColor) {
        const size = radius * 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        if (sprite.loaded && sprite.img) {
            ctx.drawImage(sprite.img, -radius, -radius, size, size);
        } else {
            // Temporary placeholder — disappears once the PNG loads
            ctx.fillStyle = placeholderColor;
            ctx.fillRect(-radius, -radius, size, size);
        }
        ctx.restore();
    }

    // LEVEL CONFIGURATION
    // zombieCount   — total zombies that MUST be killed to clear the level
    // spawnInterval — frames between spawns (60 ≈ 1 second at 60fps)
    const LEVELS = [
        { zombieCount: 3,  spawnInterval: 180 },
        { zombieCount: 6,  spawnInterval: 150 },
        // { zombieCount: 10, spawnInterval: 120 }, more levels if neccessary
        // { zombieCount: 15, spawnInterval: 90  },
        // { zombieCount: 20, spawnInterval: 60  },
    ];

    // HUD ELEMENTS (Heads up display)
    // HUD elements (may be missing in lightweight builds)
    const hpEl          = document.getElementById('hpVal');
    const levelEl       = document.getElementById('levelVal');
    const killsEl       = document.getElementById('killsVal');
    const totalEl       = document.getElementById('totalVal');
    const scoreEl       = document.getElementById('scoreVal');
    const gameOverEl    = document.getElementById('gameOver');
    const finalScoreEl  = document.getElementById('finalScore');
    const lvlCompleteEl = document.getElementById('levelComplete');
    const lvlTitleEl    = document.getElementById('levelCompleteTitle');

    // Only attach listeners if the buttons exist (prevents runtime errors)
    const restartBtn = document.getElementById('restartBtn');
    if (restartBtn) restartBtn.addEventListener('click', () => {
        if (gameOverEl) gameOverEl.classList.remove('show');
        initGame();
    });

    const nextLevelBtn = document.getElementById('nextLevelBtn');
    if (nextLevelBtn) nextLevelBtn.addEventListener('click', () => {
        if (lvlCompleteEl) lvlCompleteEl.classList.remove('show');
        advanceLevel();
    });

    // PLAYER
    // Adjust radius to scale the player sprite up or down.
    const player = {
        x:             canvas.width  / 2,
        y:             canvas.height / 3,
        radius:        24,
        speed:         3,
        angle:         0,
        rotationSpeed: 0.05,
        hp:            100,
        maxHp:         100,
    };

    // INPUT
    const keys = {};
    window.addEventListener('keydown', e => {
        keys[e.key] = true;
        if (e.code === 'Space') { e.preventDefault(); shoot(); }
    });
    window.addEventListener('keyup', e => { keys[e.key] = false; });

    // BULLETS
    let bullets = [];

    function shoot() {
        bullets.push({
            x:      player.x,
            y:      player.y,
            radius: 5,
            speed:  6,
            dx:     Math.cos(player.angle),
            dy:     Math.sin(player.angle),
        });
    }

    // TARGET (stationary box)
    let target = {
        x: 450, y: 200,
        width: 60, height: 60,
        health: 100,
        alive: true,
    };

    // ZOMBIES
    // Adjust radius to scale the zombie sprite up or down.
    let zombies = [];

    function spawnZombie() {
        const x = -30;
        const y = 30 + Math.random() * (canvas.height - 60);
        zombies.push({
            x, y,
            radius:           20,
            speed:            0.8 + Math.random() * 0.6,
            hp:               60,
            maxHp:            60,
            detectionRadius:  180,
            separationRadius: 30,
            wanderAngle:      0,
            wanderTimer:      0,
            bobT:             Math.random() * Math.PI * 2,
            damageCooldown:   0,
            flashT:           0,
            angle:            0,
        });
    }

    // LEVEL STATE
    let currentLevel   = 0;
    let zombiesToSpawn = 0;
    let zombiesKilled  = 0;
    let spawnTimer     = 0;
    let score          = 0;
    let gameRunning    = false;

    function initGame() {
        player.x     = canvas.width  / 2;
        player.y     = canvas.height / 2;
        player.angle = 0;
        player.hp    = player.maxHp;
        currentLevel = 0;
        score        = 0;
        zombies      = [];
        bullets      = [];
        target       = { x: 450, y: 200, width: 60, height: 60, health: 100, alive: true };
        gameRunning  = true;
        startLevel(currentLevel);
    }

    function startLevel(index) {
        const lvl      = LEVELS[index];
        zombiesToSpawn = lvl.zombieCount;
        zombiesKilled  = 0;
        spawnTimer     = lvl.spawnInterval; // starts at max so first zombie enters immediately
        zombies        = [];
        bullets        = [];
        updateHUD();
    }

    function onLevelComplete() {
        gameRunning = false;
        if (lvlTitleEl) lvlTitleEl.textContent = 'LEVEL ' + (currentLevel + 1) + ' CLEAR';
        if (lvlCompleteEl) lvlCompleteEl.classList.add('show');
    }

    function advanceLevel() {
        currentLevel++;
        if (currentLevel >= LEVELS.length) {
            if (finalScoreEl) finalScoreEl.textContent = score;
            if (gameOverEl) gameOverEl.classList.add('show');
        } else {
            gameRunning = true;
            startLevel(currentLevel);
        }
    }

    function onGameOver() {
        gameRunning = false;
        if (finalScoreEl) finalScoreEl.textContent = score;
        if (gameOverEl) gameOverEl.classList.add('show');
    }

    // ZOMBIE AI HELPERS
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    function normalize(dx, dy) {
        const len = Math.hypot(dx, dy);
        return len ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
    }

    function updateZombie(z, index) {
        z.bobT           += 0.12;
        z.damageCooldown  = Math.max(0, z.damageCooldown - 1);
        z.flashT          = Math.max(0, z.flashT - 1);
        z.wanderTimer     = Math.max(0, z.wanderTimer - 1);

        const dp = dist(z, player);
        let moveX = 0, moveY = 0;

        if (dp < z.detectionRadius) {
            // Chase: steer directly toward player
            const d = normalize(player.x - z.x, player.y - z.y);
            moveX = d.x;
            moveY = d.y;
        } else {
            // Wander: random direction biased rightward so zombies drift into the map
            if (z.wanderTimer <= 0) {
                z.wanderAngle = (Math.random() - 0.5) * (Math.PI * 0.5);
                z.wanderTimer = 60 + Math.random() * 90;
            }
            moveX = Math.cos(z.wanderAngle);
            moveY = Math.sin(z.wanderAngle);
        }

        // Separation: push away from overlapping zombies
        let sepX = 0, sepY = 0;
        for (let j = 0; j < zombies.length; j++) {
            if (j === index) continue;
            const other = zombies[j];
            const d = dist(z, other);
            if (d < z.separationRadius && d > 0) {
                const strength = (z.separationRadius - d) / z.separationRadius;
                sepX += ((z.x - other.x) / d) * strength;
                sepY += ((z.y - other.y) / d) * strength;
            }
        }

        const n = normalize(moveX + sepX * 2.5, moveY + sepY * 2.5);
        z.x += n.x * z.speed;
        z.y += n.y * z.speed;

        // Update facing angle for sprite rotation
        if (n.x !== 0 || n.y !== 0) z.angle = Math.atan2(n.y, n.x);

        // Zombies are NEVER removed for going off-screen — player must kill all of them

        // Contact damage to player
        if (dp < z.radius + player.radius && z.damageCooldown <= 0) {
            player.hp -= 10;
            z.damageCooldown = 50;
            if (player.hp <= 0) onGameOver();
        }
    }

    // UPDATE
    function update() {
        if (!gameRunning) return;

        // Rotation
        if (keys['ArrowLeft'])  player.angle -= player.rotationSpeed;
        if (keys['ArrowRight']) player.angle += player.rotationSpeed;

        // Movement
        let dx = 0, dy = 0;
        if (keys['w']) dy -= player.speed;
        if (keys['s']) dy += player.speed;
        if (keys['a']) dx -= player.speed;
        if (keys['d']) dx += player.speed;

        if (dx !== 0 && dy !== 0) {
            const inv = 1 / Math.sqrt(2);
            dx *= inv; dy *= inv;
        }

        player.x = Math.max(player.radius, Math.min(canvas.width  - player.radius, player.x + dx));
        player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y + dy));

        // Timed zombie spawning — only while zombies are still queued
        if (zombiesToSpawn > 0) {
            spawnTimer++;
            if (spawnTimer >= LEVELS[currentLevel].spawnInterval) {
                spawnTimer = 0;
                spawnZombie();
                zombiesToSpawn--;
            }
        }

        // Run AI — zombies are never culled for being off-screen
        for (let i = 0; i < zombies.length; i++) {
            updateZombie(zombies[i], i);
        }

        // Bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.dx * b.speed;
            b.y += b.dy * b.speed;

            if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
                bullets.splice(i, 1);
                continue;
            }

            if (target.alive &&
                b.x > target.x && b.x < target.x + target.width &&
                b.y > target.y && b.y < target.y + target.height) {
                target.health -= 20;
                bullets.splice(i, 1);
                if (target.health <= 0) target.alive = false;
                continue;
            }

            let hit = false;
            for (let j = zombies.length - 1; j >= 0; j--) {
                const z = zombies[j];
                if (dist(b, z) < b.radius + z.radius) {
                    z.hp    -= 20;
                    z.flashT = 8;
                    bullets.splice(i, 1);
                    if (z.hp <= 0) {
                        zombies.splice(j, 1);
                        zombiesKilled++;
                        score += 10;
                    }
                    hit = true;
                    break;
                }
            }
            if (hit) continue;
        }

        // Level complete: all zombies spawned and all killed
        if (zombiesToSpawn === 0 && zombies.length === 0 &&
            zombiesKilled === LEVELS[currentLevel].zombieCount) {
            onLevelComplete();
        }

        updateHUD();
    }

    // HUD
    function updateHUD() {
        if (hpEl)    hpEl.textContent    = Math.max(0, player.hp);
        if (levelEl) levelEl.textContent = currentLevel + 1;
        if (killsEl) killsEl.textContent = zombiesKilled;
        if (totalEl) totalEl.textContent = LEVELS[currentLevel] ? LEVELS[currentLevel].zombieCount : '?';
        if (scoreEl) scoreEl.textContent = score;
    }

    // DRAW
    function drawPlayer() {
        drawSprite(SPRITES.player, player.x, player.y, player.radius, player.angle, '#cccccc');

        // HP bar below the sprite
        const bw  = player.radius * 2;
        const bx  = player.x - bw / 2;
        const by  = player.y + player.radius + 6;
        const pct = player.hp / player.maxHp;
        ctx.fillStyle = '#400';
        ctx.fillRect(bx, by, bw, 5);
        ctx.fillStyle = pct > 0.5 ? '#44ee44' : pct > 0.25 ? '#eeaa22' : '#ee3333';
        ctx.fillRect(bx, by, bw * pct, 5);
    }

    function drawBullets() {
        bullets.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, 2 * Math.PI);
            ctx.fillStyle = 'yellow';
            ctx.fill();
        });
    }

    function drawTarget() {
        if (!target.alive) return;
        ctx.fillStyle = 'green';
        ctx.fillRect(target.x, target.y, target.width, target.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px monospace';
        ctx.fillText('HP: ' + target.health, target.x, target.y - 5);
    }

    function drawZombies() {
        zombies.forEach(z => {
            // Skip drawing if far off the visible canvas (still active in AI)
            if (z.x < -100 || z.x > canvas.width  + 100 ||
                z.y < -100 || z.y > canvas.height + 100) return;

            const zy = z.y + Math.sin(z.bobT) * 2; // gentle float animation

            // White flash overlay on hit
            if (z.flashT > 0 && Math.floor(z.flashT / 2) % 2 === 0) {
                ctx.save();
                ctx.translate(z.x, zy);
                ctx.rotate(z.angle);
                ctx.globalAlpha = 0.55;
                ctx.fillStyle   = '#ffffff';
                ctx.fillRect(-z.radius, -z.radius, z.radius * 2, z.radius * 2);
                ctx.restore();
                ctx.globalAlpha = 1;
            }

            drawSprite(SPRITES.zombie, z.x, zy, z.radius, z.angle, '#44aa44');

            // HP bar above sprite
            const bw = z.radius * 2;
            const bx = z.x - bw / 2;
            const by = zy - z.radius - 10;
            ctx.fillStyle = '#400';
            ctx.fillRect(bx, by, bw, 4);
            ctx.fillStyle = '#22cc22';
            ctx.fillRect(bx, by, bw * (z.hp / z.maxHp), 4);
        });
    }

    // Red triangle arrows on the canvas edge pointing to off-screen zombies
    function drawOffscreenIndicators() {
        const pad = 20;
        zombies.forEach(z => {
            if (z.x > -z.radius && z.x < canvas.width  + z.radius &&
                z.y > -z.radius && z.y < canvas.height + z.radius) return;

            const angle = Math.atan2(z.y - canvas.height / 2, z.x - canvas.width / 2);
            const ex = canvas.width  / 2 + Math.cos(angle) * (canvas.width  / 2 - pad);
            const ey = canvas.height / 2 + Math.sin(angle) * (canvas.height / 2 - pad);

            ctx.save();
            ctx.translate(ex, ey);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(-7,  7);
            ctx.lineTo(-7, -7);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,68,68,0.9)';
            ctx.fill();
            ctx.restore();
        });
    }

    function drawSpawnEdge() {
        ctx.strokeStyle = 'rgba(255,60,60,0.25)';
        ctx.lineWidth   = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(2, 0);
        ctx.lineTo(2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawSpawnEdge();
        drawTarget();
        drawZombies();
        drawPlayer();
        drawBullets();
        drawOffscreenIndicators();
    }

    // GAME LOOP
    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    // Load sprites first, then start the game loop. Game will still start if some
    // sprites fail to load — placeholders are shown until images are available.
    loadSprites().then(results => {
        const failed = results.filter(r => !r.ok).map(r => r.key);
        if (failed.length) console.warn('Some sprites failed to load:', failed);
        initGame();
        loop();
    });
});