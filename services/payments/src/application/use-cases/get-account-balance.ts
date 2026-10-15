// port: in — consultar el saldo de una cuenta propia
import { AccountNotFoundError } from '../../domain/errors.js';
import type { AccountRepository } from '../ports/account-repository.js';
import { toBalanceView, type BalanceView } from '../views.js';

export class GetAccountBalance {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(input: { userId: string; accountId: string }): Promise<BalanceView> {
    const account = await this.accounts.findOwned(input.accountId, input.userId);
    if (!account) throw new AccountNotFoundError();
    return toBalanceView(account);
  }
}
