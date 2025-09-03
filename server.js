const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const handleChat = require("./controllers/chatController");
const handleDrawing = require("./controllers/drawingController");
const gameController = require("./controllers/gameController");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Track VC users
const vcUsers = new Map(); // socket.id -> username

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Set username
  socket.on("set username", ({ name, room }) => {
    gameController.addPlayer(socket, name, room || "default", io);
  });

  // Start game
  socket.on("start game", () => {
    const room = socket.data.room;
    gameController.startRound(io, room);
  });

  // Correct guess
  socket.on("correct guess", ({ username }) => {
    const room = socket.data.room;
    io.to(room).emit("system", `${username} guessed correctly!`);
    gameController.nextTurn(room, io);
  });

  // Handle chat
  socket.on("chat message", ({ username, msg }) => {
    const room = socket.data.room;
    io.to(room).emit("chat message", { username, msg });
    gameController.checkGuess(io, socket, msg);
  });

  // Handle drawing
  handleDrawing(socket, io);

  // ------------------- Voice Chat Signaling -------------------
  socket.on("join vc", ({ username }) => {
    vcUsers.set(socket.id, username);

    // Tell others to connect with new peer
    socket.broadcast.emit("new peer", socket.id);

    // Update VC user list for everyone
    io.emit("vc:update", Array.from(vcUsers.values()));
  });

  socket.on("leave vc", () => {
    vcUsers.delete(socket.id);
    io.emit("vc:update", Array.from(vcUsers.values()));
  });

  // WebRTC signaling
  socket.on("offer", ({ offer, to }) => {
    io.to(to).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ answer, to }) => {
    io.to(to).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    io.to(to).emit("ice-candidate", { candidate, from: socket.id });
  });

  // Disconnect
  socket.on("disconnect", () => {
    vcUsers.delete(socket.id);
    io.emit("vc:update", Array.from(vcUsers.values()));
    gameController.removePlayer(socket, io);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));

