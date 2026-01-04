const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../client")));

/* =========================
   DATA
========================= */

const rooms = {};

const WORDS = [
  "Manzana","Playa","Avión","Pizza","Hospital","Escuela","Coche","Montaña","Teléfono","Supermercado",
  "Perro","Gato","Elefante","León","Delfín","Tigre","Pájaro","Caballo","Oso","Serpiente",
  "Cámara","Ordenador","Teclado","Ratón","Pantalla","Auriculares","Altavoz","Reloj","Mochila","Lámpara",
  "Cine","Teatro","Concierto","Museo","Biblioteca","Parque","Estadio","Discoteca","Restaurante","Cafetería",
  "Doctor","Profesor","Bombero","Policía","Cocinero","Ingeniero","Arquitecto","Mecánico","Pintor","Escritor",
  "Verano","Invierno","Otoño","Primavera","Tormenta","Lluvia","Nieve","Viento","Trueno","Arcoíris",
  "Fútbol","Baloncesto","Tenis","Natación","Ciclismo","Running","Escalada","Boxeo","Surf","Esquí",
  "Viaje","Maleta","Pasaporte","Hotel","Aeropuerto","Mapa","Brújula","Guía","Excursión","Aventura",
  "Amor","Amistad","Celos","Alegría","Tristeza","Miedo","Sorpresa","Orgullo","Vergüenza","Esperanza",
  "Película","Serie","Actor","Directora","Escena","Guion","Estreno","Trailer","Premio",
  "Pan","Queso","Hamburguesa","Pasta","Arroz","Ensalada","Helado","Chocolate","Galleta","Yogur",
  "Planeta","Estrella","Galaxia","Cohete","Astronauta","Satélite","Órbita","Gravedad","Universo","Meteorito"
];

const MIN_PLAYERS = 3;

/* =========================
   HELPERS
========================= */

function emitRoomsList() {
  io.emit(
    "rooms_list",
    Object.values(rooms).map(r => ({
      id: r.id,
      name: r.name,
      players: r.players.length,
      hasPassword: !!r.password
    }))
  );
}

function emitRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  io.to(roomId).emit("room_state", {
    roomId: room.id,
    roomName: room.name,
    players: room.players,
    hostId: room.hostId
  });
}

function pickRandomWord(room) {
  let word;
  do {
    word = WORDS[Math.floor(Math.random() * WORDS.length)];
  } while (word === room.currentWord && WORDS.length > 1);

  room.currentWord = word;
  return word;
}

function closeRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  io.to(roomId).emit("room_closed");

  const sockets = io.sockets.adapter.rooms.get(roomId);
  if (sockets) {
    for (const sid of sockets) {
      const s = io.sockets.sockets.get(sid);
      if (s) {
        s.leave(roomId);
        s.data.roomId = null;
      }
    }
  }

  delete rooms[roomId];
  emitRoomsList();
}

/* =========================
   SOCKET
========================= */

io.on("connection", socket => {
  console.log("🟢 Conectado:", socket.id);

  /* ---- LOGIN ---- */
  socket.on("set_name", name => {
    if (!name) return;
    socket.data.name = name;
    socket.emit("name_confirmed", name);
    emitRoomsList();
  });

  /* ---- CREAR SALA ---- */
  socket.on("create_room", ({ room, password }) => {
    if (!socket.data.name || !room) return;

    const roomId = randomUUID();

    rooms[roomId] = {
      id: roomId,
      name: room,
      players: [],
      hostId: socket.id,
      password: password || null,
      currentWord: null,
      round: 0
    };

    joinRoom(socket, roomId);
  });

  /* ---- UNIRSE ---- */
  socket.on("join_room", ({ roomId, password }) => {
    const room = rooms[roomId];
    if (!socket.data.name || !room) return;

    if (room.password && room.password !== password) {
      socket.emit("join_error", "Contraseña incorrecta");
      return;
    }

    joinRoom(socket, roomId);
  });

  /* ---- START GAME ---- */
  socket.on("start_game", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;

    if (room.players.length < MIN_PLAYERS) {
      socket.emit("join_error", `Mínimo ${MIN_PLAYERS} jugadores`);
      return;
    }

    room.round++;
    io.to(roomId).emit("pre_countdown", { seconds: 5 });

    setTimeout(() => {
      const impostor =
        room.players[Math.floor(Math.random() * room.players.length)];

      const word = pickRandomWord(room);

      room.players.forEach(p => {
        io.to(p.id).emit("reveal_role", {
          role: p.id === impostor.id ? "impostor" : "player",
          word
        });
      });

      const starter =
        room.players[Math.floor(Math.random() * room.players.length)];

      io.to(roomId).emit("starter_selected", {
        name: starter.name,
        hostId: room.hostId
      });
    }, 5000);
  });

  /* ---- NUEVA RONDA ---- */
  socket.on("new_round", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;

    room.round++;
    io.to(roomId).emit("pre_countdown", { seconds: 5 });

    setTimeout(() => {
      const impostor =
        room.players[Math.floor(Math.random() * room.players.length)];

      const word = pickRandomWord(room);

      room.players.forEach(p => {
        io.to(p.id).emit("reveal_role", {
          role: p.id === impostor.id ? "impostor" : "player",
          word
        });
      });

      const starter =
        room.players[Math.floor(Math.random() * room.players.length)];

      io.to(roomId).emit("starter_selected", {
        name: starter.name,
        hostId: room.hostId
      });
    }, 5000);
  });

  /* ---- TERMINAR PARTIDA ---- */
  socket.on("end_game", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;

    closeRoom(roomId);
  });

  /* ---- JOIN ROOM INTERNAL ---- */
  function joinRoom(socket, roomId) {
    const room = rooms[roomId];
    if (room.players.some(p => p.id === socket.id)) return;

    socket.join(roomId);
    socket.data.roomId = roomId;

    room.players.push({
      id: socket.id,
      name: socket.data.name
    });

    emitRoomState(roomId);
    emitRoomsList();
  }

  /* ---- SALIR ---- */
  socket.on("leave_room", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;

    if (room.hostId === socket.id) {
      closeRoom(roomId);
      return;
    }

    room.players = room.players.filter(p => p.id !== socket.id);
    socket.leave(roomId);
    socket.data.roomId = null;

    emitRoomState(roomId);
    emitRoomsList();
  });

  /* ---- DESCONECTAR ---- */
  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;

    if (room.hostId === socket.id) {
      closeRoom(roomId);
      return;
    }

    room.players = room.players.filter(p => p.id !== socket.id);
    emitRoomState(roomId);
    emitRoomsList();
  });
});

server.listen(3000, () => {
  console.log("🚀 Servidor en http://localhost:3000");
});
