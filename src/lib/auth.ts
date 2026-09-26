import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, gt } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import { sessions, users } from "@/db/schema";
import type { Permission } from "./permissions";
import { can } from "./permissions";

const COOKIE = "rp_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: string;
};

function secret(): Uint8Array {
  const value =
    process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me-please";
  return new TextEncoder().encode(value);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  const db = await getDbAsync();
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);
  await db.insert(sessions).values({ id: jti, userId: user.id, expiresAt });
  const token = await new SignJWT({
    role: user.role,
    name: user.name,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      if (payload.jti) {
        const db = await getDbAsync();
        await db.delete(sessions).where(eq(sessions.id, payload.jti));
      }
    } catch {
      // ignore malformed token
    }
  }
  store.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  let jti: string | undefined;
  let userId: number | undefined;
  try {
    const { payload } = await jwtVerify(token, secret());
    jti = payload.jti;
    userId = payload.sub ? Number(payload.sub) : undefined;
  } catch {
    return null;
  }
  if (!jti || !userId) return null;
  const db = await getDbAsync();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, jti), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || !row.active) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw new Error(`Your role (${user.role}) is not permitted to perform this action.`);
  }
  return user;
}
