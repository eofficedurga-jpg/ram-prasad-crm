"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import { users } from "@/db/schema";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=missing");
  const db = await getDbAsync();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=invalid");
  }
  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
