import { randomUUID } from 'node:crypto';
import { parseEmail } from '../../domain/email.js';
import { assertValidPassword } from '../../domain/password-policy.js';
import type { Clock } from '../ports/clock.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { UserRepository } from '../ports/user-repository.js';

interface RegisterUserDeps {
  users: UserRepository;
  hasher: PasswordHasher;
  clock: Clock;
}

export class RegisterUser {
  constructor(private readonly deps: RegisterUserDeps) {}

  // Idempotencia: la unicidad del email (users_email_key) garantiza un solo alta; la repetición
  // lanza EmailAlreadyRegisteredError.
  async execute(input: {
    email: string;
    password: string;
  }): Promise<{ id: string; email: string }> {
    const { users, hasher, clock } = this.deps;
    const email = parseEmail(input.email);
    assertValidPassword(input.password);
    const passwordHash = await hasher.hash(input.password);
    const now = clock.now();
    const id = randomUUID();
    await users.insert({ id, email, passwordHash, createdAt: now, updatedAt: now });
    return { id, email };
  }
}
