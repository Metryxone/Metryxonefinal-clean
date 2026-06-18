import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "../storage";

interface FirebaseTokenPayload {
  iss: string;
  aud: string;
  auth_time: number;
  user_id: string;
  sub: string;
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  firebase?: { sign_in_provider?: string };
}

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache: { keys: Record<string, string>; fetchedAt: number } | null = null;
const CERT_TTL_MS = 60 * 60 * 1000;

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() - certCache.fetchedAt < CERT_TTL_MS) {
    return certCache.keys;
  }
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Google certs: ${res.status}`);
  const keys = (await res.json()) as Record<string, string>;
  certCache = { keys, fetchedAt: Date.now() };
  return keys;
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
): Promise<FirebaseTokenPayload> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed ID token");

  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(base64UrlDecode(headerB64).toString("utf8")) as {
    alg: string;
    kid: string;
  };
  const payload = JSON.parse(
    base64UrlDecode(payloadB64).toString("utf8"),
  ) as FirebaseTokenPayload;

  if (header.alg !== "RS256") throw new Error(`Unexpected alg: ${header.alg}`);
  if (!header.kid) throw new Error("Token missing kid");

  const certs = await getGoogleCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error("Token kid not found in Google certs");

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  const isValid = verifier.verify(cert, base64UrlDecode(sigB64));
  if (!isValid) throw new Error("Invalid token signature");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error("Token expired");
  if (payload.iat > now + 60) throw new Error("Token issued in the future");
  if (payload.aud !== projectId) {
    throw new Error(`Invalid audience: expected ${projectId}, got ${payload.aud}`);
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error(`Invalid issuer: ${payload.iss}`);
  }
  if (!payload.sub) throw new Error("Token missing sub");
  if (payload.email_verified !== true) {
    throw new Error("Email not verified by Google");
  }
  if (payload.firebase?.sign_in_provider !== "google.com") {
    throw new Error(
      `Unexpected sign-in provider: ${payload.firebase?.sign_in_provider ?? "unknown"}`,
    );
  }

  return payload;
}

const ALLOWED_SELF_REGISTER_ROLES = new Set([
  "parent",
  "student",
  "career_seeker",
  "mentor",
  "institute_admin",
]);

function sanitizeRole(role: unknown, fallback = "parent"): string {
  if (typeof role !== "string") return fallback;
  return ALLOWED_SELF_REGISTER_ROLES.has(role) ? role : fallback;
}

function randomPassword(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function registerFirebaseAuthRoutes(app: Express): void {
  app.post(
    "/api/auth/firebase/google",
    async (req: Request, res: Response) => {
      try {
        const { idToken, role } = req.body ?? {};

        if (!idToken || typeof idToken !== "string") {
          return res.status(400).json({ message: "idToken is required" });
        }

        const projectId =
          process.env.VITE_FIREBASE_PROJECT_ID ??
          process.env.FIREBASE_PROJECT_ID ??
          "metryxone-ai-a3431";

        let payload: FirebaseTokenPayload;
        try {
          payload = await verifyFirebaseIdToken(idToken, projectId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Verification failed";
          return res.status(401).json({ message: `Invalid Firebase token: ${msg}` });
        }

        const email = payload.email?.toLowerCase().trim();
        const fullName = payload.name ?? "";
        const profilePicture = payload.picture ?? "";

        if (!email) {
          return res
            .status(400)
            .json({ message: "Google account did not return an email." });
        }

        const existing = await storage.getUserByUsername(email);

        if (!existing) {
          return res.json({
            isNewUser: true,
            googleProfile: { email, fullName, profilePicture },
          });
        }

        const sessionUser = {
          id: existing.id,
          username: existing.username,
          fullName: existing.fullName,
          email: existing.username,
          profilePicture: (existing as Record<string, unknown>).profilePicture as string | undefined ?? profilePicture,
          role: existing.role,
          roles: existing.roles ?? [existing.role],
          isVerified: true,
        };

        req.login(sessionUser, (err) => {
          if (err) {
            return res
              .status(500)
              .json({ message: "Failed to establish session" });
          }
          return res.json({
            token: req.sessionID,
            user: sessionUser,
            id: existing.id,
            isNewUser: false,
          });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return res
          .status(500)
          .json({ message: `Google sign-in failed: ${msg}` });
      }
    },
  );

  app.post(
    "/api/auth/firebase/google/register",
    async (req: Request, res: Response) => {
      try {
        const { idToken, role, fullName: providedFullName } = req.body ?? {};
        if (!idToken) {
          return res.status(400).json({ message: "idToken is required" });
        }

        const projectId =
          process.env.VITE_FIREBASE_PROJECT_ID ??
          process.env.FIREBASE_PROJECT_ID ??
          "metryxone-ai-a3431";

        const payload = await verifyFirebaseIdToken(idToken, projectId);
        const email = payload.email?.toLowerCase().trim();
        if (!email) {
          return res
            .status(400)
            .json({ message: "Google account did not return an email." });
        }

        const existing = await storage.getUserByUsername(email);
        if (existing) {
          return res
            .status(409)
            .json({ message: "An account with this email already exists." });
        }

        const safeRole = sanitizeRole(role, "parent");

        const created = await storage.createUser({
          username: email,
          password: randomPassword(),
          fullName: providedFullName ?? payload.name ?? email,
          role: safeRole,
          roles: [safeRole],
        });

        const sessionUser = {
          id: created.id,
          username: created.username,
          fullName: created.fullName,
          role: created.role,
          roles: created.roles ?? [created.role],
        };

        req.login(sessionUser, (err) => {
          if (err) {
            return res
              .status(500)
              .json({ message: "Failed to establish session" });
          }
          return res.json({ token: req.sessionID, user: sessionUser, isNewUser: true });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return res
          .status(500)
          .json({ message: `Google registration failed: ${msg}` });
      }
    },
  );
}
