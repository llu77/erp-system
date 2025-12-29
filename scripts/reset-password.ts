import { db } from "../server/_core/db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function resetPassword() {
  const newPassword = "moh123";
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  await db.update(users)
    .set({ passwordHash: hashedPassword })
    .where(eq(users.username, "moh123"));
  
  console.log("Password reset successfully for user moh123");
  console.log("New password:", newPassword);
  process.exit(0);
}

resetPassword();
