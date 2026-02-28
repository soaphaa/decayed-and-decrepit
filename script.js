// simple 2D top-down movement demo
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// player blob configuration
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 20,
    color: 'rgba(200,50,50,0.8)',
    speed: 3
};

// keyboard state
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    a: false,
    s: false,
    d: false
};

// input handlers
window.addEventListener('keydown', (e) => {
    if (e.key in keys) {
        keys[e.key] = true;
        e.preventDefault();
    }
});
window.addEventListener('keyup', (e) => {
    if (e.key in keys) {
        keys[e.key] = false;
        e.preventDefault();
    }
});

// update player position based on keys
function update() {
    let dx = 0;
    let dy = 0;
    if (keys.ArrowUp || keys.w) dy -= player.speed;
    if (keys.ArrowDown || keys.s) dy += player.speed;
    if (keys.ArrowLeft || keys.a) dx -= player.speed;
    if (keys.ArrowRight || keys.d) dx += player.speed;

    // normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.sqrt(2);
        dx *= inv;
        dy *= inv;
    }

    player.x += dx;
    player.y += dy;

    // keep inside canvas bounds
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
}

// render loop
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // draw player blob (circle)
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// start
loop();
