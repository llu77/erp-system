import { db } from "../server/_core/db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function checkUser() {
  const user = await db.select().from(users).where(eq(users.username, "moh123")).limit(1);
  if (user.length > 0) {
    console.log("User found:", {
      id: user[0].id,
      username: user[0].username,
      name: user[0].name,
      role: user[0].role,
      passwordHash: user[0].passwordHash?.substring(0, 20) + "...",
      isActive: user[0].isActive
    });
  } else {
    console.log("User not found");
  }
  process.exit(0);
}

checkUser();
