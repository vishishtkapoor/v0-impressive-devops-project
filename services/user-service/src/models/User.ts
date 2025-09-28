export interface User {
  id: string
  email: string
  password: string
  firstName: string
  lastName: string
  role: "customer" | "admin"
  isActive: boolean
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
  profileImage?: string
  phoneNumber?: string
  address?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
}

export interface CreateUserRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  phoneNumber?: string
}

export interface UpdateUserRequest {
  firstName?: string
  lastName?: string
  phoneNumber?: string
  profileImage?: string
  address?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  user: Omit<User, "password">
  token: string
  refreshToken: string
}
