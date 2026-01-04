const socket = io();

const playBtn = document.getElementById('playBtn');
const home = document.getElementById('home');

const gameContainer = document.getElementById('gameContainer');

const playAgainBtn = document.getElementById('playAgainBtn');
const result = document.getElementById('result');
const resultMsg = document.getElementById('result-msg');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const width = 1280;
const height = 720;
const gridSize = 40;

canvas.width = width;
canvas.height = height;

function resize() {
  const scale = Math.min(
    window.innerWidth / width,
    window.innerHeight / height
  );

  canvas.style.width = width * scale + "px";
  canvas.style.height = height * scale + "px";
}

window.addEventListener("resize", resize);
resize();

let playerId;
let gameInProgress = false;

playBtn.addEventListener('click', () => {
  socket.emit('joinQueue');
  playBtn.textContent = 'Waiting for game...';
});

playAgainBtn.addEventListener('click', () => {
  socket.emit('joinQueue');
  playAgainBtn.textContent = 'Waiting for game...';
});

socket.on('startGame', (id) => {
  home.style.display = 'none';
  result.style.display = 'none';
  playAgainBtn.textContent = 'Play Again'
  gameContainer.style.display = 'block';
  playerId = id;

  if (!gameInProgress) {
    gameInProgress = true;
    startGame();
  }
});

function startGame() {
    const keys = {};
    window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
    window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

    let players = {};
    let bullets = [];
    let renderBullets = [];
    let renderPlayers = {};

    socket.on("state", state => {
      players = state.players;
      bullets = state.bullets;

      renderBullets = renderBullets.filter(rb =>
        bullets.some(b => b.id === rb.id)
      );

      // Add new bullets
      bullets.forEach(b => {
        if (!renderBullets.find(rb => rb.id === b.id)) {
          renderBullets.push({ ...b });
        }
      });
    });

    let lastFireTime = 0;
    const fireRate = 2500;

    let mouseX = 0;
    let mouseY = 0;

    let scaleX = 1;
    let scaleY = 1;
    let offsetX = 0;
    let offsetY = 0;

    function updateCanvasTransform() {
      const rect = canvas.getBoundingClientRect();
      scaleX = canvas.width / rect.width;
      scaleY = canvas.height / rect.height;
      offsetX = rect.left;
      offsetY = rect.top;
    }

    updateCanvasTransform();
    window.addEventListener("resize", updateCanvasTransform);

    document.addEventListener('mousemove', e => {
      mouseX = (e.clientX - offsetX) * scaleX;
      mouseY = (e.clientY - offsetY) * scaleY;
      socket.emit("mousemove", mouseX, mouseY);
    });

    canvas.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - lastFireTime >= fireRate) {
        socket.emit("fire");
        lastFireTime = now;
      }
    });

    function drawGrid() {
      ctx.strokeStyle = 'darkgray';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x=0; x<=width; x+=gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y=0; y<=height; y+=gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function drawBullets() {
      ctx.fillStyle = 'white';
      renderBullets.forEach(rb => {
        const serverBullet = bullets.find(b => b.id === rb.id);
        if (!serverBullet) return;

        rb.x = lerp(rb.x, serverBullet.x, 0.6);
        rb.y = lerp(rb.y, serverBullet.y, 0.6);

        drawObj(rb);
      });
    }


    function drawPlayer(player) {
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
    }

    function drawObj(obj) {
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const reloadBarHeight = 10;
    const reloadBarWidth = 50;
    const gap = 8;
    function reloadBar(percent) {
      if (!renderPlayers[playerId]) return;
      const player = renderPlayers[playerId]
      ctx.strokeStyle = "#636363";
      ctx.lineWidth = 3;
      const x = player.x-reloadBarWidth/2;
      const y =  player.y-player.radius-reloadBarHeight-gap;
      ctx.strokeRect(x, y, reloadBarWidth, reloadBarHeight);
      ctx.fillStyle = "white";
      ctx.fillRect(x, y, percent*reloadBarWidth, reloadBarHeight);
    }

    function playerVision(p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.vision, 0, Math.PI * 2);
      ctx.fill();
    }

    function flashlight(p) {
      const angle = Math.atan2(p.mouseY - p.y, p.mouseX - p.x);
      const start = angle - p.flashlightArc / 2;
      const end = angle + p.flashlightArc / 2;

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, 1500, start, end);
      ctx.closePath();
      ctx.fill();
    }

    function animate() {
      if (!gameInProgress) {
        result.style.display = 'flex';
        resultMsg.textContent = players[playerId].alive ? "You win!" : "You lose!";
        socket.emit("gameOver");
        return;
      }

      requestAnimationFrame(animate);
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = 'grey';
      for (const id in players) {
        if (players[id].flashlightOn && renderPlayers[id]) {
          flashlight(renderPlayers[id]);
        }
      }

      if (renderPlayers[playerId]) {
        playerVision(renderPlayers[playerId]);
      }

      ctx.globalCompositeOperation = 'source-atop';

      drawGrid();
      for (const id in players) {
        if (!players[id].alive) {
          gameInProgress = false;
          continue;
        }
        if (!renderPlayers[id]) {
          renderPlayers[id] = { ...players[id] };
        }

        renderPlayers[id].x = lerp(renderPlayers[id].x, players[id].x, 0.2);
        renderPlayers[id].y = lerp(renderPlayers[id].y, players[id].y, 0.2);
        renderPlayers[id].mouseX = lerp(renderPlayers[id].mouseX, players[id].mouseX, 0.4);
        renderPlayers[id].mouseY = lerp(renderPlayers[id].mouseY, players[id].mouseY, 0.4);

        drawPlayer(renderPlayers[id]);
      }

      drawBullets();
      const elapsed = Date.now() - lastFireTime;
      if (elapsed < fireRate) reloadBar(elapsed/fireRate);
      ctx.globalCompositeOperation = 'source-over';
      socket.emit("input", keys);
    }

    animate();
}