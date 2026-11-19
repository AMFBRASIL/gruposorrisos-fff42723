import mysql from "mysql2/promise";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Env } from "../config/env.js";

export function createPool(env: Env): Pool {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 20_000,
    enableKeepAlive: true,
    timezone: "Z",
    dateStrings: true,
    charset: "utf8mb4",
  });

  pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });

  return pool;
}

export function toMysqlUtc(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function transaction<T>(pool: Pool, run: (connection: PoolConnection) => Promise<T>) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await run(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export type { Pool, PoolConnection, ResultSetHeader, RowDataPacket };
