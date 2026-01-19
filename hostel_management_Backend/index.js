import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import routes from "./routes/indexRoute.js";
import dotenv from "dotenv";
import { db, connectDB } from "./config/Database.js";
import toobusy from "toobusy-js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import http from "http";
import { Server } from "socket.io";
import "./controllers/Dashboard/dashboardAllowedTimeCron.js";
dotenv.config();
const app = express();

// --- DATABASE ---
connectDB();

// --- CORS ---
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
app.use(
  cors({
    credentials: true,
    origin: allowedOrigin,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders:
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  })
);

// --- FILE PATHS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
global.__basedir = __dirname;
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- MIDDLEWARE ---
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
  if (toobusy()) {
    res.status(503).send("Server Too Busy");
  } else {
    next();
  }
});

// --- VIEWS ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- ROUTES ---
app.get("/api/isrunning", (req, res) => {
  return res.send({
    issuccess: true,
    message: `server is running successfully`,
  });
});
app.use("/api", routes);

// --- ERROR HANDLERS ---
app.use((req, res, next) => {
  res
    .status(404)
    .send(`Sorry, can't find that! Not found - ${req.originalUrl}`);
});
app.use((err, req, res, next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";
  res.status(statusCode).json({ errorStatus: true, message });
});

// --- SOCKET.IO SETUP ---
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
  },
});

// Export emit function for other modules
export function emitNewPunch(punch) {
  io.emit("newPunch", punch);
}

// --- START SERVER ---
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

// Optional: test Socket.IO connection
io.on("connection", (socket) => {
  console.log("⚡ A client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});
