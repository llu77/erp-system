import mysql from 'mysql2/promise';
import crypto from 'crypto';

function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, usedSalt, 10000, 64, "sha512")
    .toString("hex");
  return { hash: `${usedSalt}:${hash}`, salt: usedSalt };
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const newPassword = "admin123";
const { hash } = hashPassword(newPassword);

console.log('New hashed password:', hash);

await connection.execute(
  "UPDATE users SET password = ? WHERE id = 870017",
  [hash]
);

console.log('Password updated successfully for user السيد محمد (id: 870017)');
console.log('New login credentials:');
console.log('Username: moh123');
console.log('Password: admin123');

await connection.end();
