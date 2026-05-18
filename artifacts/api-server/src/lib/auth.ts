import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const CHAT_PASSWORD = process.env.CHAT_PASSWORD ?? "4444";
const JWT_SECRET = process.env.SESSION_SECRET ?? "chat-jwt-secret-fallback";

export function verifyPassword(password: string): boolean {
  return password === CHAT_PASSWORD;
}

export function generateToken(): string {
  return jwt.sign({ auth: true }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (apiKey) {
    next();
    return;
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (verifyToken(token)) {
      next();
      return;
    }
  }

  res.status(401).json({ error: "Unauthorized" });
}
