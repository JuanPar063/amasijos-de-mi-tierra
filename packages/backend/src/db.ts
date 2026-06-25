import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const aquí = dirname(fileURLToPath(import.meta.url));

/** Crea las tablas si no existen (idempotente). Se llama al arrancar. */
export async function inicializarEsquema(): Promise<void> {
  const schema = await readFile(join(aquí, '..', 'sql', 'schema.sql'), 'utf8');
  await pool.query(schema);
}

/** Helper de consulta tipada. */
export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

/** Ejecuta una función dentro de una transacción. */
export async function enTransaccion<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
