import type { Clock } from '../ports/clock.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { UserRepository } from '../ports/user-repository.js';

export const DEMO_USERS = [
  { id: '11111111-1111-4111-8111-111111111111', email: 'alice@fluxone.test' },
  { id: '22222222-2222-4222-8222-222222222222', email: 'bob@fluxone.test' },
  { id: '33333333-3333-4333-8333-333333333333', email: 'carol@fluxone.test' },
] as const;

interface SeedDemoUsersDeps {
  users: UserRepository;
  hasher: PasswordHasher;
  clock: Clock;
}

export class SeedDemoUsers {
  constructor(private readonly deps: SeedDemoUsersDeps) {}

  // Idempotente: `insertIfAbsent` (ON CONFLICT DO NOTHING) no duplica ni sobrescribe usuarios existentes.
  async execute(input: { password: string }): Promise<void> {
    const { users, hasher, clock } = this.deps;
    const now = clock.now();
    for (const demo of DEMO_USERS) {
      const passwordHash = await hasher.hash(input.password);
      await users.insertIfAbsent({ ...demo, passwordHash, createdAt: now, updatedAt: now });
    }
  }
}
