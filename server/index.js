const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ⬇️ SERVIR FRONTEND
app.use(express.static(path.join(__dirname, "../client")));

io.on("connection", (socket) => {
  console.log("Jugador conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("Jugador desconectado:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Servidor escuchando en http://localhost:3000");
});
