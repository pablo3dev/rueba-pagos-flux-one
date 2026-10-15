import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../support/build-test-app.js';
import { createTestPool, truncateAll } from '../support/db.js';

const PASSWORD = 'una-clave-segura-123';

describe('POST /auth/register', () => {
  let pool: pg.Pool;
  let app: FastifyInstance;

  function register(payload: unknown, ip?: string) {
    return app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: payload as object,
      headers: ip === undefined ? {} : { 'x-real-ip': ip },
    });
  }

  async function countUsers(email?: string): Promise<number> {
    const { rows } =
      email === undefined
        ? await pool.query('SELECT count(*)::int AS total FROM auth_schema.users')
        : await pool.query(
            'SELECT count(*)::int AS total FROM auth_schema.users WHERE email = $1',
            [email],
          );
    return rows[0].total;
  }

  beforeAll(() => {
    pool = createTestPool();
  });

  beforeEach(async () => {
    await truncateAll(pool);
    app = await buildTestApp(pool);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('[AC-AUT-01] guarda el email normalizado único y la contraseña solo como hash, sin devolverla', async () => {
    const response = await register({ email: '  Nuevo.Usuario@FluxOne.TEST ', password: PASSWORD });

    expect(response.statusCode).toBe(201);
    expect(response.body).not.toContain(PASSWORD);
    expect(response.body).not.toMatch(/password/i);
    const { rows } = await pool.query(
      'SELECT email, password_hash FROM auth_schema.users WHERE email = $1',
      ['nuevo.usuario@fluxone.test'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(rows[0].password_hash).not.toContain(PASSWORD);
  });

  it('[AC-AUT-02] un registro válido responde 201 con id y email normalizado, sin iniciar sesión', async () => {
    const response = await register({ email: 'Nuevo@FluxOne.test', password: PASSWORD });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      email: 'nuevo@fluxone.test',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    const { rows } = await pool.query('SELECT id FROM auth_schema.users WHERE email = $1', [
      'nuevo@fluxone.test',
    ]);
    expect(rows[0].id).toBe(response.json().id);
  });

  it('[AC-AUT-03] un email ya registrado (aun con otra capitalización) responde 409 EMAIL_TAKEN sin modificar nada', async () => {
    await register({ email: 'repetido@fluxone.test', password: PASSWORD });
    const before = await pool.query(
      'SELECT id, password_hash, created_at, updated_at FROM auth_schema.users WHERE email = $1',
      ['repetido@fluxone.test'],
    );

    const response = await register({
      email: 'REPETIDO@fluxone.test',
      password: 'otra-clave-distinta-456',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: { code: 'EMAIL_TAKEN', message: 'El correo ya está registrado.' },
    });
    expect(await countUsers('repetido@fluxone.test')).toBe(1);
    const after = await pool.query(
      'SELECT id, password_hash, created_at, updated_at FROM auth_schema.users WHERE email = $1',
      ['repetido@fluxone.test'],
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('[AC-AUT-04] datos inválidos responden 400 VALIDATION_ERROR sin crear la cuenta', async () => {
    const usersBefore = await countUsers();
    const invalid: Array<[string, unknown]> = [
      ['email sin forma válida', { email: 'no-es-un-email', password: PASSWORD }],
      ['contraseña de 11 caracteres', { email: 'a@fluxone.test', password: 'a'.repeat(11) }],
      ['contraseña de 129 caracteres', { email: 'a@fluxone.test', password: 'a'.repeat(129) }],
      ['falta la contraseña', { email: 'a@fluxone.test' }],
      ['falta el email', { password: PASSWORD }],
      ['campo adicional', { email: 'a@fluxone.test', password: PASSWORD, role: 'admin' }],
      ['email que no es texto', { email: 123, password: PASSWORD }],
    ];

    for (const [label, payload] of invalid) {
      const response = await register(payload);
      expect(response.statusCode, label).toBe(400);
      expect(response.json().error.code, label).toBe('VALIDATION_ERROR');
    }

    expect(await countUsers()).toBe(usersBefore);
  });

  it('[AC-AUT-04] las contraseñas de 12 y 128 caracteres son aceptadas', async () => {
    const short = await register({ email: 'doce@fluxone.test', password: 'a'.repeat(12) });
    const long = await register({ email: 'ciento28@fluxone.test', password: 'a'.repeat(128) });

    expect(short.statusCode).toBe(201);
    expect(long.statusCode).toBe(201);
  });

  it('[AC-AUT-05] el 11.º registro por IP recibe 429 RATE_LIMITED y no se procesa', async () => {
    const ip = '203.0.113.10';
    const statuses: number[] = [];
    for (let i = 1; i <= 10; i += 1) {
      const response = await register(
        { email: `usuario${i}@fluxone.test`, password: PASSWORD },
        ip,
      );
      statuses.push(response.statusCode);
    }
    expect(statuses).toEqual(Array<number>(10).fill(201));

    const eleventh = await register({ email: 'usuario11@fluxone.test', password: PASSWORD }, ip);

    expect(eleventh.statusCode).toBe(429);
    expect(eleventh.json()).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Demasiados intentos. Intenta de nuevo en un minuto.',
      },
    });
    expect(await countUsers('usuario11@fluxone.test')).toBe(0);

    const otherIp = await register(
      { email: 'otra-ip@fluxone.test', password: PASSWORD },
      '203.0.113.11',
    );
    expect(otherIp.statusCode).toBe(201);
  });
});
