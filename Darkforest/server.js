const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.NODE_ENV === "production"
  ? process.env.CLIENT_URL
  : "http://localhost:3000";

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

app.use(express.static(path.join(__dirname, "public")));

const players = {};
const width = 1280;
const height = 720;

let bullets = [];
const bulletSize = 2;
const bulletSpeed = 100;
let nextBulletId = 0;
let queue = [];
const rooms = {};

let onlineCount = 0;

io.on("connection", (socket) => {
  onlineCount += 1;
  console.log("a user connected:", socket.id);
  socket.emit("count", onlineCount);

  socket.on("joinQueue", () => {
    if (!queue.includes(socket.id)) queue.push(socket.id);

    if (queue.length >= 2) {
      const player1 = queue.shift();
      const player2 = queue.shift();

      const roomId = `room-${player1}-${player2}`;
      const s1 = io.sockets.sockets.get(player1);
      const s2 = io.sockets.sockets.get(player2);

      s1.join(roomId);
      s2.join(roomId);

      s1.data.roomId = roomId;
      s2.data.roomId = roomId;

      rooms[roomId] = {
        players: {
          [player1]: {
            x: Math.random() * width,
            y: Math.random() * height,
            mouseX: 0,
            mouseY: 0,
            color: "blue",
            radius: 15,
            speed: 4,
            vision: 100,
            flashlightArc: Math.PI * 0.1,
            flashlightOn: false,
            alive: true
          },
          [player2]: {
            x: Math.random() * width,
            y: Math.random() * height,
            mouseX: 0,
            mouseY: 0,
            color: "red",
            radius: 15,
            speed: 4,
            vision: 100,
            flashlightArc: Math.PI * 0.1,
            flashlightOn: false,
            alive: true
          },
        },
        bullets: []
      };

      s1.emit("startGame", player1);
      s2.emit("startGame", player2);
      console.log(`Created ${roomId}`);
    }
  });

  socket.on("mousemove", (mouseX, mouseY) => {
    const player = rooms[socket.data.roomId]?.players[socket.id];
    if (!player) return;
    player.mouseX = mouseX;
    player.mouseY = mouseY;
  });

  socket.on("input", keys => {
    const roomId = socket.data.roomId;
    const player = rooms[roomId]?.players[socket.id];
    if (!player) return;

    const speed = player.speed;
    if (keys["w"]) player.y -= speed;
    if (keys["s"]) player.y += speed;
    if (keys["a"]) player.x -= speed;
    if (keys["d"]) player.x += speed;
    player.flashlightOn = keys[' '];

    const radius = player.radius;
    player.x = Math.max(radius, Math.min(width-radius, player.x));
    player.y = Math.max(radius, Math.min(height-radius, player.y));
  });

  socket.on("fire", () => {
    const roomId = socket.data.roomId;
    const player = rooms[roomId]?.players[socket.id];
    if (!player) return;

    const dx = player.mouseX - player.x;
    const dy = player.mouseY - player.y;
    const dist = Math.hypot(dx, dy);
    const f = bulletSpeed / dist;

    rooms[roomId].bullets.push({
      id: nextBulletId++,
      x: player.x,
      y: player.y,
      radius: bulletSize,
      speedX: dx * f,
      speedY: dy * f,
      owner: socket.id
    });
  });

  socket.on("disconnect", () => {
    onlineCount -= 1;
    console.log("user disconnected:", socket.id);
    io.emit("count", onlineCount);
    queue = queue.filter(id => id !== socket.id);
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const player = rooms[roomId]?.players[socket.id];
    if (!player) return;

    player.alive = false;
  });

  socket.on("gameOver", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (!rooms[roomId]) return;
    delete rooms[roomId];
  });
});

function updateRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.bullets = room.bullets.filter(b => {
    if (b.x < 0 || b.x > width || b.y < 0 || b.y > height) return false;

    const speed = Math.hypot(b.speedX, b.speedY);
    const steps = Math.ceil(speed / b.radius);

    for (let i = 0; i < steps; i++) {
      b.x += b.speedX / steps;
      b.y += b.speedY / steps;

      for (const id in room.players) {
        if (id === b.owner) continue;

        const p = room.players[id]
        if (!p.alive) continue;

        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const r = p.radius + b.radius;

        if (dx*dx + dy*dy < r*r) {
          p.alive = false;
          return false; // remove bullet (hopefully)
        }
      }
    }
    return true;
  });

  io.to(roomId).emit("state", {
    players: rooms[roomId].players,
    bullets: rooms[roomId].bullets
  });
}

setInterval(() => {
  for (const roomId in rooms) {
    updateRoom(roomId);
  }
}, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});