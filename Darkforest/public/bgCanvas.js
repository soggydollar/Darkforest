const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');

let bgWidth = bgCanvas.width = window.innerWidth;
let bgHeight = bgCanvas.height = window.innerHeight;

window.addEventListener('load', () => {
  bgCanvas.style.opacity = 1;
});

const particles = [];
const particleCount = 50;
const maxDistance = 120;

for (let i = 0; i < particleCount; i++) {
  particles.push({
    x: Math.random() * bgWidth,
    y: Math.random() * bgHeight,
    radius: Math.random() * 3 + 1,
    speedX: (Math.random() - 0.5) * 1,
    speedY: (Math.random() - 0.5) * 1
  });
}

// Animation loop
function bgAnimate() {
  bgCtx.clearRect(0, 0, bgWidth, bgHeight);

  // Draw particles
  bgCtx.fillStyle = 'white';
  particles.forEach(p => {
    bgCtx.beginPath();
    bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    bgCtx.fill();

    p.x += p.speedX;
    p.y += p.speedY;

    if (p.x < 0 || p.x > bgWidth) p.speedX *= -1;
    if (p.y < 0 || p.y > bgHeight) p.speedY *= -1;
  });

  bgCtx.strokeStyle = 'rgba(255,255,255,0.2)'; // faint white
  bgCtx.lineWidth = 1;

  for (let i = 0; i < particleCount; i++) {
    for (let j = i + 1; j < particleCount; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < maxDistance) {
        bgCtx.beginPath();
        bgCtx.moveTo(particles[i].x, particles[i].y);
        bgCtx.lineTo(particles[j].x, particles[j].y);
        bgCtx.stroke();
      }
    }
  }

  requestAnimationFrame(bgAnimate);
}

bgAnimate();

// Resize canvas on window resize
window.addEventListener('resize', () => {
  bgWidth = bgCanvas.width = window.innerWidth;
  bgHeight = bgCanvas.height = window.innerHeight;
});