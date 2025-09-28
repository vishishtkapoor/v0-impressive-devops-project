import express from "express"
import { createProxyMiddleware } from "http-proxy-middleware"
import helmet from "helmet"
import cors from "cors"
import compression from "compression"
import rateLimit from "express-rate-limit"
import { createClient } from "redis"
import dotenv from "dotenv"
import { logger } from "./utils/logger"
import { authMiddleware } from "./middleware/authMiddleware"
import { requestLogger } from "./middleware/requestLogger"
import { errorHandler } from "./middleware/errorHandler"
import { serviceDiscovery } from "./utils/serviceDiscovery"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Redis for caching and session management
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

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(globalLimiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Request logging
app.use(requestLogger)

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    await redis.ping()

    // Check service health
    const services = await serviceDiscovery.getHealthyServices()

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "api-gateway",
      version: process.env.npm_package_version || "1.0.0",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: services,
    })
  } catch (error) {
    logger.error("Health check failed:", error)
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "api-gateway",
      error: "Service dependencies unavailable",
    })
  }
})

// Service proxy configurations
const serviceProxies = {
  "/api/auth": {
    target: process.env.USER_SERVICE_URL || "http://user-service:3001",
    changeOrigin: true,
    timeout: 30000,
    retries: 3,
  },
  "/api/users": {
    target: process.env.USER_SERVICE_URL || "http://user-service:3001",
    changeOrigin: true,
    timeout: 30000,
    retries: 3,
    middleware: [authMiddleware], // Require authentication
  },
  "/api/products": {
    target: process.env.PRODUCT_SERVICE_URL || "http://product-service:3002",
    changeOrigin: true,
    timeout: 30000,
    retries: 3,
  },
  "/api/categories": {
    target: process.env.PRODUCT_SERVICE_URL || "http://product-service:3002",
    changeOrigin: true,
    timeout: 30000,
    retries: 3,
  },
  "/api/orders": {
    target: process.env.ORDER_SERVICE_URL || "http://order-service:3003",
    changeOrigin: true,
    timeout: 30000,
    retries: 3,
    middleware: [authMiddleware], // Require authentication
  },
}

// Setup service proxies
Object.entries(serviceProxies).forEach(([path, config]) => {
  const { middleware = [], ...proxyConfig } = config

  // Apply middleware if specified
  if (middleware.length > 0) {
    app.use(path, ...middleware)
  }

  // Create proxy middleware
  const proxy = createProxyMiddleware({
    ...proxyConfig,
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${path}:`, err)
      res.status(503).json({
        error: "Service temporarily unavailable",
        service: path,
        timestamp: new Date().toISOString(),
      })
    },
    onProxyReq: (proxyReq, req, res) => {
      logger.debug(`Proxying ${req.method} ${req.url} to ${proxyConfig.target}`)
    },
    onProxyRes: (proxyRes, req, res) => {
      logger.debug(`Received response ${proxyRes.statusCode} from ${proxyConfig.target}`)
    },
  })

  app.use(path, proxy)
})

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    method: req.method,
    availableRoutes: Object.keys(serviceProxies),
  })
})

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully")

  try {
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
    await redis.connect()
    logger.info("Connected to Redis")

    app.listen(PORT, () => {
      logger.info(`API Gateway running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`)
      logger.info("Available routes:", Object.keys(serviceProxies))
    })
  } catch (error) {
    logger.error("Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
