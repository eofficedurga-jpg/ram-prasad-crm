import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { getDbAsync } from "@/db/client";
import { sessions, users } from "@/db/schema";

async function main() {
  const db = await getDbAsync();
  const email = process.argv[2] ?? "owner@ramprasad.in";
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`No user ${email}. Run npm run db:seed first.`);
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 86_400_000);
  await db.insert(sessions).values({ id: jti, userId: user.id, expiresAt });
  const token = await new SignJWT({ role: user.role, name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me-please"));
  console.log(token);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
