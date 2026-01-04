const socket = io("https://susgame.duckdns.org/");

let isHost = false;
let currentPlayersCount = 0;

// ================= VISTAS =================
const loginDiv = document.getElementById("login");
const menuDiv = document.getElementById("menu");
const roomDiv = document.getElementById("room");
const gameDiv = document.getElementById("game");

// ================= LOGIN =================
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const playerNameSpan = document.getElementById("playerName");

// ================= LOBBY =================
const roomsContainer = document.getElementById("roomsContainer");
const openCreateRoomModal = document.getElementById("openCreateRoomModal");
const closeCreateRoomModal = document.getElementById("closeCreateRoomModal");
const createRoomModal = document.getElementById("createRoomModal");
const roomNameInput = document.getElementById("roomName");
const roomPasswordInput = document.getElementById("roomPassword");
const createRoomBtn = document.getElementById("createRoomBtn");

// ================= SALA =================
const playersList = document.getElementById("playersList");
const startGameBtn = document.getElementById("startGameBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");

// ================= JUEGO =================
const cardReveal = document.getElementById("cardReveal");
const roleText = document.getElementById("roleText");
const timerText = document.getElementById("timerText");
const starterText = document.getElementById("starterText");
const hintText = document.getElementById("hintText");
const newRoundBtn = document.getElementById("newRoundBtn");
const endGameBtn = document.getElementById("endGameBtn");


// ================= LOGIN =================
joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return;
  socket.emit("set_name", name);
};

socket.on("name_confirmed", name => {
  loginDiv.style.display = "none";
  menuDiv.style.display = "block";
  playerNameSpan.textContent = name;
});


// ================= MODAL =================
openCreateRoomModal.onclick = () => {
  createRoomModal.style.display = "flex";
};

closeCreateRoomModal.onclick = () => {
  createRoomModal.style.display = "none";
};


// ================= CREAR SALA =================
createRoomBtn.onclick = () => {
  socket.emit("create_room", {
    room: roomNameInput.value.trim(),
    password: roomPasswordInput.value
  });

  roomNameInput.value = "";
  roomPasswordInput.value = "";
  createRoomModal.style.display = "none";
};


// ================= LISTA DE SALAS =================
socket.on("rooms_list", rooms => {
  roomsContainer.innerHTML = "";

  if (!rooms.length) {
    roomsContainer.innerHTML = "<p>No hay salas disponibles</p>";
    return;
  }

  rooms.forEach(room => {
    const card = document.createElement("div");
    card.className = "room-card";

    card.innerHTML = `
      <div class="room-title">🏠 ${room.name}</div>
      <div class="room-meta">
        👥 ${room.players} jugadores ${room.hasPassword ? "🔒" : ""}
      </div>
    `;

    card.onclick = () => {
      let password = "";
      if (room.hasPassword) {
        password = prompt("Contraseña de la sala");
        if (password === null) return;
      }

      socket.emit("join_room", {
        roomId: room.id,
        password
      });
    };

    roomsContainer.appendChild(card);
  });
});


// ================= ESTADO DE SALA =================
socket.on("room_state", data => {
  socket.currentRoomId = data.roomId;

  // 🔥 CLAVE ABSOLUTA: aquí se actualiza el host
  isHost = socket.id === data.hostId;

  menuDiv.style.display = "none";
  roomDiv.style.display = "block";
  gameDiv.style.display = "none";

  currentPlayersCount = data.players.length;
  renderPlayers(data.players);

  if (isHost) {
    startGameBtn.style.display = "block";

    if (currentPlayersCount < 3) {
      startGameBtn.disabled = true;
      startGameBtn.textContent = "Esperando jugadores… (mín. 3)";
    } else {
      startGameBtn.disabled = false;
      startGameBtn.textContent = "Iniciar partida";
    }
  } else {
    startGameBtn.style.display = "none";
  }
});


// ================= RENDER JUGADORES =================
function renderPlayers(players) {
  playersList.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name;
    playersList.appendChild(li);
  });
}


// ================= SALIR DE SALA =================
leaveRoomBtn.onclick = () => {
  socket.emit("leave_room");

  roomDiv.style.display = "none";
  gameDiv.style.display = "none";
  menuDiv.style.display = "block";

  playersList.innerHTML = "";
};


// ================= INICIAR PARTIDA =================
startGameBtn.onclick = () => {
  if (!isHost) return;

  if (currentPlayersCount < 3) {
    alert("Se necesitan al menos 3 jugadores para empezar.");
    return;
  }

  socket.emit("start_game");
};


// ================= JUEGO =================
socket.on("pre_countdown", ({ seconds }) => {
  roomDiv.style.display = "none";
  gameDiv.style.display = "block";

  cardReveal.classList.remove("flipped");
  roleText.textContent = "";
  hintText.textContent = "";
  starterText.textContent = "";

  let s = seconds;
  timerText.textContent = `Verás la palabra en… ${s}`;

  const i = setInterval(() => {
    s--;
    if (s > 0) {
      timerText.textContent = `Verás la palabra en… ${s}`;
    } else {
      timerText.textContent = "";
      clearInterval(i);
    }
  }, 1000);
});

socket.on("reveal_role", data => {
  roleText.textContent =
    data.role === "impostor"
      ? "ERES EL IMPOSTOR"
      : data.word;

  hintText.textContent =
    data.role === "impostor"
      ? "Improvisa sin que te pillen 😏"
      : "Describe la palabra sin decirla";

  setTimeout(() => {
    cardReveal.classList.add("flipped");
  }, 300);
});

socket.on("starter_selected", ({ name, hostId }) => {
  starterText.textContent = `Empieza: ${name}`;

  const amIHost = socket.id === hostId;
  newRoundBtn.style.display = amIHost ? "block" : "none";
  endGameBtn.style.display = amIHost ? "block" : "none";
});


// ================= NUEVA RONDA / FIN =================
newRoundBtn.onclick = () => socket.emit("new_round");
endGameBtn.onclick = () => socket.emit("end_game");

socket.on("game_ended", () => {
  gameDiv.style.display = "none";
  roomDiv.style.display = "block";

  newRoundBtn.style.display = "none";
  endGameBtn.style.display = "none";
});

socket.on("room_closed", () => {
  gameDiv.style.display = "none";
  roomDiv.style.display = "none";
  menuDiv.style.display = "block";

  playersList.innerHTML = "";
  startGameBtn.style.display = "none";
  newRoundBtn.style.display = "none";
  endGameBtn.style.display = "none";
});
