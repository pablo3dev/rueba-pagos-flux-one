// adapter: out — PostgreSQL (pg) para UserRepository
import type { Pool } from 'pg';
import type { UserRepository } from '../../../application/ports/user-repository.js';
import { EmailAlreadyRegisteredError } from '../../../domain/errors.js';
import type { User } from '../../../domain/user.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

const USER_COLUMNS = 'id, email, password_hash, created_at, updated_at';

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  // Unicidad garantizada por users_email_key: la carrera concurrente deja un solo alta.
  async insert(user: User): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO auth_schema.users (id, email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, user.email, user.passwordHash, user.createdAt, user.updatedAt],
      );
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_key')) throw new EmailAlreadyRegisteredError();
      throw error;
    }
  }

  // Idempotente por ON CONFLICT DO NOTHING: repetirlo no duplica ni modifica al usuario existente.
  async insertIfAbsent(user: User): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_schema.users (id, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [user.id, user.email, user.passwordHash, user.createdAt, user.updatedAt],
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM auth_schema.users WHERE email = $1`,
      [email],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM auth_schema.users WHERE id = $1`,
      [id],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === constraint
  );
}
