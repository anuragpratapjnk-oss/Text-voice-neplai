import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: "admin" | "user";
  email?: string;
  createdAt: string;
  lastLoginAt?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "gemini-tts-studio-secure-auth-secret-key-2026";
const TOKEN_EXPIRY = "7d";

// Pre-hashed default password for "Notnormalai"
const INITIAL_DEMO_PASSWORD = "Notnormalai";
const initialPasswordHash = bcrypt.hashSync(INITIAL_DEMO_PASSWORD, 10);

// In-memory persistent user repository (extensible to database)
const usersStore: Map<string, StoredUser> = new Map();

// Initialize the requested initial/demo account:
// Username: Notnormalanurag
// Password: Notnormalai
usersStore.set("notnormalanurag", {
  id: "usr_anurag_01",
  username: "Notnormalanurag",
  displayName: "Anurag",
  passwordHash: initialPasswordHash,
  role: "admin",
  email: "anurag@gemini.tts",
  createdAt: new Date("2026-01-01").toISOString(),
});

export function findUserByUsername(username: string): StoredUser | undefined {
  const normalized = username.trim().toLowerCase();
  return usersStore.get(normalized);
}

export function findUserById(id: string): StoredUser | undefined {
  for (const user of usersStore.values()) {
    if (user.id === id) return user;
  }
  return undefined;
}

export function authenticateUser(username: string, password: string): { user?: Omit<StoredUser, "passwordHash">; token?: string; error?: string } {
  if (!username || !password) {
    return { error: "Please provide both username and password." };
  }

  const user = findUserByUsername(username);
  if (!user) {
    return { error: "Invalid username or password." };
  }

  const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isPasswordValid) {
    return { error: "Invalid username or password." };
  }

  // Update last login
  user.lastLoginAt = new Date().toISOString();
  usersStore.set(user.username.toLowerCase(), user);

  // Generate signed JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  const { passwordHash, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

export function verifyAuthToken(token: string): { valid: boolean; user?: Omit<StoredUser, "passwordHash">; error?: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
    const user = findUserById(decoded.userId);
    if (!user) {
      return { valid: false, error: "User associated with token no longer exists." };
    }
    const { passwordHash, ...userWithoutPassword } = user;
    return { valid: true, user: userWithoutPassword };
  } catch (err: any) {
    return { valid: false, error: "Invalid or expired session token." };
  }
}

export function changeUserPassword(userId: string, currentPass: string, newPass: string): { success: boolean; error?: string } {
  const user = findUserById(userId);
  if (!user) {
    return { success: false, error: "User not found." };
  }

  const isMatch = bcrypt.compareSync(currentPass, user.passwordHash);
  if (!isMatch) {
    return { success: false, error: "Current password is incorrect." };
  }

  if (!newPass || newPass.length < 6) {
    return { success: false, error: "New password must be at least 6 characters." };
  }

  user.passwordHash = bcrypt.hashSync(newPass, 10);
  usersStore.set(user.username.toLowerCase(), user);
  return { success: true };
}

export function createAdditionalUser(
  username: string,
  password: string,
  displayName: string,
  role: "admin" | "user" = "user"
): { success: boolean; user?: Omit<StoredUser, "passwordHash">; error?: string } {
  const normalized = username.trim().toLowerCase();
  if (usersStore.has(normalized)) {
    return { success: false, error: "Username is already taken." };
  }

  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }

  const newUser: StoredUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: username.trim(),
    displayName: displayName.trim() || username.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    createdAt: new Date().toISOString(),
  };

  usersStore.set(normalized, newUser);
  const { passwordHash, ...userWithoutPassword } = newUser;
  return { success: true, user: userWithoutPassword };
}

// Express Auth Middleware
export function requireAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required. Please log in to access this resource.",
      authenticated: false,
    });
  }

  const token = authHeader.split(" ")[1];
  const result = verifyAuthToken(token);

  if (!result.valid || !result.user) {
    return res.status(401).json({
      error: result.error || "Invalid or expired authentication session.",
      authenticated: false,
    });
  }

  (req as any).user = result.user;
  next();
}
