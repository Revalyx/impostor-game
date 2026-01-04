const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Conectado al servidor con id:", socket.id);
});
