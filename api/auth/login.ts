import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import { hashPassword, verifyPassword } from "../../src/lib/password";

/**
 * POST /api/v1/auth/login
 * Authenticates a user against the DB.
 * On first boot, auto-creates the admin account if it doesn't exist.
 *
 * Hardcoded accounts (mirrored in useAuthStore.ts):
 *   - baanbhaba / baanbhaba  → handled client-side, never hits this endpoint
 *   - admin      / admin     → this endpoint creates it in DB on first run
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  const { username, password } = req.body || {};

  if (!username || typeof username !== "string" || !password || typeof password !== "string") {
    return res.status(400).json({ success: false, error: "Username and password are required" });
  }

  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  if (!cleanUser || !cleanPass) {
    return res.status(400).json({ success: false, error: "Username and password cannot be empty" });
  }

  // Developer user "baanbhaba" has absolute privileges & AI access
  if (cleanUser === "baanbhaba" && cleanPass === "baanbhaba") {
    return res.status(200).json({
      success: true,
      username: "baanbhaba",
      role: "SUPER_DEV",
      token: "baanbhaba-dev-session-active",
      devApiKey: "",
    });
  }

  // Admin user
  if (cleanUser === "admin" && cleanPass === "admin") {
    return res.status(200).json({
      success: true,
      username: "admin",
      role: "ADMIN",
      token: "admin-session-token",
    });
  }

  try {
    let user = await prisma.user.findFirst({
      where: { OR: [{ username: cleanUser }, { email: cleanUser }] },
    });

    // ── FIRST-BOOT: Auto-seed admin account if DB has no users ────────────────
    if (!user && cleanUser === "admin") {
      const count = await prisma.user.count().catch(() => 0);
      if (count === 0) {
        user = await prisma.user.create({
          data: {
            username: "admin",
            email: "admin@alchemi.dev",
            passwordHash: hashPassword("admin"),
            role: "admin",
          },
        });
        console.log("[AUTH] First-boot: created admin account.");
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }

    if (!verifyPassword(cleanPass, user.passwordHash)) {
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }

    return res.status(200).json({
      success: true,
      username: user.username,
      role: user.role,
      token: `alchemi-${randomUUID()}`,
    });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return res.status(500).json({ success: false, error: "Authentication service unavailable" });
  }
}
