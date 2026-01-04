const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// =====================
// CONFIG
// =====================
const PREVIEW_COUNTDOWN = 5;
const WORDS = ["COCHE", "PLAYA", "GATO", "ORDENADOR", "PLÁTANO"];

// =====================
// ESTADO
// =====================
const rooms = {};
// room = {
//   name,
//   password,
//   hostId,
//   players: [{id, name}],
//   started,
//   impostorId,
//   word
// }

// =====================
app.use(express.static(path.join(__dirname, "../client")));

// =====================
// SOCKETS
// =====================
io.on("connection", (socket) => {

  socket.on("set_name", (name) => {
    socket.data.name = name;
    socket.data.room = null;
    socket.emit("name_confirmed", name);
    sendRoomsList();
  });

  socket.on("create_room", ({ room, password }) => {
    if (!room || rooms[room]) return;

    rooms[room] = {
      name: room,
      password,
      hostId: socket.id,
      players: [],
      started: false
    };

    sendRoomsList();
  });

  socket.on("join_room", ({ room, password }) => {
    const r = rooms[room];
    if (!r || r.started) return;
    if (r.password !== password) return;

    if (socket.data.room) leaveRoom(socket);

    socket.join(room);
    socket.data.room = room;

    if (!r.players.find(p => p.id === socket.id)) {
      r.players.push({ id: socket.id, name: socket.data.name });
    }

    socket.emit("joined_room", {
      players: r.players,
      isHost: socket.id === r.hostId
    });

    io.to(room).emit("room_update", { players: r.players });
    sendRoomsList();
  });

  // =====================
  // START GAME
  // =====================
  socket.on("start_game", () => {
    const roomName = socket.data.room;
    const r = rooms[roomName];
    if (!r || socket.id !== r.hostId) return;
    if (r.players.length < 3) return;

    r.started = true;

    // Elegir impostor (aleatorio real)
    const impostor = getRandomPlayer(r.players);

    // Elegir jugador inicial (aleatorio real)
    const starter = getRandomPlayer(r.players);

    r.impostorId = impostor.id;
    r.word = WORDS[crypto.randomInt(0, WORDS.length)];

    // Pre-countdown
    io.to(roomName).emit("pre_countdown", {
      seconds: PREVIEW_COUNTDOWN
    });

    setTimeout(() => {
      // Enviar roles
      r.players.forEach(p => {
        if (p.id === r.impostorId) {
          io.to(p.id).emit("reveal_role", { role: "impostor" });
        } else {
          io.to(p.id).emit("reveal_role", {
            role: "player",
            word: r.word
          });
        }
      });

      // Enviar jugador inicial
      io.to(roomName).emit("starter_selected", {
        name: starter.name
      });

    }, PREVIEW_COUNTDOWN * 1000);
  });

  // =====================
  // END GAME
  // =====================
  socket.on("end_game", () => {
    const roomName = socket.data.room;
    const r = rooms[roomName];
    if (!r || socket.id !== r.hostId) return;

    r.started = false;
    io.to(roomName).emit("game_ended");
    sendRoomsList();
  });

  socket.on("leave_room", () => {
    leaveRoom(socket);
    sendRoomsList();
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);
    sendRoomsList();
  });
});

// =====================
// HELPERS
// =====================
function getRandomPlayer(players) {
  const index = crypto.randomInt(0, players.length);
  return players[index];
}

function leaveRoom(socket) {
  const roomName = socket.data.room;
  if (!roomName || !rooms[roomName]) return;

  const r = rooms[roomName];
  r.players = r.players.filter(p => p.id !== socket.id);
  socket.leave(roomName);
  socket.data.room = null;

  if (socket.id === r.hostId || r.players.length === 0) {
    delete rooms[roomName];
  }
}

function sendRoomsList() {
  io.emit(
    "rooms_list",
    Object.values(rooms).map(r => ({
      name: r.name,
      players: r.players.length,
      started: r.started
    }))
  );
}

server.listen(3000, "0.0.0.0");
