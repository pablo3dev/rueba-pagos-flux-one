// port: out — persistencia de usuarios
import type { User } from '../../domain/user.js';

export interface UserRepository {
  insert(user: User): Promise<void>; // lanza EmailAlreadyRegisteredError
  insertIfAbsent(user: User): Promise<void>; // INSERT ... ON CONFLICT DO NOTHING
  findByEmail(email: string): Promise<User | null>; // recibe el email ya normalizado
  findById(id: string): Promise<User | null>;
}
