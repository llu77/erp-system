import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";
import { readMigrationFiles } from "drizzle-orm/migrator";

const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const migrationsFolder = path.join(projectRoot, "drizzle");
const migrationTable = "__drizzle_migrations";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to reconcile database migrations");
}

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 2,
  multipleStatements: false,
});

const quoteIdentifier = (identifier) => `\`${identifier.replaceAll("`", "``")}\``;

async function scalar(connection, query, params = []) {
  const [rows] = await connection.execute(query, params);
  return rows[0] ?? {};
}

async function tableExists(connection, tableName) {
  const row = await scalar(
    connection,
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [tableName],
  );
  return Number(row.count) > 0;
}

async function columnExists(connection, tableName, columnName) {
  const row = await scalar(
    connection,
    "SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [tableName, columnName],
  );
  return Number(row.count) > 0;
}

async function indexExists(connection, tableName, indexName) {
  const row = await scalar(
    connection,
    "SELECT COUNT(*) AS count FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
    [tableName, indexName],
  );
  return Number(row.count) > 0;
}

function normalizeStatement(statement) {
  return statement.replace(/^\s*\/\*![\s\S]*?\*\/\s*/g, "").trim();
}

function parseTableName(statement) {
  return statement.match(/^(?:CREATE TABLE|DROP TABLE)\s+(?:IF NOT EXISTS\s+)?`([^`]+)`/i)?.[1] ?? null;
}

function parseAlterTableName(statement) {
  return statement.match(/^ALTER TABLE\s+`([^`]+)`/i)?.[1] ?? null;
}

function parseAddedColumn(statement) {
  return statement.match(/^ALTER TABLE\s+`[^`]+`\s+ADD\s+(?:COLUMN\s+)?`([^`]+)`/i)?.[1] ?? null;
}

function parseModifiedColumn(statement) {
  return statement.match(/^ALTER TABLE\s+`[^`]+`\s+MODIFY\s+COLUMN\s+`([^`]+)`/i)?.[1] ?? null;
}

function parseConstraintName(statement) {
  return statement.match(/^ALTER TABLE\s+`[^`]+`\s+ADD\s+CONSTRAINT\s+`([^`]+)`/i)?.[1] ?? null;
}

function parseCreatedIndex(statement) {
  return statement.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+`([^`]+)`\s+ON\s+`([^`]+)`/i) ?? null;
}

function isDropStatement(statement) {
  return /^DROP\s+(?:TABLE|COLUMN|INDEX)/i.test(statement);
}

async function executeIdempotently(connection, statement, migrationTag) {
  const sql = normalizeStatement(statement);
  if (!sql) return "empty";

  if (isDropStatement(sql)) {
    console.log(`[${migrationTag}] skipped destructive statement: ${sql.split("\\n")[0]}`);
    return "skipped-destructive";
  }

  const tableName = parseTableName(sql);
  if (/^CREATE TABLE/i.test(sql) && tableName) {
    if (await tableExists(connection, tableName)) {
      console.log(`[${migrationTag}] table already exists: ${tableName}`);
      return "already-exists";
    }
    await connection.query(sql);
    console.log(`[${migrationTag}] created table: ${tableName}`);
    return "applied";
  }

  const alterTableName = parseAlterTableName(sql);
  const addedColumn = parseAddedColumn(sql);
  if (alterTableName && addedColumn) {
    if (await columnExists(connection, alterTableName, addedColumn)) {
      console.log(`[${migrationTag}] column already exists: ${alterTableName}.${addedColumn}`);
      return "already-exists";
    }
    await connection.query(sql);
    console.log(`[${migrationTag}] added column: ${alterTableName}.${addedColumn}`);
    return "applied";
  }

  const modifiedColumn = parseModifiedColumn(sql);
  if (alterTableName && modifiedColumn) {
    if (!(await columnExists(connection, alterTableName, modifiedColumn))) {
      throw new Error(`Cannot modify missing column ${alterTableName}.${modifiedColumn}`);
    }
    await connection.query(sql);
    console.log(`[${migrationTag}] modified column: ${alterTableName}.${modifiedColumn}`);
    return "applied";
  }

  const constraintName = parseConstraintName(sql);
  if (alterTableName && constraintName) {
    if (await indexExists(connection, alterTableName, constraintName)) {
      console.log(`[${migrationTag}] constraint/index already exists: ${alterTableName}.${constraintName}`);
      return "already-exists";
    }
    await connection.query(sql);
    console.log(`[${migrationTag}] added constraint: ${alterTableName}.${constraintName}`);
    return "applied";
  }

  const createdIndex = parseCreatedIndex(sql);
  if (createdIndex) {
    const [, indexName, indexTable] = createdIndex;
    if (await indexExists(connection, indexTable, indexName)) {
      console.log(`[${migrationTag}] index already exists: ${indexTable}.${indexName}`);
      return "already-exists";
    }
    await connection.query(sql);
    console.log(`[${migrationTag}] created index: ${indexTable}.${indexName}`);
    return "applied";
  }

  await connection.query(sql);
  console.log(`[${migrationTag}] executed data statement: ${sql.split("\\n")[0]}`);
  return "applied";
}

async function migrationAlreadyRecorded(connection, hash) {
  const row = await scalar(
    connection,
    `SELECT COUNT(*) AS count FROM ${quoteIdentifier(migrationTable)} WHERE hash = ?`,
    [hash],
  );
  return Number(row.count) > 0;
}

async function recordMigration(connection, migration) {
  if (await migrationAlreadyRecorded(connection, migration.hash)) return;
  await connection.execute(
    `INSERT INTO ${quoteIdentifier(migrationTable)} (hash, created_at) VALUES (?, ?)`,
    [migration.hash, migration.folderMillis],
  );
}

async function main() {
  const connection = await pool.getConnection();
  try {
    const migrations = readMigrationFiles({ migrationsFolder });
    const latest = await scalar(
      connection,
      `SELECT created_at FROM ${quoteIdentifier(migrationTable)} ORDER BY created_at DESC LIMIT 1`,
    );
    const latestCreatedAt = Number(latest.created_at ?? 0);
    const pending = migrations.filter((migration) => migration.folderMillis > latestCreatedAt);

    console.log(`Latest recorded migration timestamp: ${latestCreatedAt}`);
    console.log(`Pending migrations to reconcile: ${pending.length}`);

    for (const migration of pending) {
      const tag = migrations.find((candidate) => candidate.hash === migration.hash)?.folderMillis ?? migration.folderMillis;
      console.log(`Applying ${tag} (${migration.hash.slice(0, 12)}…)`);
      for (const statement of migration.sql) {
        await executeIdempotently(connection, statement, String(tag));
      }
      await recordMigration(connection, migration);
      console.log(`Recorded ${tag}`);
    }

    console.log("Database migration reconciliation completed successfully.");
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
