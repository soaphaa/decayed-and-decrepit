window.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('gameCanvas');
    const ctx    = canvas.getContext('2d');

    // ============================================================
    // PLAYER DIRECTIONAL SPRITES — 2 directions (left and right)
    //
    // The player sprite swaps between two PNGs based on angle:
    //   jasonRight.png  — shown when facing right (315°–360° and 0°–135°)
    //   jasonLeft.png   — shown when facing left  (135°–315°)
    //
    // No canvas rotation is applied — direction is baked into the image.
    // ============================================================
    const PLAYER_DIRS = [
        { src: 'assets/jasonRight.png', img: null, loaded: false },  // index 0 — right
        { src: 'assets/jasonLeft.png',  img: null, loaded: false },  // index 1 — left
    ];

    // Returns 0 (right sprite) or 1 (left sprite) based on player angle.
    // "Left" is any angle pointing into the left half of the circle (90°–270°).
    function getPlayerDirIndex(angle) {
        // Normalise to 0–2PI so negative angles work correctly
        const normalised = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        // PI/2 = 90°, 3*PI/2 = 270° — if between these, player faces left
        return (normalised > Math.PI / 2 && normalised < Math.PI * 1.5) ? 1 : 0;
    }

    // SPRITE CONFIGURATION
    // Sprites face RIGHT in the image (0 degrees).
    const SPRITES = {
        zombie: { src: 'assets/zombie.png', img: null, loaded: false },
    };

    // Loads all sprites and returns a Promise that resolves when every image has either loaded or errored.
    function loadSprites() {
        // Combine player directional sprites and zombie sprite into one list
        const allSprites = [
            ...PLAYER_DIRS.map((s, i) => ({ key: 'player_dir_' + i, sprite: s })),
            ...Object.entries(SPRITES).map(([key, s]) => ({ key, sprite: s })),
        ];

        const jobs = allSprites.map(({ key, sprite }) => new Promise(resolve => {
            const image = new Image();
            image.onload  = () => { sprite.img = image; sprite.loaded = true; resolve({ key, ok: true }); };
            image.onerror = () => { console.error('Could not load: ' + sprite.src); resolve({ key, ok: false }); };
            image.src = sprite.src;
        }));
        return Promise.all(jobs);
    }

    // Draws a player sprite — no rotation, direction is baked into the PNG
    function drawSpriteFlat(sprite, x, y, radius, placeholderColor) {
        const size = radius * 2;
        ctx.save();
        ctx.translate(x, y);
        if (sprite.loaded && sprite.img) {
            ctx.drawImage(sprite.img, -radius, -radius, size, size);
        } else {
            // Temporary placeholder — disappears once the PNG loads
            ctx.fillStyle = placeholderColor;
            ctx.fillRect(-radius, -radius, size, size);
        }
        ctx.restore();
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
    // spawnInterval — frames between spawns 
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
    const pauseScreenEl   = document.getElementById('pauseScreen');
    const gameCompleteEl  = document.getElementById('gameComplete');

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

    // Resume button on the pause screen — also works with ESC
    const resumeBtn = document.getElementById('resumeBtn');
    if (resumeBtn) resumeBtn.addEventListener('click', () => {
        gamePaused = false;
        if (pauseScreenEl) pauseScreenEl.classList.remove('show');
    });

    // Game complete screen — restart starts a new game, quit closes the tab
    const restartButton = document.getElementById('restartButton');
    if (restartButton) restartButton.addEventListener('click', () => {
        if (gameCompleteEl) gameCompleteEl.classList.remove('show');
        initGame();
    });

    const quitButton = document.getElementById('quitButton');
    if (quitButton) quitButton.addEventListener('click', () => {
        // Hide the HUD and controls bar so nothing shows behind the overlay
        const hud      = document.getElementById('hud');
        const controls = document.getElementById('controls');
        if (hud)      hud.style.display      = 'none';
        if (controls) controls.style.display = 'none';
        window.close(); // closes the tab — may be blocked by some browsers
    });

    // PLAYER
    // Adjust radius to scale the player sprite up or down.
    const player = {
        x:             canvas.width  / 2,
        y:             canvas.height / 2,
        radius:        48,
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
        // Escape toggles pause — only works when the game is actively running
        if (e.code === 'Escape' && gameRunning) {
            gamePaused = !gamePaused;
            if (pauseScreenEl) pauseScreenEl.classList.toggle('show', gamePaused);
        }
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
    let zombies = [];

    function spawnZombie() {
        const x = -30;
        const y = 30 + Math.random() * (canvas.height - 60);
        zombies.push({
            x, y,
            radius:           40,
            speed:            0.8 + Math.random() * 0.6,
            hp:               60,
            maxHp:            60,
            separationRadius: 30,
            damageCooldown:   120, // grace period so zombie can't hit player before entering screen
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
    let gamePaused     = false;

    function initGame() {
        player.x     = canvas.width  / 2;
        player.y     = canvas.height / 2;
        player.angle = 0;
        player.hp    = player.maxHp;
        currentLevel = 0;
        score        = 0;
        zombies      = [];
        bullets      = [];
        //target       = { x: 450, y: 200, width: 60, height: 60, health: 100, alive: true };
        gameRunning  = true;
        gamePaused   = false;
        if (pauseScreenEl)  pauseScreenEl.classList.remove('show');
        if (gameCompleteEl) gameCompleteEl.classList.remove('show');
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
            // All levels beaten — show the game complete / you won screen
            gameRunning = false;
            if (scoreEl) scoreEl.textContent = score;
            if (gameCompleteEl) gameCompleteEl.classList.add('show');
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

    // ZOMBIE AI movement
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    function normalize(dx, dy) {
        const len = Math.hypot(dx, dy);
        return len ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
    }

    function updateZombie(z, index) {
        z.damageCooldown = Math.max(0, z.damageCooldown - 1);
        z.flashT = Math.max(0, z.flashT - 1);

        // Get the direction from this zombie straight to the player
        const toPlayer = normalize(player.x - z.x, player.y - z.y);
        let moveX = toPlayer.x;
        let moveY = toPlayer.y;

        // Separation: push away from overlapping zombies so they don't stack
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

        // seperation force
        const n = normalize(moveX + sepX * 2.5, moveY + sepY * 2.5);
        z.x += n.x * z.speed;
        z.y += n.y * z.speed;

        // Rotate sprite to face the direction of movement
        if (n.x !== 0 || n.y !== 0) z.angle = Math.atan2(n.y, n.x);

        // if in contact with player, the zombie will deal damage
        // Only deal damage once zombie is on screen (z.x > 0)
        const dp = dist(z, player);
        if (z.x > 0 && dp < z.radius + player.radius && z.damageCooldown <= 0) {
            player.hp -= 10;
            z.damageCooldown = 50;
            if (player.hp <= 0) onGameOver();
        }
    }

    // UPDATE FRAMES BASED ON USER INPUT
    function update() {
        if (!gameRunning) return;
        if (gamePaused)  return; // freeze everything while paused

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

        //The zombie spawning timer
        if (zombiesToSpawn > 0) {
            spawnTimer++;
            if (spawnTimer >= LEVELS[currentLevel].spawnInterval) {
                spawnTimer = 0;
                spawnZombie();
                zombiesToSpawn--;
            }
        }

        //Zombie frame updating
        for (let i = 0; i < zombies.length; i++) {
            updateZombie(zombies[i], i); // Pass the zombie AND its index (needed for separation)
        }

        // Bullets angle and direction calculation
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.dx * b.speed;
            b.y += b.dy * b.speed;

            if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
                bullets.splice(i, 1);
                continue;
            }

            //test target
            // if (target.alive &&
            //     b.x > target.x && b.x < target.x + target.width &&
            //     b.y > target.y && b.y < target.y + target.height) {
            //     target.health -= 20;
            //     bullets.splice(i, 1);
            //     if (target.health <= 0) target.alive = false;
            //     continue;
            // }

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

        // check if level is complete: all zombies for the level are killed
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
        // Pick the correct directional sprite based on current angle
        const dirSprite = PLAYER_DIRS[getPlayerDirIndex(player.angle)];

        // Draw flat (no canvas rotation) — the direction is baked into the PNG
        drawSpriteFlat(dirSprite, player.x, player.y, player.radius, '#cccccc');

        // HP bar below the sprite
        const bw  = player.radius * 2;
        const bx  = player.x - bw / 2;
        const by  = player.y + player.radius + 6;
        const pct = player.hp / player.maxHp;
        ctx.fillStyle = '#400';
        ctx.fillRect(bx, by, bw, 5);
        ctx.fillStyle = pct > 0.5 ? '#44ee44' : pct > 0.25 ? '#eeaa22' : '#ee3333'; //health bar
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

    // function drawTarget() {
    //     if (!target.alive) return;
    //     ctx.fillStyle = 'green';
    //     ctx.fillRect(target.x, target.y, target.width, target.height);
    //     ctx.fillStyle = 'white';
    //     ctx.font = '16px monospace';
    //     ctx.fillText('HP: ' + target.health, target.x, target.y - 5);
    // }

    function drawZombies() {
        zombies.forEach(z => {
            // White flash overlay on hit
            if (z.flashT > 0 && Math.floor(z.flashT / 2) % 2 === 0) {
                ctx.save();
                ctx.translate(z.x, z.y);
                ctx.rotate(z.angle);
                ctx.globalAlpha = 0.55;
                ctx.fillStyle   = '#ffffff';
                ctx.fillRect(-z.radius, -z.radius, z.radius * 2, z.radius * 2);
                ctx.restore();
                ctx.globalAlpha = 1;
            }

            drawSprite(SPRITES.zombie, z.x, z.y, z.radius, z.angle, '#44aa44');

            // HP bar above sprite
            const bw = z.radius * 2;
            const bx = z.x - bw / 2;
            const by = z.y - z.radius - 10;
            ctx.fillStyle = '#400';
            ctx.fillRect(bx, by, bw, 4);
            ctx.fillStyle = '#22cc22';
            ctx.fillRect(bx, by, bw * (z.hp / z.maxHp), 4);
        });
    }

    // function drawSpawnEdge() {
    //     ctx.strokeStyle = 'rgba(255,60,60,0.25)';
    //     ctx.lineWidth   = 2;
    //     ctx.setLineDash([8, 6]);
    //     ctx.beginPath();
    //     ctx.moveTo(2, 0);
    //     ctx.lineTo(2, canvas.height);
    //     ctx.stroke();
    //     ctx.setLineDash([]);
    // }

    // DRAW LOOP — only call functions defined above.
    // If you comment out a draw function, remove its call here too.
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // drawSpawnEdge();
        // drawTarget();
        drawZombies();
        drawPlayer();
        drawBullets();
        // drawOffscreenIndicators();
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