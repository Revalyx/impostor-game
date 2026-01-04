const socket = io("http://localhost:3000");

// =====================
// ELEMENTOS
// =====================
const loginDiv = document.getElementById("login");
const menuDiv = document.getElementById("menu");
const roomDiv = document.getElementById("room");
const gameDiv = document.getElementById("game");

const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("nameInput");
const playerNameSpan = document.getElementById("playerName");

const showCreateRoomBtn = document.getElementById("showCreateRoomBtn");
const createRoomForm = document.getElementById("createRoomForm");
const roomNameInput = document.getElementById("roomName");
const roomPasswordInput = document.getElementById("roomPassword");
const createRoomBtn = document.getElementById("createRoomBtn");

const roomsList = document.getElementById("roomsList");
const playersList = document.getElementById("playersList");

const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const startGameBtn = document.getElementById("startGameBtn");
const endGameBtn = document.getElementById("endGameBtn");

const roleText = document.getElementById("roleText");
const countdownText = document.getElementById("timerText");
const starterText = document.getElementById("starterText");

// =====================
// LOGIN
// =====================
joinBtn.onclick = () => {
  socket.emit("set_name", nameInput.value.trim());
};

socket.on("name_confirmed", (name) => {
  loginDiv.style.display = "none";
  menuDiv.style.display = "block";
  playerNameSpan.textContent = name;
});

// =====================
// LOBBY
// =====================
showCreateRoomBtn.onclick = () => {
  createRoomForm.style.display =
    createRoomForm.style.display === "none" ? "block" : "none";
};

createRoomBtn.onclick = () => {
  socket.emit("create_room", {
    room: roomNameInput.value,
    password: roomPasswordInput.value
  });
};

socket.on("rooms_list", rooms => {
  roomsList.innerHTML = "";
  rooms.forEach(r => {
    const li = document.createElement("li");
    li.textContent = `${r.name} (${r.players})`;
    li.onclick = () => {
      const pwd = prompt("Contraseña") || "";
      socket.emit("join_room", { room: r.name, password: pwd });
    };
    roomsList.appendChild(li);
  });
});

// =====================
// SALA
// =====================
socket.on("joined_room", ({ players, isHost }) => {
  menuDiv.style.display = "none";
  roomDiv.style.display = "block";
  gameDiv.style.display = "none";

  startGameBtn.style.display = isHost ? "block" : "none";
  endGameBtn.style.display = "none";

  renderPlayers(players);
});

socket.on("room_update", ({ players }) => renderPlayers(players));

leaveRoomBtn.onclick = () => socket.emit("leave_room");
startGameBtn.onclick = () => socket.emit("start_game");
endGameBtn.onclick = () => socket.emit("end_game");

function renderPlayers(players) {
  playersList.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name;
    playersList.appendChild(li);
  });
}

// =====================
// JUEGO
// =====================
socket.on("pre_countdown", ({ seconds }) => {
  roomDiv.style.display = "none";
  gameDiv.style.display = "block";

  roleText.textContent = "";
  starterText.textContent = "";

  let remaining = seconds;
  countdownText.textContent = `Verás la palabra en… ${remaining}`;

  const interval = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      countdownText.textContent = `Verás la palabra en… ${remaining}`;
    } else {
      countdownText.textContent = "";
      clearInterval(interval);
    }
  }, 1000);
});

socket.on("reveal_role", (data) => {
  roleText.textContent =
    data.role === "impostor"
      ? "ERES EL IMPOSTOR"
      : `PALABRA: ${data.word}`;
});

socket.on("starter_selected", ({ name }) => {
  starterText.textContent = `Empieza: ${name}`;
  endGameBtn.style.display = "block";
});

socket.on("game_ended", () => {
  gameDiv.style.display = "none";
  roomDiv.style.display = "block";
});
