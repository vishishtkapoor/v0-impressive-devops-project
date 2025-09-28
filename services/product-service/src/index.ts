import express from "express"
import helmet from "helmet"
import cors from "cors"
import compression from "compression"
import rateLimit from "express-rate-limit"
import { createClient } from "redis"
import { Pool } from "pg"
import dotenv from "dotenv"
import { logger } from "./utils/logger"
import { productRoutes } from "./routes/productRoutes"
import { categoryRoutes } from "./routes/categoryRoutes"
import { errorHandler } from "./middleware/errorHandler"
import { requestLogger } from "./middleware/requestLogger"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3002

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

// Redis connection for caching
export const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
})

// Security and performance middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
    credentials: true,
  }),
)
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Higher limit for product browsing
  message: "Too many requests from this IP, please try again later.",
})

app.use(limiter)
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(requestLogger)

// Health check
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1")
    await redis.ping()

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "product-service",
      version: process.env.npm_package_version || "1.0.0",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    })
  } catch (error) {
    logger.error("Health check failed:", error)
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "product-service",
      error: "Service dependencies unavailable",
    })
  }
})

// API routes
app.use("/api/products", productRoutes)
app.use("/api/categories", categoryRoutes)

app.use(errorHandler)

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

const startServer = async () => {
  try {
    await redis.connect()
    logger.info("Connected to Redis")

    await db.query("SELECT NOW()")
    logger.info("Connected to PostgreSQL")

    app.listen(PORT, () => {
      logger.info(`Product service running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`)
    })
  } catch (error) {
    logger.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
