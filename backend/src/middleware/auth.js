import jwt from "jsonwebtoken";
import { getEnvVar } from "../getEnvVar.js";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const secret = getEnvVar("JWT_SECRET");
    const payload = jwt.verify(token, secret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}