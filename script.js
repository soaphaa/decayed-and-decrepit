const box = document.getElementById('box');
const button = document.getElementById('moveBtn');
let position = 0;

button.addEventListener('click', () => {
    position += 50;
    if (position > 300) position = 0;
    box.style.left = position + 'px';
});
