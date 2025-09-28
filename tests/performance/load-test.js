import http from "k6/http"
import { check, sleep } from "k6"
import { Rate } from "k6/metrics"
import { __ENV } from "k6/env" // Declare the __ENV variable

// Custom metrics
const errorRate = new Rate("errors")

// Test configuration
export const options = {
  stages: [
    { duration: "2m", target: 10 }, // Ramp up to 10 users
    { duration: "5m", target: 10 }, // Stay at 10 users
    { duration: "2m", target: 20 }, // Ramp up to 20 users
    { duration: "5m", target: 20 }, // Stay at 20 users
    { duration: "2m", target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests must complete below 500ms
    http_req_failed: ["rate<0.1"], // Error rate must be below 10%
    errors: ["rate<0.1"], // Custom error rate must be below 10%
  },
}

const BASE_URL = __ENV.TEST_URL || "http://localhost:3000"

export default function () {
  // Test health endpoint
  let response = http.get(`${BASE_URL}/api/health`)
  let result = check(response, {
    "health check status is 200": (r) => r.status === 200,
    "health check response time < 200ms": (r) => r.timings.duration < 200,
  })
  errorRate.add(!result)

  sleep(1)

  // Test user registration
  const userData = {
    email: `test${Math.random()}@example.com`,
    password: "testpassword123",
    firstName: "Test",
    lastName: "User",
  }

  response = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(userData), {
    headers: { "Content-Type": "application/json" },
  })

  result = check(response, {
    "registration status is 201": (r) => r.status === 201,
    "registration response time < 1000ms": (r) => r.timings.duration < 1000,
  })
  errorRate.add(!result)

  sleep(1)

  // Test user login
  const loginData = {
    email: userData.email,
    password: userData.password,
  }

  response = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(loginData), {
    headers: { "Content-Type": "application/json" },
  })

  result = check(response, {
    "login status is 200": (r) => r.status === 200,
    "login response time < 500ms": (r) => r.timings.duration < 500,
  })
  errorRate.add(!result)

  let token = ""
  if (response.status === 200) {
    const loginResponse = JSON.parse(response.body)
    token = loginResponse.token
  }

  sleep(1)

  // Test products endpoint
  response = http.get(`${BASE_URL}/api/products`)
  result = check(response, {
    "products status is 200": (r) => r.status === 200,
    "products response time < 300ms": (r) => r.timings.duration < 300,
  })
  errorRate.add(!result)

  sleep(1)

  // Test authenticated endpoint (if token available)
  if (token) {
    response = http.get(`${BASE_URL}/api/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    result = check(response, {
      "profile status is 200": (r) => r.status === 200,
      "profile response time < 400ms": (r) => r.timings.duration < 400,
    })
    errorRate.add(!result)
  }

  sleep(2)
}
