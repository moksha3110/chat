
require("dotenv").config();              
const express = require("express");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const socket = require("socket.io");

const app = express();

const cors = require('cors');
app.use(cors({
  origin: [process.env.CLIENT_URL || "http://localhost:3000"],
  credentials: true
}));

app.use(express.json());


const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/chat";
const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("DB Connection Successful:", MONGO_URL);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message || err);
  });

app.get("/ping", (_req, res) => {
  return res.json({ msg: "Ping Successful" });
});

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

const server = app.listen(PORT, () => console.log('Server started', PORT));
const io = require('socket.io')(server, { cors: { origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }});


global.onlineUsers = new Map();
io.on("connection", (socket) => {
  global.chatSocket = socket;
  socket.on("add-user", (userId) => {
    onlineUsers.set(userId, socket.id);
  });

  socket.on("send-msg", (data) => {
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("msg-recieve", data.msg);
    }
  });
});
