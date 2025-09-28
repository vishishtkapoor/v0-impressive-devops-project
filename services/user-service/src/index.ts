import express from "express"
import helmet from "helmet"
import cors from "cors"
import compression from "compression"
import rateLimit from "express-rate-limit"
import { createClient } from "redis"
import { Pool } from "pg"
import dotenv from "dotenv"
import { logger } from "./utils/logger"
import { userRoutes } from "./routes/userRoutes"
import { authRoutes } from "./routes/authRoutes"
import { errorHandler } from "./middleware/errorHandler"
import { requestLogger } from "./middleware/requestLogger"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Database connection
export const db = new Pool({
  host: process.env.DB_HOST,
  port: Number.parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Redis connection
export const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
})

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
)

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
    credentials: true,
  }),
)

app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Request logging
app.use(requestLogger)

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    await db.query("SELECT 1")

    // Check Redis connection
    await redis.ping()

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "user-service",
      version: process.env.npm_package_version || "1.0.0",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    })
  } catch (error) {
    logger.error("Health check failed:", error)
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "user-service",
      error: "Service dependencies unavailable",
    })
  }
})

// API routes
app.use("/api/users", userRoutes)
app.use("/api/auth", authRoutes)

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    method: req.method,
  })
})

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully")

  try {
    await db.end()
    await redis.quit()
    process.exit(0)
  } catch (error) {
    logger.error("Error during shutdown:", error)
    process.exit(1)
  }
})

// Start server
const startServer = async () => {
  try {
    // Connect to Redis
    await redis.connect()
    logger.info("Connected to Redis")

    // Test database connection
    await db.query("SELECT NOW()")
    logger.info("Connected to PostgreSQL")

    app.listen(PORT, () => {
      logger.info(`User service running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`)
    })
  } catch (error) {
    logger.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
