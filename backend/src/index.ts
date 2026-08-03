import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import folderRoutes from "./routes/folder.routes";
import fileRoutes from "./routes/file.routes";
import searchRoutes from "./routes/search.routes";
import trashRoutes from "./routes/trash.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import printQueueRoutes from "./routes/printqueue.routes";
import qrRoutes from "./routes/qr.routes";
import {
  generalLimiter,
  authLimiter,
  uploadLimiter,
} from "./middleware/ratelimit.middleware";

dotenv.config();

const app = express();

// ── Trust Proxy (MUST be first before everything) ─────────────────────────────
app.set("trust proxy", true);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// ── Body Parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Rate Limiting ─────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter);
app.use("/api/files/upload", uploadLimiter);
app.use("/api", generalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/trash", trashRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/print-queue", printQueueRoutes);
app.use("/api/qr", qrRoutes);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "PocketDrive API Running 🚀",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use("*splat", (req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});