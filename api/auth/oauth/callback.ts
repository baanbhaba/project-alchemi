import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../../../src/lib/prisma.js";
import { randomUUID, randomBytes } from "node:crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end("Method Not Allowed");
  }

  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:3000";
  const appBaseUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    (process.env.VITE_API_BASE_URL?.startsWith("http") ? process.env.VITE_API_BASE_URL : null) ||
    `${proto}://${host}`;
  const redirectUri = `${appBaseUrl}/api/auth/oauth/callback`;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Google OAuth not configured" });
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData: any = await tokenRes.json();
    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description });
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch user profile
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const googleUser: any = await userRes.json();

    if (!googleUser.email) {
      return res.status(400).json({ error: "No email returned from Google" });
    }

    // 3. Upsert user in database
    const email = googleUser.email;
    const username = email.split("@")[0] + "_" + randomBytes(2).toString("hex");

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          username,
          passwordHash: "oauth", // Not used for OAuth
          role: "developer",
        },
      });
    }

    // 4. Return or redirect with session token
    const token = `alchemi-${randomUUID()}`;
    res.setHeader("Set-Cookie", `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    
    const frontendUrl = process.env.VITE_APP_URL || "http://localhost:5173";
    return res.redirect(`${frontendUrl}/oauth/success?token=${token}&username=${user.username}&role=${user.role}`);
  } catch (err: any) {
    console.error("OAuth callback error:", err);
    return res.status(500).json({ error: "Authentication failed" });
  }
}
