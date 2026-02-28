// center circle controlled by WASD/arrow keys
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const player = { x: canvas.width / 2, y: canvas.height / 2, radius: 20, speed: 3 };
    const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };

    window.addEventListener('keydown', e => {
        if (e.key in keys) {
            keys[e.key] = true;
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', e => {
        if (e.key in keys) {
            keys[e.key] = false;
            e.preventDefault();
        }
    });

    function update() {
        let dx = 0, dy = 0;
        if (keys.w || keys.ArrowUp) dy -= player.speed;
        if (keys.s || keys.ArrowDown) dy += player.speed;
        if (keys.a || keys.ArrowLeft) dx -= player.speed;
        if (keys.d || keys.ArrowRight) dx += player.speed;
        if (dx && dy) {
            const inv = 1 / Math.sqrt(2);
            dx *= inv; dy *= inv;
        }
        player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x + dx));
        player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y + dy));
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
    }

    (function loop() { update(); draw(); requestAnimationFrame(loop); })();
});


