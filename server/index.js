const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { randomUUID } = require("crypto");


const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../client")));

const rooms = {};

/* =========================
   HELPERS
========================= */

function emitRoomsList() {
  const list = Object.values(rooms).map(r => ({
    id: r.id,          // 🔴 SI ESTO NO VA, NO HAY JOIN
    name: r.name,
    players: r.players.length,
    hasPassword: !!r.password
  }));

  console.log("📤 ROOMS_LIST:", list); // 👈 DEBUG REAL
  io.emit("rooms_list", list);
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
  if (!socket.data.name) return;
  if (!room) return;

const roomId = randomUUID();

rooms[roomId] = {
  id: roomId,        // 🔴 SIN ESTO NO FUNCIONA
  name: room,
  players: [],
  hostId: socket.id,
  password: password || null
};


  joinRoom(socket, roomId);
});



  /* ---- UNIRSE ---- */
socket.on("join_room", ({ roomId, password }) => {
  console.log("JOIN_ROOM recibido:", roomId, password); // 🔥 DEBUG

  if (!socket.data.name) return;
  if (!rooms[roomId]) {
    console.log("❌ Sala no existe:", roomId);
    return;
  }

  const room = rooms[roomId];

  if (room.password && room.password !== password) {
    socket.emit("join_error", "Contraseña incorrecta");
    return;
  }

  joinRoom(socket, roomId);
});




/* =========================
   START GAME  ✅ AQUÍ
========================= */
socket.on("start_game", () => {
  const roomName = socket.data.roomId;
  if (!roomName || !rooms[roomName]) return;

  const room = rooms[roomName];

  // Solo el host puede iniciar
  if (room.hostId !== socket.id) return;

  io.to(roomName).emit("pre_countdown", { seconds: 5 });

  setTimeout(() => {
    const impostor =
      room.players[Math.floor(Math.random() * room.players.length)];

    const word = "Manzana";

    room.players.forEach(p => {
      io.to(p.id).emit("reveal_role", {
        role: p.id === impostor.id ? "impostor" : "player",
        word
      });
    });

    const starter =
      room.players[Math.floor(Math.random() * room.players.length)];

    io.to(roomName).emit("starter_selected", {
      name: starter.name,
      hostId: room.hostId
    });
  }, 5000);
});

socket.on("new_round", () => {
  const roomName = socket.data.roomId;
  if (!roomName || !rooms[roomName]) return;

  const room = rooms[roomName];
  if (room.hostId !== socket.id) return;

  io.to(roomName).emit("pre_countdown", { seconds: 5 });

  setTimeout(() => {
    const impostor =
      room.players[Math.floor(Math.random() * room.players.length)];

    const word = "Manzana"; // luego lo harás dinámico

    room.players.forEach(p => {
      io.to(p.id).emit("reveal_role", {
        role: p.id === impostor.id ? "impostor" : "player",
        word
      });
    });

    const starter =
      room.players[Math.floor(Math.random() * room.players.length)];

    io.to(roomName).emit("starter_selected", {
      name: starter.name,
      hostId: room.hostId
    });
  }, 5000);
});

socket.on("end_game", () => {
  const roomId = socket.data.roomId;
  if (!roomId || !rooms[roomId]) return;

  const room = rooms[roomId];
  if (room.hostId !== socket.id) return;

  // avisar a todos
  io.to(roomId).emit("room_closed");

  // sacar a todos del room
  const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
  if (socketsInRoom) {
    for (const sid of socketsInRoom) {
      const s = io.sockets.sockets.get(sid);
      if (s) {
        s.leave(roomId);
        s.data.roomId = null;
      }
    }
  }

  delete rooms[roomId];
  emitRoomsList();
});





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
    const roomName = socket.data.roomId;
    if (!roomName || !rooms[roomName]) return;

    const room = rooms[roomName];

    // 🔴 SI SALE EL HOST → SE CIERRA LA SALA
if (room.hostId === socket.id) {
  io.to(roomName).emit("room_closed");

  // 🔥 LIMPIAR SOCKET.IO ROOM
  const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
  if (socketsInRoom) {
    for (const socketId of socketsInRoom) {
      const s = io.sockets.sockets.get(socketId);
      if (s) {
        s.leave(roomName);
        s.data.room = null; // 🔥 CLAVE
      }
    }
  }

  delete rooms[roomName];
  emitRoomsList();
  return;
}



    // Si no es host, simplemente se va
    room.players = room.players.filter(p => p.id !== socket.id);
    socket.leave(roomName);
    socket.data.roomId = null;

    emitRoomState(roomName);
    emitRoomsList();
  });

  /* ---- DESCONECTAR ---- */
  socket.on("disconnect", () => {
    const roomName = socket.data.roomId;
    if (!roomName || !rooms[roomName]) return;

    const room = rooms[roomName];

    // 🔴 SI SE DESCONECTA EL HOST → SE CIERRA LA SALA
if (room.hostId === socket.id) {
  io.to(roomName).emit("room_closed");

  // 🔥 LIMPIAR SOCKET.IO ROOM
  const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
  if (socketsInRoom) {
    for (const socketId of socketsInRoom) {
      const s = io.sockets.sockets.get(socketId);
      if (s) {
        s.leave(roomName);
        s.data.room = null; // 🔥 CLAVE
      }
    }
  }

  delete rooms[roomName];
  emitRoomsList();
  return;
}



    room.players = room.players.filter(p => p.id !== socket.id);
    emitRoomState(roomName);
    emitRoomsList();
  });
});

server.listen(3000, () => {
  console.log("🚀 Servidor en http://localhost:3000");
});
