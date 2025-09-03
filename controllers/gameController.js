const words = ["cat", "apple", "car", "house", "tree", "dog", "phone", "book"];
let players = [];
let currentTurnIndex = 0;
let currentWord = "";
let roomName = "default";

function startRound(io, room) {
  if (players.length === 0) return;

  const drawer = players[currentTurnIndex];
  currentWord = words[Math.floor(Math.random() * words.length)];
  roomName = room;

  // Send word to drawer
  io.to(drawer.id).emit("round:start", { word: currentWord, isDrawer: true });

  // Hidden word for others
  const hiddenWord = "_ ".repeat(currentWord.length);
  players.forEach((p) => {
    if (p.id !== drawer.id) {
      io.to(p.id).emit("round:start", { word: hiddenWord.trim(), isDrawer: false });
    }
  });

  io.to(room).emit("system", `${drawer.name} is drawing...`);
}

// Called when a player sends a guess
function checkGuess(io, socket, guess) {
  if (guess.toLowerCase() === currentWord.toLowerCase()) {
    const player = players.find(p => p.id === socket.id);
    io.to(roomName).emit("system", `✅ ${player.name} guessed correctly!`);
    nextTurn(io, roomName);
  }
}

function addPlayer(socket, name, room, io) {
  players.push({ id: socket.id, name, room });
  socket.data.name = name;
  socket.data.room = room;
  socket.join(room);
  io.to(room).emit("system", `${name} joined the game`);
  io.to(room).emit("players:update", players);
}

function removePlayer(socket, io) {
  const player = players.find((p) => p.id === socket.id);
  if (!player) return;

  players = players.filter((p) => p.id !== socket.id);
  io.to(player.room).emit("system", `${player.name} left`);
  io.to(player.room).emit("players:update", players);
}

function nextTurn(io, room) {
  currentTurnIndex = (currentTurnIndex + 1) % players.length;
  setTimeout(() => startRound(io, room), 1000);
}

module.exports = { addPlayer, removePlayer, startRound, nextTurn, checkGuess };
