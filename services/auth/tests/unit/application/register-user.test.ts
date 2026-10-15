import { describe, expect, it } from 'vitest';
import { RegisterUser } from '../../../src/application/use-cases/register-user.js';
import { EmailAlreadyRegisteredError, ValidationError } from '../../../src/domain/errors.js';
import { FakeClock, FakePasswordHasher, InMemoryUserRepository } from '../../support/fakes.js';

const PASSWORD = 'una-clave-segura-123';

function setup() {
  const users = new InMemoryUserRepository();
  const hasher = new FakePasswordHasher();
  const clock = new FakeClock();
  return { users, hasher, clock, registerUser: new RegisterUser({ users, hasher, clock }) };
}

describe('RegisterUser', () => {
  it('[AC-AUT-02] registra un usuario válido y devuelve id y email normalizado', async () => {
    const { users, clock, registerUser } = setup();

    const result = await registerUser.execute({
      email: '  Nuevo@FluxOne.Test ',
      password: PASSWORD,
    });

    expect(result.email).toBe('nuevo@fluxone.test');
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(users.users).toHaveLength(1);
    expect(users.users[0]).toMatchObject({
      id: result.id,
      email: 'nuevo@fluxone.test',
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });
  });

  it('[AC-AUT-01] guarda solo la huella de la contraseña, nunca el texto plano ni en el resultado', async () => {
    const { users, registerUser } = setup();

    const result = await registerUser.execute({ email: 'a@fluxone.test', password: PASSWORD });

    expect(users.users[0]?.passwordHash).toBe(`hashed:${PASSWORD}`);
    expect(JSON.stringify(users.users[0])).not.toContain(`"${PASSWORD}"`);
    expect(Object.keys(result).sort()).toEqual(['email', 'id']);
  });

  it('[AC-AUT-03] un email ya registrado (aun con otra capitalización) lanza EmailAlreadyRegisteredError', async () => {
    const { users, registerUser } = setup();
    await registerUser.execute({ email: 'a@fluxone.test', password: PASSWORD });

    await expect(
      registerUser.execute({ email: 'A@Fluxone.test', password: PASSWORD }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(users.users).toHaveLength(1);
  });

  it('[AC-AUT-04] un email inválido lanza ValidationError sin hashear ni insertar', async () => {
    const { users, hasher, registerUser } = setup();

    await expect(
      registerUser.execute({ email: 'no-es-email', password: PASSWORD }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(hasher.hashCalls).toHaveLength(0);
    expect(users.users).toHaveLength(0);
  });

  it('[AC-AUT-04] una contraseña de 11 caracteres lanza ValidationError sin insertar', async () => {
    const { users, registerUser } = setup();

    await expect(
      registerUser.execute({ email: 'a@fluxone.test', password: 'a'.repeat(11) }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(users.users).toHaveLength(0);
  });
});
