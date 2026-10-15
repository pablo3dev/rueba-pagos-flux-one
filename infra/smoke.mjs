import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const authBase = process.env.AUTH_BASE_URL ?? 'http://127.0.0.1:3001';
const paymentsBase = process.env.PAYMENTS_BASE_URL ?? 'http://127.0.0.1:3002';
const demoPassword = process.env.DEMO_USERS_PASSWORD ?? 'Fluxone-Demo-2026!';

async function readJson(response) {
  const text = await response.text();
  if (text === '') return {};
  return JSON.parse(text);
}

async function loginDemo() {
  const response = await fetch(`${authBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'alice@fluxone.test', password: demoPassword }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await readJson(response);
  if (!response.ok || typeof body.accessToken !== 'string') {
    throw new Error(`login demo falló (${response.status})`);
  }
  console.log('OK login demo alice@fluxone.test');
  return body.accessToken;
}

async function transferAndStatus(accessToken) {
  const response = await fetch(`${paymentsBase}/transfers`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify({
      type: 'INTERNAL',
      fromAccountId: 'ACC-001',
      toAccountId: 'ACC-002',
      amount: '1.00',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const created = await readJson(response);
  if (response.status !== 201 || typeof created.id !== 'string' || typeof created.status !== 'string') {
    throw new Error(`transferencia interna falló (${response.status})`);
  }
  console.log(`OK transferencia interna ${created.id} estado ${created.status}`);

  const statusResponse = await fetch(`${paymentsBase}/transfers/${created.id}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  const current = await readJson(statusResponse);
  if (statusResponse.status !== 200 || current.status !== created.status) {
    throw new Error(`consulta de estado falló (${statusResponse.status})`);
  }
  console.log(`OK estado ${created.id} = ${current.status}`);
}

const paymentsPresent = existsSync(path.join(root, 'services', 'payments'));

try {
  const accessToken = await loginDemo();
  if (!paymentsPresent) {
    console.log(
      'SKIP payments: services/payments no está en este worktree; no se crea la transferencia interna ni se consulta su estado.',
    );
    process.exit(0);
  }
  await transferAndStatus(accessToken);
} catch (error) {
  const message = error instanceof Error ? error.message : 'smoke falló';
  console.error(message);
  process.exit(1);
}
