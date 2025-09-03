function handleDrawing(socket, io) {
  socket.on("drawing", (data) => {
    const room = socket.data.room;
    if (!room) return;

    // Broadcast to everyone except drawer
    socket.broadcast.to(room).emit("drawing", data);
  });
}

module.exports = handleDrawing;
