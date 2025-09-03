function handleChat(socket, io) {
  socket.on("chat message", ({ username, msg }) => {
    const room = socket.data.room;
    if (!room) return;
    io.to(room).emit("chat message", { username, msg });
  });
}

module.exports = handleChat;
