// port: in — listar cuentas del usuario
import type { AccountRepository } from '../ports/account-repository.js';
import { toAccountView, type AccountView } from '../views.js';

export class ListAccounts {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(input: { userId: string }): Promise<AccountView[]> {
    const rows = await this.accounts.findByOwner(input.userId);
    return rows.map((account) => toAccountView(account));
  }
}
