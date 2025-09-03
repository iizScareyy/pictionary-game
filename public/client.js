const socket = io();
let username = "";
let isDrawer = false;
let currentWord = "";

// Join game
function joinGame() {
  username = document.getElementById("usernameInput").value.trim();
  if (!username) return alert("Enter username first!");
  socket.emit("set username", { name: username, room: "default" });
  document.getElementById("joinScreen").style.display = "none";
  document.getElementById("gameScreen").style.display = "block";
}

// Start game
function startGame() {
  socket.emit("start game");
  document.getElementById("startBtn").style.display = "none";
}

// Chat
function sendMessage() {
  const msg = document.getElementById("chatInput").value.trim();
  if (!msg) return;
  socket.emit("chat message", { username, msg });
  document.getElementById("chatInput").value = "";
}

// Display chat messages
socket.on("chat message", (data) => {
  addMessage(`${data.username}: ${data.msg}`);

  if (!isDrawer && data.msg.toLowerCase() === currentWord.toLowerCase()) {
    addMessage(`✅ ${data.username} guessed correctly!`);
    socket.emit("correct guess", { username: data.username });
  }
});

// System messages
socket.on("system", (msg) => addMessage(msg));

// Helper
function addMessage(text) {
  const li = document.createElement("li");
  li.textContent = text;
  const messages = document.getElementById("messages");
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

// Drawing
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
let drawing = false;

canvas.addEventListener("mousedown", () => { if (isDrawer) drawing = true; });
canvas.addEventListener("mouseup", () => drawing = false);
canvas.addEventListener("mouseleave", () => drawing = false);
canvas.addEventListener("mousemove", draw);

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
}, { passive: false });

function draw(e) {
  if (!drawing || !isDrawer) return;
  const x = e.offsetX;
  const y = e.offsetY;
  ctx.fillRect(x, y, 2, 2);
  socket.emit("drawing", { x, y });
}

// Receive drawing
socket.on("drawing", (data) => {
  ctx.fillRect(data.x, data.y, 2, 2);
});

// Round start
socket.on("round:start", (data) => {
  isDrawer = data.isDrawer;
  currentWord = data.word;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const wordElement = document.getElementById("currentWord");
  if (isDrawer) {
    document.getElementById("welcomeMsg").textContent = "Your turn! Draw:";
    wordElement.textContent = currentWord; // drawer sees real word
  } else {
    document.getElementById("welcomeMsg").textContent = "Guess the word:";
    wordElement.textContent = data.word; // guessers see underscores
  }
});

// ------------------- Voice Chat -------------------
let localStream;
let peers = {};
let inVC = false;

async function joinVoiceChat() {
  if (inVC) return;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    inVC = true;

    socket.emit("join vc", { username });

    socket.on("new peer", async (peerId) => {
      if (peers[peerId]) return;
      const pc = new RTCPeerConnection();
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      pc.ontrack = (event) => {
        const audioEl = document.createElement("audio");
        audioEl.srcObject = event.streams[0];
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { candidate: event.candidate, to: peerId });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { offer, to: peerId });
      peers[peerId] = pc;
    });
  } catch (err) {
    console.error("Error accessing mic:", err);
    alert("Could not access microphone.");
  }
}

function leaveVoiceChat() {
  if (!inVC) return;
  inVC = false;
  Object.values(peers).forEach(pc => pc.close());
  peers = {};
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  socket.emit("leave vc", { username });
}

function toggleMute() {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
  updateVCPlayers();
}

// VC players update
socket.on("vc:update", (players) => {
  const tbody = document.getElementById("vcPlayers");
  if (!tbody) return;
  tbody.innerHTML = "";
  players.forEach(p => {
    const row = document.createElement("tr");
    const status = (p === username && localStream && !localStream.getAudioTracks()[0].enabled)
      ? "Muted" : "Connected";
    row.innerHTML = `<td>${p}${p === username ? " (You)" : ""}</td><td>${status}</td>`;
    tbody.appendChild(row);
  });
});

function updateVCPlayers() {
  socket.emit("join vc", { username });
}

// Signaling
socket.on("offer", async ({ offer, from }) => {
  const pc = new RTCPeerConnection();
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    const audioEl = document.createElement("audio");
    audioEl.srcObject = event.streams[0];
    audioEl.autoplay = true;
    document.body.appendChild(audioEl);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) socket.emit("ice-candidate", { candidate: event.candidate, to: from });
  };

  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { answer, to: from });
  peers[from] = pc;
});

socket.on("answer", async ({ answer, from }) => {
  const pc = peers[from];
  await pc.setRemoteDescription(answer);
});

socket.on("ice-candidate", async ({ candidate, from }) => {
  const pc = peers[from];
  if (pc) await pc.addIceCandidate(candidate);
});
