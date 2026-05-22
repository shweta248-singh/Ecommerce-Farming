import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import chatRoutes from "./routes/chat.js";
import authOtpRoutes from "./routes/authOtpRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import authGstRoutes from "./routes/authGstRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import collectiveBuyRoutes from "./routes/collectiveBuyRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import dataRoutes from "./routes/dataRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("❌ CORS blocked origin:", origin);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).send("🚀 AgroMitra Backend Running");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is alive ✅",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 50 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req) => req.path === "/profile",
  message: {
    message:
      "Too many authentication attempts. Please try again after 15 minutes.",
  },
});

app.use(globalLimiter);
app.use("/api/auth", authLimiter);

app.use("/uploads", express.static("uploads"));

app.use("/api/chat", chatRoutes);

// ✅ Main auth routes: /api/auth/register, /api/auth/login
app.use("/api/auth", authRoutes);

// ✅ OTP routes: /api/auth/otp/register/send-otp
app.use("/api/auth/otp", authOtpRoutes);
app.use("/api/auth", authOtpRoutes);

// ✅ GST routes: /api/auth/seller/verify-gst
app.use("/api/auth/seller", authGstRoutes);

app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/collective-buys", collectiveBuyRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/uploads", uploadRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

app.use(errorHandler);

export default app;
