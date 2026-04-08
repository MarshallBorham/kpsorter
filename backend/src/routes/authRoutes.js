import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User.js";
import { getEnvVar } from "../getEnvVar.js";
import { logEvent } from "../logEvent.js";
import { getOrCreateUserForDiscord } from "../utils/discordAccount.js";

export const authRouter = express.Router();

function discordOAuthConfigured() {
  return !!(
    getEnvVar("DISCORD_CLIENT_ID", false) &&
    getEnvVar("DISCORD_CLIENT_SECRET", false) &&
    discordRedirectUri()
  );
}

function discordRedirectUri() {
  const u = getEnvVar("DISCORD_OAUTH_REDIRECT_URI", false);
  return u ? String(u).trim() : null;
}

/** SPA base URL for post-OAuth redirect. Prefer FRONTEND_ORIGIN when API and UI differ (e.g. Railway split). */
function frontendOrigin(req) {
  const env = getEnvVar("FRONTEND_ORIGIN", false);
  if (env) {
    return String(env).trim().replace(/\/$/, "");
  }
  if (req) {
    const proto = (req.get("x-forwarded-proto") || req.protocol || "https")
      .split(",")[0]
      .trim();
    const host = (req.get("x-forwarded-host") || req.get("host") || "")
      .split(",")[0]
      .trim();
    if (host) return `${proto}://${host}`;
  }
  return "http://localhost:5173";
}

export function signToken(user) {
  return jwt.sign(
    {
      userId: String(user._id),
      username: user.username,
      ...(user.discordId ? { discordId: user.discordId } : {}),
    },
    getEnvVar("JWT_SECRET"),
    { expiresIn: "8h" }
  );
}

// POST /api/auth/register
authRouter.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const passwordHash = await User.hashPassword(password);
    const user = new User({ username, passwordHash });
    await user.save();

    await logEvent("register", { username });

    const token = signToken(user);
    res.status(201).json({ token, username: user.username });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    if (!user.passwordHash) {
      return res.status(401).json({
        error: "This account uses Discord. Sign in with the Discord button instead.",
      });
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    await logEvent("login", { username });

    const token = signToken(user);
    res.json({ token, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

/**
 * Start Discord OAuth (browser redirect). Requires DISCORD_* env vars.
 */
authRouter.get("/discord", (req, res) => {
  if (!discordOAuthConfigured()) {
    return res.status(503).json({ error: "Discord login is not configured on this server." });
  }
  const state = jwt.sign(
    { r: crypto.randomBytes(16).toString("hex") },
    getEnvVar("JWT_SECRET"),
    { expiresIn: "10m" }
  );
  const params = new URLSearchParams({
    client_id: getEnvVar("DISCORD_CLIENT_ID"),
    redirect_uri: discordRedirectUri(),
    response_type: "code",
    scope: "identify",
    state,
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

/**
 * Discord OAuth redirect target. Exchanges code, upserts User by discordId, issues JWT, redirects to SPA.
 */
authRouter.get("/discord/callback", async (req, res) => {
  const front = frontendOrigin(req);
  const err = (code) => res.redirect(`${front}/login?error=${encodeURIComponent(code)}`);

  if (!discordOAuthConfigured()) {
    return res.status(503).send("Discord OAuth not configured");
  }

  const { code, state, error, error_description: errDesc } = req.query;
  if (error) {
    console.warn("Discord OAuth error:", error, errDesc);
    return err("discord_denied");
  }
  if (!code || !state) return err("discord_bad_response");

  try {
    jwt.verify(state, getEnvVar("JWT_SECRET"));
  } catch {
    return err("discord_state");
  }

  try {
    const body = new URLSearchParams({
      client_id: getEnvVar("DISCORD_CLIENT_ID"),
      client_secret: getEnvVar("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: discordRedirectUri(),
    });

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Discord token exchange failed:", tokens);
      return err("discord_token");
    }

    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await meRes.json();
    if (!meRes.ok || !profile.id) {
      console.error("Discord @me failed:", profile);
      return err("discord_profile");
    }

    const user = await getOrCreateUserForDiscord(profile.id, profile.username);

    await logEvent("login_discord", { username: user.username, discordId: profile.id });

    const token = signToken(user);
    const qs = new URLSearchParams({
      token,
      username: user.username,
    }).toString();
    res.redirect(`${front}/auth/discord/callback?${qs}`);
  } catch (e) {
    console.error("Discord callback error:", e);
    return err("discord_server");
  }
});
