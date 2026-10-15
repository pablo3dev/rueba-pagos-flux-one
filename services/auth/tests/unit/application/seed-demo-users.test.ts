import { describe, expect, it } from 'vitest';
import { SeedDemoUsers } from '../../../src/application/use-cases/seed-demo-users.js';
import { FakeClock, FakePasswordHasher, InMemoryUserRepository } from '../../support/fakes.js';

const PASSWORD = 'demo_password_123';

function setup() {
  const users = new InMemoryUserRepository();
  const hasher = new FakePasswordHasher();
  const clock = new FakeClock();
  return { users, hasher, clock, seedDemoUsers: new SeedDemoUsers({ users, hasher, clock }) };
}

describe('SeedDemoUsers', () => {
  it('[AC-AUT-21] crea los tres usuarios demo con ids y emails fijos y la contraseña hasheada', async () => {
    const { users, clock, seedDemoUsers } = setup();

    await seedDemoUsers.execute({ password: PASSWORD });

    expect(users.users).toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'alice@fluxone.test',
        passwordHash: `hashed:${PASSWORD}`,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        email: 'bob@fluxone.test',
        passwordHash: `hashed:${PASSWORD}`,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        email: 'carol@fluxone.test',
        passwordHash: `hashed:${PASSWORD}`,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      },
    ]);
  });

  it('[AC-AUT-21] ejecutarlo de nuevo no duplica ni sobrescribe a los usuarios existentes', async () => {
    const { users, clock, seedDemoUsers } = setup();
    await seedDemoUsers.execute({ password: PASSWORD });
    clock.set(new Date('2026-02-01T00:00:00.000Z'));

    await seedDemoUsers.execute({ password: 'otra_clave_distinta_1' });

    expect(users.users).toHaveLength(3);
    expect(users.users.every((u) => u.passwordHash === `hashed:${PASSWORD}`)).toBe(true);
    expect(users.users.every((u) => u.createdAt.toISOString() === '2026-01-01T12:00:00.000Z')).toBe(
      true,
    );
  });
});
