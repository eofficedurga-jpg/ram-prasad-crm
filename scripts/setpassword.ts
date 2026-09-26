import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import { users } from "@/db/schema";

/**
 * Set a user's password. Usage:
 *   tsx scripts/setpassword.ts <password> [email]
 * With no email, updates every user (used to rotate seeded demo credentials
 * before a public deployment).
 */
async function main() {
  const password = process.argv[2];
  const email = process.argv[3]?.toLowerCase();
  if (!password) throw new Error("Usage: tsx scripts/setpassword.ts <password> [email]");
  const hash = bcrypt.hashSync(password, 12);
  const db = await getDbAsync();
  if (email) {
    await db.update(users).set({ passwordHash: hash }).where(eq(users.email, email));
    console.log(`Updated password for ${email}.`);
  } else {
    await db.update(users).set({ passwordHash: hash });
    console.log("Updated password for all users.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
