// index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const socketIo = require("socket.io");
const path = require("path");

const app = express();

// Helper: normalize origin (remove trailing slash)
const normalize = (u) => (u ? u.replace(/\/+$/, "") : u);

// Build allowed origins list
const envClient = normalize(process.env.CLIENT_URL);
const defaultLocal = "http://localhost:3000";
const vercelExample = "https://chat-alpha-kohl.vercel.app/"; // add your Vercel URL if needed

const allowedOrigins = [
  envClient,
  defaultLocal,
  "http://127.0.0.1:3000",
  vercelExample,
].filter(Boolean); // remove falsy values

// CORS options with whitelist check
const corsOptions = {
  origin: function (origin, callback) {
    // If no origin (curl, Postman, server-to-server), allow it
    if (!origin) return callback(null, true);

    const normOrigin = normalize(origin);

    if (allowedOrigins.indexOf(normOrigin) !== -1) {
      return callback(null, true);
    } else {
      // Provide a descriptive error for easier debugging
      const msg = `CORS Error: Origin ${normOrigin} not allowed`;
      return callback(new Error(msg), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Use CORS middleware
app.use(cors(corsOptions));

// Explicitly handle preflight for all routes (safe)
app.options("*", cors(corsOptions));

// JSON body parsing
app.use(express.json());

// Optional: give a friendly response when CORS blocks a request
// (Express error handler must be defined after routes/middlewares)
app.use((err, req, res, next) => {
  if (err && err.message && err.message.startsWith("CORS Error")) {
    return res.status(403).json({ error: err.message });
  }
  // default error handler
  next(err);
});

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

// === Routes ===
app.get("/ping", (_req, res) => {
  return res.json({ msg: "Ping Successful" });
});

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Start server
const server = app.listen(PORT, () => console.log("Server started on", PORT));

// Socket.IO with matching CORS config
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

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
