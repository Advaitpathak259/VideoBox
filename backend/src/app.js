/**
 * ------------------------------------------------------------
 * VideoBox - Server Entry Point
 * ------------------------------------------------------------
 * This file:
 * 1. Initializes the Express application
 * 2. Connects to MongoDB
 * 3. Configures middleware
 * 4. Attaches Socket.io to the HTTP server
 * 5. Registers API routes
 * 6. Starts the server
 * ------------------------------------------------------------
 */

import express from "express";
import { createServer } from "node:http";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";

import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";

// Load environment variables from .env file
dotenv.config();

const parseAllowedOrigins = () => {
  const raw = process.env.FRONTEND_URL;
  const fromEnv = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Sensible dev default
  const defaults = ["http://localhost:3000"];

  return [...new Set([...fromEnv, ...defaults])];
};

// Create Express application instance
const app = express();

// Create HTTP server using Express app
// This is required to attach Socket.io
const server = createServer(app);

// Attach Socket.io to the HTTP server
connectToSocket(server);

// Application configuration
const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI;

// CORS configuration
// Allows frontend application to communicate with backend
const allowedOrigins = parseAllowedOrigins();
const corsOptions = {
  origin: (origin, cb) => {
    // Allow same-origin / curl / Postman (no Origin header)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

// Global middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ extended: true, limit: "40kb" }));

// Register API routes
app.use("/api/v1/users", userRoutes);

// Root route - basic health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "AdvMeet API Server",
    status: "Running",
    version: "1.0.0",
  });
});

// Simple test route
app.get("/home", (req, res) => {
  res.status(200).send("Hello World!");
});

/**
 * Connect to MongoDB and start the server.
 * The server will not start if database connection fails.
 */
const startServer = async () => {
  try {
    server.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });

    // Connect to MongoDB in the background so signaling can run even if DB is down/unreachable.
    if (MONGODB_URI) {
      mongoose
        .connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        })
        .then(() => console.log("MongoDB connected successfully"))
        .catch((dbError) => {
          console.warn(
            "MongoDB connection failed. Continuing without DB (auth/history endpoints will be unavailable):",
            dbError?.message || dbError
          );
        });
    } else {
      console.warn(
        "MONGODB_URI is not set. Continuing without DB (auth/history endpoints will be unavailable)."
      );
    }
  } catch (error) {
    console.error("Server failed to start:", error?.message || error);
    process.exit(1);
  }
};

startServer();
