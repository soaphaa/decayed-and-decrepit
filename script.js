// center circle controlled by WASD/arrow keys
// Top-down shooter with rotation + shooting + damage system


window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');


    // =========================
    // PLAYER
    // =========================
    const player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 20,
        speed: 3,
        angle: 0,
        rotationSpeed: 0.05
    };


    // =========================
    // INPUT KEYS
    // =========================
    const keys = {};


    window.addEventListener('keydown', e => {
        keys[e.key] = true;


        if (e.code === 'Space') {
            shoot();
        }
    });


    window.addEventListener('keyup', e => {
        keys[e.key] = false;
    });


    // BULLETS
    let bullets = [];


    // Called when the player presses Space — adds a new bullet to the array.
    function shoot() {
        bullets.push({
            x: player.x,               // Bullet starts at the player's current position
            y: player.y,
            radius: 5,                  // Bullet is drawn as a small circle of radius 5px
            speed: 6,                   // Bullet travels 6 pixels per frame
            dx: Math.cos(player.angle), // Horizontal component of direction.
                                        // Math.cos converts the player's angle (radians) into
                                        // an x-axis multiplier (e.g. angle=0 -> dx=1, pointing right)
            dy: Math.sin(player.angle)  // Vertical component of direction.
                                        // Math.sin converts the angle into a y-axis multiplier
        });
    }


    // =========================
    // TARGET (Stationary Object)
    // =========================
    let target = {
        x: 450,
        y: 200,
        width: 60,
        height: 60,
        health: 100,
        alive: true
    };

    // An array that holds all active zombie objects in the game.
    let zombies = [];

    // Creates one new zombie and adds it to the zombies array.
    // All zombies spawn off the LEFT edge of the canvas.
    function spawnZombie() {

        const x = -20; // Place the zombie

        // Pick a random vertical position, keeping 30px away from the top and bottom edges
        // so zombies don't spawn in corners. Math.random() returns a number between 0 and 1.
        const y = 30 + Math.random() * (canvas.height - 60);

        zombies.push({
            x,                                          // Spawn position
            y,                                          
            radius: 12,                                
            speed: 0.8 + Math.random() * 0.6,
            hp: 60,                                     // Starting health points
            maxHp: 60,                                  // Used to calculate how full the HP bar is
            detectionRadius: 180,                       // If the player is within 180px, zombie switches to chase mode
            separationRadius: 30,                       // Zombies push each other away when closer than 30px
            wanderAngle: 0,                            
            wanderTimer: 0,                             // Countdown until the zombie picks a new wander direction
            bobT: Math.random() * Math.PI * 2,         // Random starting phase for the up-down bob animation
                                                        
            color: 'hsl(' + (110 + Math.random() * 30) + ', 65%, 38%)', // green ew
            damageCooldown: 0,                          // Frames to wait before this zombie can damage the player again
            flashT: 0,                                  // Countdown for the white flash effect when hit by a bullet
        });
    }

    // Tracks how many frames since the last zombie spawned
    let spawnTimer = 0;
    const SPAWN_INTERVAL = 120;

    function updateZombie(z, index) {

        z.bobT += 0.12;  // Advance the bob animation timer each frame (causes the up-down float effect)
        // Count down the damage cooldown
        z.damageCooldown = Math.max(0, z.damageCooldown - 1);
        // Count down the hit-flash timer.
        z.flashT = Math.max(0, z.flashT - 1);
        z.wanderTimer = Math.max(0, z.wanderTimer - 1);

        // Calculate how far away the player currently is.
        const dp = dist(z, player);

        // These will hold the desired movement direction this frame (before separation is added).
        let moveX = 0, moveY = 0;

        // ── BEHAVIOUR 1 & 2: Chase vs Wander ─────────────────────────────────────────
        if (dp < z.detectionRadius) {
            // CHASE MODE: Player is within detection range.
            // Calculate the direction from this zombie toward the player.
            const d = normalize(player.x - z.x, player.y - z.y);
            moveX = d.x; // Move in that direction
            moveY = d.y;
        } else {
            // WANDER MODE: Player is too far away to detect.
            if (z.wanderTimer <= 0) {
                // Timer ran out so pick a new random wander angle (random shi)
                z.wanderAngle = (Math.random() - 0.5) * (Math.PI * 0.5);
                z.wanderTimer = 60 + Math.random() * 90;
            }
            // Use cosine/sine to convert the wander angle into x/y movement components.
            moveX = Math.cos(z.wanderAngle);
            moveY = Math.sin(z.wanderAngle);
        }

        //Avoiding overlap
        let sepX = 0, sepY = 0;

        for (let j = 0; j < zombies.length; j++) {
            if (j === index) continue;        

            const other = zombies[j];           // The other zombie we're checking against
            const d = dist(z, other);           // Distance between this zombie and the other one

            if (d < z.separationRadius && d > 0) {
                // They're overlapping
                const strength = (z.separationRadius - d) / z.separationRadius;

                // Add a push force in the direction AWAY from the other zombie to avoid collision
                sepX += ((z.x - other.x) / d) * strength;
                sepY += ((z.y - other.y) / d) * strength;
            }
        }

        // ── AI MOVEMENT ────────────────────────────────────────────────────────────
        const n = normalize(moveX + sepX * 2.5, moveY + sepY * 2.5);

        // Move the zombie by its speed in the blended direction.
        z.x += n.x * z.speed;
        z.y += n.y * z.speed;

        // ── PLAYER CONTACT DAMAGE ─────────────────────────────────────────────────────
        if (dp < z.radius + player.radius && z.damageCooldown <= 0) {
            player.hp -= 10;
            z.damageCooldown = 50; // This zombie can't deal damage again for 50 frames
        }
    }



    // UPDATE FUNCTION
    function update() {


        // --- ROTATION ---
        if (keys['ArrowLeft']) {
            player.angle -= player.rotationSpeed;
        }
        if (keys['ArrowRight']) {
            player.angle += player.rotationSpeed;
        }


        // --- MOVEMENT (Forward / Backward relative to angle)
        let dx = 0;
        let dy = 0;


        if (keys['w']) {
            dy -= player.speed;
        }
        if (keys['s']){
            dy += player.speed;  
        }
        if (keys['a']) {
            dx -= player.speed;
        }
        if (keys['d']){
            dx += player.speed;
        }


        // Normalize diagonal speed
        if (dx !== 0 && dy !== 0) {
            const inv = 1 / Math.sqrt(2);
            dx *= inv;
            dy *= inv;
        }


        player.x += dx;
        player.y += dy;


        //KEEP PLAYER INSIDE BOX
        player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

        //ZOMBIE SPAWNING
        spawnTimer++;

        // Once the timer reaches the 120, spawn a zombie and reset again
        if (spawnTimer >= SPAWN_INTERVAL) {
            spawnTimer = 0;
            spawnZombie();
        }

        // --- UPDATE ALL ZOMBIES ---
        for (let i = 0; i < zombies.length; i++) {
            updateZombie(zombies[i], i); // Pass the zombie AND its index (needed for separation)
        }

        //UPDATE BULLETS
        bullets.forEach((b, index) => {
            b.x += b.dx * b.speed;
            b.y += b.dy * b.speed;

            // Remove bullets if offscreen
            if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
                bullets.splice(index, 1);
            }


            // Collision with target
            if (target.alive &&
                b.x > target.x &&
                b.x < target.x + target.width &&
                b.y > target.y &&
                b.y < target.y + target.height
            ) {
                target.health -= 20;
                bullets.splice(index, 1);


                if (target.health <= 0) {
                    target.alive = false;
                }
            }
        });
    }


    // DRAW FUNCTIONS
    function drawPlayer() {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);


        // Player body (replace this with sprite)
        ctx.beginPath();
        ctx.arc(0, 0, player.radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();


        // Direction indicator
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(player.radius + 15, 0);
        ctx.strokeStyle = 'black';
        ctx.stroke();


        ctx.restore();
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
        ctx.font = '16px Arial';
        ctx.fillText("HP: " + target.health, target.x, target.y - 5);
    }


    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);


        drawPlayer();
        drawBullets();
        drawTarget();
    }


    // GAME LOOP
    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }


    loop();
});
