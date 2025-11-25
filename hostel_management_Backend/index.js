import express from "express";
import cookieParser from "cookie-parser";
//import listEndpoints from 'express-list-endpoints';
import cors from "cors";
import routes from "./routes/indexRoute.js";
import dotenv from "dotenv";
import { db, connectDB } from "./config/Database.js";
import toobusy from "toobusy-js";
import crypto from "crypto";
import qs from "qs";
// import {postReq} from './ccv/ccavRequestHandler.js';
// import {postRes} from './ccv/ccavResponseHandler.js';
dotenv.config();
const app = express();

connectDB();
//middlewares
// Enable CORS for specific route(s)
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

app.use(
  cors({
    credentials: true,
    origin: allowedOrigin,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    allowedHeaders:
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  })
);

import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

global.__basedir = __dirname;
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(function (req, res, next) {
  // Your custom headers
  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(cookieParser());

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb', extended: false }));

app.use(express.json()); // default 100kb limit
app.use(express.urlencoded({ extended: true }));

// app.use(express.raw({ type: 'application/x-www-form-urlencoded', limit: '10mb' }));
app.use(function (req, res, next) {
  if (toobusy()) {
    // log if you see necessary
    res.status(503).send("Server Too Busy");
  } else {
    next();
  }
});
app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

app.get("/api/isrunning", function (req, res) {
  return res.send({
    issuccess: true,
    message: `server is running successfully`,
  });
});
// Use the router
app.use("/api", routes);

// Get a list of all available routes
// const routesendUrl = listEndpoints(app);
// console.log(JSON.stringify(routesendUrl));

// Not found error handler
app.use(function (req, res, next) {
  res
    .status(404)
    .send("Sorry, can't find that! " + `Not found - ${req.originalUrl}`);
});

// Error handling middleware
app.use(function (err, req, res, next) {
  console.error(err); // Log the error details
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";

  if (message == "File too large") {
    res.status(200).json({
      error: true,
      message: message + " & " + "File size exceeds the limit of 5 MB",
    });
    console.log("error message", message);
  } else {
    res.status(statusCode).json({
      errorStatus: true,
      message: message,
    });
  }
});

// utf8mb4_0900_ai_ci
// utf8mb4_unicode_ci
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
