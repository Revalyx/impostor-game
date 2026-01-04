const socket = io("http://localhost:3000");

const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("nameInput");

const loginDiv = document.getElementById("login");
const welcomeDiv = document.getElementById("welcome");
const playerNameSpan = document.getElementById("playerName");

joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();

  if (!name) {
    alert("Introduce un nombre");
    return;
  }

  socket.emit("set_name", name);
});

socket.on("name_confirmed", (name) => {
  loginDiv.style.display = "none";
  welcomeDiv.style.display = "block";
  playerNameSpan.textContent = name;
});
