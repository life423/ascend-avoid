// server/index.ts
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { GameRoom } from "./rooms/GameRoom";
import { GAME_CONSTANTS } from "./constants/serverConstants";
import config from "./config";
import logger from "./utils/logger";

// Create an Express application
const app = express();

// Enable CORS to allow connections from your game client
// Security headers (HSTS, no sniffing, no framing, a content security policy for the game) and no
// advertising the stack. The policy allows only this site's scripts, Google Fonts, inline styles (the
// menu injects a <style>) and websocket connections for the game.
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", "wss:", "ws:"],
        "worker-src": ["'self'", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
// Compress responses (the game bundle shrinks to about a third)
app.use(compression());
// Browsers may only read this server's HTTP routes from our own pages (the game itself is same-origin
// in production; the Vite dev page is the other origin). CORS_ORIGINS (comma-separated) overrides.
const corsOrigins = (process.env.CORS_ORIGINS ?? "https://ascend.drewclark.io,http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins }));

// Parse JSON bodies for any REST endpoints you might add later
app.use(express.json());

// Serve static files from the client build directory
// In Docker, the dist folder is at /app/dist, in dev it's at ../dist
const distPath = process.env.NODE_ENV === 'production' ? './dist' : '../dist';
// Vite's content-hashed bundles never change, so browsers keep them a year; everything else
// (index.html) is always rechecked, so a new deploy shows up at once
app.use(
  express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      else res.setHeader("Cache-Control", "no-cache");
    },
  }),
);

// Create the HTTP server using our Express app
const httpServer = createServer(app);

// Initialize Colyseus with our HTTP server
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    pingInterval: config.pingInterval,
    pingMaxRetries: config.pingMaxRetries,
  }),
});

// Register your game room
gameServer.define(GAME_CONSTANTS.GAME.ROOM_NAME, GameRoom);

// Colyseus monitor: a dashboard that can inspect and shut down rooms, so development only
if (process.env.NODE_ENV !== "production") {
  app.use(config.monitorPath, monitor());
}

// Add a simple health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Start listening for connections
const PORT = config.port;
gameServer.listen(PORT);

logger.info(`🎮 Ascend & Avoid Game Server is running on port ${PORT}`);
logger.info(`🌐 Health check available at http://localhost:${PORT}/health`);
if (process.env.NODE_ENV !== "production") {
  logger.info(`📊 Colyseus Monitor available at http://localhost:${PORT}${config.monitorPath}`);
}

// Log environment mode
if (process.env.NODE_ENV === "production") {
  logger.info(`🚀 Server is running in production mode`);
} else {
  logger.info(`🔧 Server is running in development mode`);
}

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  httpServer.close(() => {
    logger.info("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  httpServer.close(() => {
    logger.info("HTTP server closed");
  });
});
