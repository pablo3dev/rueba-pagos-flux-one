import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestPool } from '../support/db.js';

describe('entorno de pruebas', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('[AC-AUT-32] usa PostgreSQL 18.6', async () => {
    const { rows } = await pool.query<{ server_version: string }>('SHOW server_version');
    expect(rows[0]?.server_version.startsWith('18.6')).toBe(true);
  });

  it('[AC-AUT-32] se conecta con el rol auth_svc', async () => {
    const { rows } = await pool.query<{ current_user: string }>('SELECT current_user');
    expect(rows[0]?.current_user).toBe('auth_svc');
  });

  it('[AC-AUT-32] el rol no puede crear esquemas (42501)', async () => {
    await expect(pool.query('CREATE SCHEMA environment_test_schema')).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('[AC-AUT-32] DATABASE_URL apunta al host postgres, puerto 5432', () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    expect(url.hostname).toBe('postgres');
    expect(url.port).toBe('5432');
  });
});
