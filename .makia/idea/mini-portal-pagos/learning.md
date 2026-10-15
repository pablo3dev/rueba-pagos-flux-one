Material de referencia técnico crudo que CODE consulta en IMPLEMENT en vez de volver a Context7/Web.
Versiones fijadas para el proyecto (dependencias nuevas, estables a oct-2026, verificadas en registry.npmjs.org / Docker Hub / docs oficiales).

## 0. Matriz de versiones cerrada

| Ámbito | Paquete / imagen | Versión |
| --- | --- | --- |
| Runtime | Node.js LTS | 24.22.0 |
| Runtime | Imagen Docker Node (todos los Dockerfile, incl. build frontend) | `node:24.22.0-alpine` |
| Raíz devDependencies | typescript | 6.0.3 |
| Raíz devDependencies | @types/node | 24.19.2 |
| Raíz devDependencies | eslint | 10.12.0 |
| Raíz devDependencies | @eslint/js | 10.0.1 |
| Raíz devDependencies | typescript-eslint | 8.71.2 |
| Raíz devDependencies | eslint-config-prettier | 10.1.8 |
| Raíz devDependencies | globals | 17.13.0 |
| Raíz devDependencies | prettier | 3.9.10 |
| Raíz devDependencies | vitest | 5.0.5 |
| Raíz devDependencies | lefthook | 2.1.12 |
| Backend dependencies | fastify | 5.12.7 |
| Backend dependencies | pg | 8.23.1 |
| Backend dependencies | node-pg-migrate | 9.0.0 |
| Backend dependencies | jose | 6.2.12 |
| Backend dependencies | @node-rs/argon2 | 2.2.2 |
| Backend dependencies | @fastify/rate-limit | 11.2.1 |
| Backend dependencies | @fastify/cookie | 11.1.3 |
| Backend dependencies | amqplib | 2.2.0 (tipos incluidos; NO instalar @types/amqplib) |
| Backend devDependencies | @types/pg | 8.23.1 |
| Backend devDependencies | tsx | 4.23.15 |
| Backend devDependencies | testcontainers | 12.2.1 |
| Backend devDependencies | @testcontainers/postgresql | 12.2.1 |
| Frontend dependencies | react | 19.3.1 |
| Frontend dependencies | react-dom | 19.3.1 |
| Frontend dependencies | react-router | 8.4.0 |
| Frontend dependencies | @tanstack/react-query | 5.104.3 |
| Frontend devDependencies | @types/react | 19.3.0 |
| Frontend devDependencies | @types/react-dom | 19.3.0 |
| Frontend devDependencies | vite | 8.3.4 |
| Frontend devDependencies | @vitejs/plugin-react | 6.1.2 |
| Frontend devDependencies | eslint-plugin-react-hooks | 7.1.1 |
| Frontend devDependencies | eslint-plugin-react-refresh | 0.5.7 |
| Frontend devDependencies | @testing-library/react | 16.3.3 |
| Frontend devDependencies | @testing-library/dom | 10.4.1 |
| Frontend devDependencies | @testing-library/user-event | 14.6.8 |
| Frontend devDependencies | @testing-library/jest-dom | 6.9.1 |
| Frontend devDependencies | jsdom | 30.1.3 |
| Imágenes | PostgreSQL | `postgres:18.6-alpine` |
| Imágenes | RabbitMQ | `rabbitmq:4.3.6-management-alpine` |
| Imágenes | nginx | `nginx:1.30.6-alpine` |

**Notas de compatibilidad (evidencia):** TypeScript 7.0.2 (nativo Go) NO se usa: no expone `./lib/typescript.js` y typescript-eslint 8.71.2 exige peer `typescript ">=4.8.4 <6.1.0"` y `eslint "^8.57.0 || ^9.0.0 || ^10.0.0"`. eslint 10.12.0 engines `^20.19.0 || ^22.13.0 || >=24`; @eslint/js 10.0.1 peer eslint ^10; react-hooks 7.1.1 y react-refresh 0.5.7 soportan eslint ^10; vitest 5.0.5 engines `^22.12.0 || ^24.0.0 || >=26.0.0`, peer vite `^6.4.0 || ^7.0.0 || ^8.0.0`; @vitejs/plugin-react 6.1.2 peer vite ^8; node-pg-migrate 9.0.0 `type: module`, peer `pg >=4.3.0 <9.0.0`; react-router 8.4.0 engines node >=22.22.0, peer react >=19.2.7, `react-router-dom` eliminado en v8; @types/node 24.19.2 es la línea de Node 24 (latest 26.x es Node 26, no usar).

**Fuente:** registry.npmjs.org, Docker Hub (2026-10-15).

---

## 1. TypeScript + Node ESM + Docker multi-stage

**Versión:** Node.js 24.22.0; imagen `node:24.22.0-alpine`; TypeScript 6.0.3 (raíz).

**Instalación:** `"type": "module"` en cada `package.json`. Dev: `npx tsx watch src/main.ts`. Typecheck: `npx tsc --noEmit -p <ws>/tsconfig.json`.

**Snippet — tsconfig:**

```json
{
  "compilerOptions": {
    "target": "ES2024", "module": "NodeNext", "moduleResolution": "NodeNext",
    "rootDir": "src", "outDir": "dist", "strict": true, "verbatimModuleSyntax": true, "skipLibCheck": true
  },
  "include": ["src"]
}
```

**Snippet — Dockerfile de servicio en monorepo (contexto = raíz):**

Etapa build: `FROM node:24.22.0-alpine AS build`, `WORKDIR /app`, `COPY package.json package-lock.json ./`, `COPY tsconfig.base.json ./`, `COPY services/payments/package.json ./services/payments/`, `RUN npm ci --workspace=services/payments --include-workspace-root=false`, `COPY services/payments ./services/payments`, `RUN npm run build -w services/payments`.

Etapa runtime: `FROM node:24.22.0-alpine`, `ENV NODE_ENV=production`, mismos COPY de package*.json, `RUN npm ci --omit=dev --workspace=services/payments --include-workspace-root=false`, `COPY --from=build /app/services/payments/dist ./services/payments/dist`, `USER node`, `CMD ["node","services/payments/dist/main.js"]`.

**Verificación:** build de imagen y arranque con `node services/payments/dist/main.js`.

**Nota:** si aparece el bug npm cli #8974 "Exit handler never called" en alpine, usar `node:24.22.0-bookworm-slim`.

**Fuente:** Node.js docs; Docker Hub `node:24.22.0-alpine`.

---

## 2. Fastify 5.12.7

**Versión:** fastify 5.12.7.

**Instalación:** dependencia backend `fastify@5.12.7`.

**Snippet:**

```ts
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';

export const buildApp = () => {
  const app = Fastify({
    logger: { level: 'info', redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'] },
    requestIdHeader: 'x-request-id',
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
  });
  app.addHook('onRequest', async (req, reply) => {
    if (!req.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
  });
  app.post('/pay', {
    schema: {
      body: { type: 'object', required: ['amount'], properties: { amount: { type: 'string' } }, additionalProperties: false },
      response: { 200: { type: 'object', properties: { reqId: { type: 'string' } } } },
    },
  }, async (req) => ({ reqId: req.id }));
  return app;
};
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => { await app.close(); process.exit(0); });
}
```

**Verificación:** `const res = await app.inject({ method: 'POST', url: '/pay', headers: { authorization: 'Bearer x', 'x-request-id': 'id-1' }, payload: { amount: '10.00' } }); // res.statusCode === 200`.

**Fuente:** fastify.dev/docs/latest.

---

## 3. pg 8.23.1

**Versión:** pg 8.23.1.

**Instalación:** dependencia backend `pg@8.23.1`.

**Snippet:**

```ts
import { Pool, types, type PoolClient } from 'pg';
types.setTypeParser(1700, (val: string) => val); // OID 1700 = NUMERIC -> string exacto

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c search_path=payment_schema',
});
export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const res = await fn(client); await client.query('COMMIT'); return res; }
  catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
```

**Verificación:** `SELECT 12.34::numeric AS n, current_schema() AS s` → `{ n: '12.34', s: 'payment_schema' }`. pg devuelve NUMERIC (1700) y BIGINT (20) como string por defecto. Timeout de espera de lock por sentencia: `SET LOCAL statement_timeout = '5s'` dentro de la transacción (SQLSTATE `57014` al exceder).

**Fuente:** node-postgres.com.

---

## 4. node-pg-migrate 9.0.0

**Versión:** node-pg-migrate 9.0.0.

**Instalación:** dependencia backend `node-pg-migrate@9.0.0`.

**CLI:** `npx node-pg-migrate create init -j sql` | `npx node-pg-migrate up --schema payment_schema --create-schema --migrations-table pgmigrations` | dry-run `npx node-pg-migrate up --dry-run --schema payment_schema --migrations-table pgmigrations`.

**Snippet — programático al arrancar (v9: `migrationsTable` obligatorio):**

```ts
import { runner } from 'node-pg-migrate';
await runner({
  databaseUrl: process.env.DATABASE_URL!, dir: `${import.meta.dirname}/migrations`,
  direction: 'up', schema: 'payment_schema', createSchema: true, migrationsTable: 'pgmigrations',
});
```

**Snippet — migración TS ejemplo:**

```ts
import type { MigrationBuilder } from 'node-pg-migrate';
export async function up(pgm: MigrationBuilder): Promise<void> { pgm.sql('CREATE TABLE accounts (id uuid PRIMARY KEY, balance numeric(18,2) NOT NULL);'); }
export async function down(pgm: MigrationBuilder): Promise<void> { pgm.dropTable('accounts'); }
```

**Verificación:** `npx node-pg-migrate up --dry-run --schema payment_schema --migrations-table pgmigrations` sin error.

**Nota:** v9 carga `.ts`/`.sql` vía jiti incluido.

**Fuente:** salsita.github.io/node-pg-migrate/api.

---

## 5. jose 6.2.12 (EdDSA Ed25519, JWKS)

**Versión:** jose 6.2.12.

**Instalación:** dependencia backend `jose@6.2.12`.

**Snippet:**

```ts
import { SignJWT, generateKeyPair, exportJWK, importPKCS8, createRemoteJWKSet, jwtVerify } from 'jose';
// jose v6: extractable es false por defecto; pasar { extractable: true } si se exporta o persiste
const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true }); // o importPKCS8(pem, 'EdDSA')
const publicJwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'EdDSA', use: 'sig' }; // GET /.well-known/jwks.json -> { keys: [publicJwk] }
const token = await new SignJWT({ sub: 'u1', scope: 'payments' })
  .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' }).setIssuedAt().setIssuer('urn:fluxone:auth').setAudience('urn:fluxone:payments').setExpirationTime('15m').sign(privateKey);
const JWKS = createRemoteJWKSet(new URL('http://auth:3000/.well-known/jwks.json'));
const { payload } = await jwtVerify(token, JWKS, { issuer: 'urn:fluxone:auth', audience: 'urn:fluxone:payments', clockTolerance: '5s' });
```

**Verificación:** Tests: `createLocalJWKSet({ keys: [publicJwk] })`. Persistir la privada en PKCS8: `exportPKCS8(privateKey)` (export de jose) y recargar con `importPKCS8(pem, 'EdDSA')`.

**Fuente:** registry.npmjs.org/jose.

---

## 6. @node-rs/argon2 2.2.2

**Versión:** @node-rs/argon2 2.2.2 (elegido sobre argon2 0.45.1).

**Instalación:** dependencia backend `@node-rs/argon2@2.2.2`.

**Motivo:** N-API Rust prebuilt para linux-x64-musl/linux-arm64-musl, 0 deps, sin node-gyp ni postinstall; `argon2` 0.45.1 cae a compilar con python3/make/g++ en Alpine si falta prebuild.

**Snippet:**

```ts
import { hash, verify, Algorithm } from '@node-rs/argon2';
const OWASP_OPTS = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const digest = await hash(plainPassword, OWASP_OPTS);
const isValid = await verify(digest, plainPassword, OWASP_OPTS);
```

**Verificación:** `digest.startsWith('$argon2id$v=19$m=19456,t=2,p=1$') && isValid === true`.

**Fuente:** registry.npmjs.org/@node-rs/argon2.

---

## 7. @fastify/rate-limit 11.2.1 y @fastify/cookie 11.1.3

**Versión:** @fastify/rate-limit 11.2.1; @fastify/cookie 11.1.3.

**Instalación:** dependencias backend `@fastify/rate-limit@11.2.1`, `@fastify/cookie@11.1.3`.

**Snippet:**

```ts
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
await app.register(cookie, { secret: process.env.COOKIE_SECRET }); // >= 32 bytes
await app.register(rateLimit, { global: false });
app.post('/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
  reply.setCookie('refresh_token', token, { httpOnly: true, sameSite: 'strict', secure: true, path: '/auth/refresh', maxAge: 604800 });
  return { ok: true };
});
```

**Verificación:** 6 llamadas `app.inject` → la 6ª `429` con header `retry-after`; la 1ª trae `set-cookie` con `HttpOnly; Secure; SameSite=Strict`.

**Fuente:** registry.npmjs.org (@fastify/rate-limit, @fastify/cookie).

---

## 8. fetch nativo Node 24 con timeout de 10 s

**Versión:** Node.js 24.22.0 (fetch nativo).

**Instalación:** sin paquete adicional.

**Snippet:**

```typescript
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
} catch (err: unknown) {
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    // Timeout (>10s) o abort explícito
  } else if (err instanceof TypeError && (err as { cause?: { code?: string } }).cause?.code) {
    const code = (err as { cause: { code: string } }).cause.code; // 'ECONNREFUSED' | 'ENOTFOUND' | 'ECONNRESET'
  } else {
    throw err;
  }
}
```

**Verificación:** `AbortSignal.timeout(ms)` lanza DOMException `name === 'TimeoutError'`; fallos de socket/DNS lanzan `TypeError('fetch failed')` con `err.cause.code`.

**Fuente:** Node.js docs (fetch, AbortSignal.timeout).

---

## 9. RabbitMQ 4.3.6 + amqplib 2.2.0

**Versión:** imagen `rabbitmq:4.3.6-management-alpine`; amqplib 2.2.0.

**Instalación:** dependencia backend `amqplib@2.2.0` (NO `@types/amqplib`).

**Snippet — Compose:**

```yaml
  rabbitmq:
    image: rabbitmq:4.3.6-management-alpine
    hostname: rabbitmq
    ports: ["5672:5672", "15672:15672"]
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
      RABBITMQ_DEFAULT_VHOST: /fluxone
    volumes: ["rabbitmq_data:/var/lib/rabbitmq"]
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
```

**Topología de referencia (LEARN):** exchange `topic` durable; DLX `direct` durable + cola DLQ quorum; cola principal `{ durable: true, arguments: { 'x-queue-type': 'quorum', 'x-dead-letter-exchange': ..., 'x-dead-letter-routing-key': ..., 'x-delivery-limit': 5 } }` (`x-queue-type` inmutable tras crearse). amqplib ≥ v1.1/v2 trae `.d.ts` nativos; compatible con RabbitMQ 4.1+; en v2 `heartbeat: 0` desactiva heartbeats (omitir para usar default del servidor). Alternativa evaluada: rabbitmq-client 5.0.8 (reconexión automática) — no elegida (menor adopción: ~124k vs ~3M descargas/sem).

**Snippet — cliente:**

```typescript
import amqp, { ChannelModel, ConfirmChannel, ConsumeMessage } from 'amqplib';

let conn: ChannelModel | null = null;
let pubCh: ConfirmChannel | null = null;

export async function connectBroker(url: string, onConsumerReady?: (ch: ConfirmChannel) => Promise<void>): Promise<void> {
  try {
    conn = await amqp.connect(url);
    conn.on('error', (err) => console.error('AMQP conn error', err));
    conn.on('close', () => { pubCh = null; setTimeout(() => connectBroker(url, onConsumerReady), 3000); });
    pubCh = await conn.createConfirmChannel();
    await pubCh.assertExchange('audit.dlx', 'direct', { durable: true });
    await pubCh.assertQueue('audit.dlq', { durable: true, arguments: { 'x-queue-type': 'quorum' } });
    await pubCh.bindQueue('audit.dlq', 'audit.dlx', 'audit.dead');
    await pubCh.assertExchange('audit.events', 'topic', { durable: true });
    await pubCh.assertQueue('audit.events.queue', {
      durable: true,
      arguments: { 'x-queue-type': 'quorum', 'x-dead-letter-exchange': 'audit.dlx', 'x-dead-letter-routing-key': 'audit.dead', 'x-delivery-limit': 5 }
    });
    await pubCh.bindQueue('audit.events.queue', 'audit.events', 'transfer.*');
    if (onConsumerReady) await onConsumerReady(pubCh);
  } catch { setTimeout(() => connectBroker(url, onConsumerReady), 3000); }
}

export async function publishAuditEvent(routingKey: string, eventId: string, payload: unknown): Promise<void> {
  if (!pubCh) throw new Error('Broker channel not ready');
  pubCh.publish('audit.events', routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true, messageId: eventId, contentType: 'application/json', timestamp: Date.now()
  });
  await pubCh.waitForConfirms();
}

export async function startAuditConsumer(ch: ConfirmChannel, saveIdempotent: (id: string, data: unknown) => Promise<void>): Promise<void> {
  await ch.prefetch(10);
  await ch.consume('audit.events.queue', async (msg: ConsumeMessage | null) => {
    if (!msg) return;
    try {
      await saveIdempotent(msg.properties.messageId, JSON.parse(msg.content.toString()));
      ch.ack(msg); // ack manual SOLO tras commit en DB
    } catch { ch.nack(msg, false, true); } // requeue hasta x-delivery-limit (5), luego DLQ
  }, { noAck: false });
}
```

**Verificación:** healthcheck `rabbitmq-diagnostics -q ping`; publish + `waitForConfirms`.

**Nota:** los nombres `audit.events.queue`, `audit.dlq`, binding `transfer.*` del snippet son de referencia; los nombres OFICIALES del proyecto son los de draft.md (exchange `audit.events`, cola `audit.transfer-events`, DLX `audit.dlx`, DLQ `audit.transfer-events.dlq`, routing key DLQ `audit.transfer-events.dead`, binding `transfer.#`).

**Fuente:** rabbitmq.com/docs/quorum-queues, rabbitmq.com/docs/dlx, npmjs.com/package/amqplib.

---

## 10. Transactional Outbox (PostgreSQL)

**Versión:** PostgreSQL 18.6; patrón outbox en esquema `payment_schema`.

**Instalación:** tablas y SQL en migraciones; sin dependencia npm adicional para el patrón.

**Snippet:**

```sql
SELECT id, event_type, payload, attempts FROM payment_schema.outbox_events
WHERE published_at IS NULL AND next_attempt_at <= NOW()
ORDER BY created_at ASC, id ASC FOR UPDATE SKIP LOCKED LIMIT 50;
-- tras publish + waitForConfirms OK:
UPDATE payment_schema.outbox_events SET published_at = NOW() WHERE id = $1;
-- si falla el broker (backoff exponencial con tope 60 s):
UPDATE payment_schema.outbox_events
SET attempts = attempts + 1, last_error = $2, next_attempt_at = NOW() + (LEAST(2 ^ attempts, 60) || ' seconds')::INTERVAL
WHERE id = $1;
-- consumidor idempotente:
INSERT INTO audit_schema.audit_entries (...) VALUES (...) ON CONFLICT (event_id) DO NOTHING;
```

**Verificación:** filas publicadas con `published_at` tras confirmación AMQP; reintentos con `next_attempt_at`.

**Descartes:** Debezium CDC (requiere Kafka Connect, `wal_level=logical`); LISTEN/NOTIFY (efímero, se pierde si el receptor cae; solo útil como wake-up opcional).

**Fuente:** microservices.io/patterns/data/transactional-outbox.html.

---

## 11. PostgreSQL 18.6 en Docker

**Versión:** `postgres:18.6-alpine`.

**Instalación:** servicio Compose con volumen en `/var/lib/postgresql` (PGDATA por defecto `/var/lib/postgresql/18/docker`). `/docker-entrypoint-initdb.d/` corre SOLO con directorio de datos vacío, orden alfabético (LC_ALL=C); `.sql` vía `psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"`; `.sh` ejecutados si +x o sourced.

**Healthcheck:** `["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB} -h 127.0.0.1 -p 5432"]`.

**Formato:** `.sh` y `.sql` montados desde Windows en LF, UTF-8 sin BOM (CRLF rompe shebang `/bin/sh\r`).

**Snippet — rol por esquema:**

```sql
REVOKE CREATE, USAGE ON SCHEMA public FROM PUBLIC;
REVOKE CONNECT ON DATABASE fluxone FROM PUBLIC;
CREATE ROLE payment_svc LOGIN PASSWORD 'secret' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT CONNECT ON DATABASE fluxone TO payment_svc;
CREATE SCHEMA payment_schema AUTHORIZATION payment_svc;
ALTER ROLE payment_svc IN DATABASE fluxone SET search_path = payment_schema;
ALTER DEFAULT PRIVILEGES FOR ROLE payment_svc IN SCHEMA payment_schema
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO payment_svc;
```

(repetir para auth_svc/auth_schema y audit_svc/audit_schema).

**Verificación:** `SET SESSION AUTHORIZATION payment_svc; SELECT * FROM auth_schema.users;` → `ERROR: permission denied for schema auth_schema` (SQLSTATE 42501); `SELECT has_schema_privilege('payment_svc','auth_schema','USAGE')` → false. Nota: no ejecutar `SET SESSION AUTHORIZATION` con LOGIN de otro rol; la prueba se hace como superusuario.

**Fuente:** Docker Hub `postgres:18.6-alpine`; postgresql.org docs.

---

## 12. Idempotency-Key concurrente

**Versión:** PostgreSQL 18.6 (READ COMMITTED).

**Instalación:** lógica en aplicación + constraints SQL según draft/spec.

**Semántica:** en READ COMMITTED, si Tx1 y Tx2 insertan la misma PK, Tx2 se bloquea hasta COMMIT/ROLLBACK de Tx1; con COMMIT de Tx1, Tx2 obtiene 0 filas en `INSERT ... ON CONFLICT DO NOTHING RETURNING *`; con ROLLBACK, Tx2 inserta. Códigos IETF: 400 falta clave; 409 petición en curso; 422 misma clave con payload distinto; COMPLETED → devolver respuesta almacenada.

**Snippet alternativo:** `SELECT pg_try_advisory_xact_lock(hashtextextended(scope || ':' || key, 0));`.

**Verificación:** dos transacciones concurrentes con misma clave; comportamiento según COMMIT/ROLLBACK de la primera.

**Fuente:** postgresql.org/docs/current/sql-insert.html, draft-ietf-httpapi-idempotency-key-header-07, brandur.org/idempotency-keys, stripe.com/blog/idempotency.

---

## 13. Débito sin saldo negativo y deadlocks

**Versión:** PostgreSQL 18.6.

**Instalación:** `CHECK (balance >= 0)` en migración.

**Snippet:**

`CHECK (balance >= 0)`; `UPDATE payment_schema.accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING id, balance;` (0 filas = saldo insuficiente; READ COMMITTED re-evalúa el WHERE contra la última versión). Antes de mover saldos entre dos cuentas: `SELECT id, balance FROM payment_schema.accounts WHERE id IN ($1, $2) ORDER BY id ASC FOR UPDATE;`.

**Verificación:** UPDATE con saldo insuficiente devuelve 0 filas; orden `ORDER BY id ASC FOR UPDATE` evita deadlock en transferencias.

**Fuente:** postgresql.org/docs/current/explicit-locking.html.

---

## 14. Dinero COP en dominio (BigInt centavos)

**Versión:** ISO 4217 COP (170) minor unit = 2.

**Instalación:** sin dependencia npm; lógica en dominio TypeScript.

**Snippet — parseo y serialización:**

Parseo: validar `/^\d+(\.\d{1,2})?$/`, `const [int, frac = ''] = s.split('.'); const cents = BigInt(int) * 100n + BigInt(frac.padEnd(2, '0'));`.

Serialización: `const abs = cents < 0n ? -cents : cents; const str = \`${cents < 0n ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}\`;`.

**Verificación:** round-trip string ↔ centavos; pasar a pg como string.

**Fuente:** ISO 4217 COP.

---

## 15. Docker Compose (Compose Specification, sin `version:`)

**Versión:** Compose Specification; imágenes según §0.

**Instalación:** archivo `compose.yaml` en raíz o `infra/`.

**Snippet:**

```yaml
services:
  postgres:
    image: postgres:18.6-alpine
    env_file: [.env]
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports: ["5432:5432"]
    volumes:
      - pg_data:/var/lib/postgresql
      - ./infra/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB} -h 127.0.0.1 -p 5432"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
  payments:
    build: { context: ., dockerfile: services/payments/Dockerfile }
    env_file: [.env]
    depends_on:
      postgres: { condition: service_healthy }
volumes:
  pg_data:
```

**Verificación:** `depends_on.condition`: `service_healthy` | `service_completed_successfully` | `service_started`.

**Fuente:** docs.docker.com/reference/compose-file/.

---

## 16. Frontend

**Versión:** react 19.3.1, react-dom 19.3.1, react-router 8.4.0, @tanstack/react-query 5.104.3; vite 8.3.4, @vitejs/plugin-react 6.1.2; nginx `nginx:1.30.6-alpine`; Node build `node:24.22.0-alpine`.

**Instalación:** `npm i -w apps/web react@19.3.1 react-dom@19.3.1 react-router@8.4.0 @tanstack/react-query@5.104.3 && npm i -D -w apps/web vite@8.3.4 @vitejs/plugin-react@6.1.2 @types/react@19.3.0 @types/react-dom@19.3.0`.

**Snippet:**

```tsx
// vite.config.ts
import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; export default defineConfig({ plugins: [react()] });
// router v8: createBrowserRouter desde 'react-router'; RouterProvider desde 'react-router/dom'
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
// polling que se detiene en estado terminal
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'REVERSED']);
const query = useQuery({
  queryKey: ['transfer', id], queryFn: () => fetchTransfer(id),
  refetchInterval: (q) => (q.state.data && TERMINAL.has(q.state.data.status) ? false : 1000),
});
const mutation = useMutation({ mutationFn: createTransfer });
// <button type="submit" disabled={mutation.isPending}>Enviar</button>
```

**Snippet — nginx `apps/web/nginx/default.conf`:**

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
  location /api/auth/     { proxy_pass http://auth:3001/;     proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
  location /api/payments/ { proxy_pass http://payments:3002/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
  location /api/audit/    { proxy_pass http://audit:3003/;    proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
```

(con `/` final en location y proxy_pass se recorta el prefijo: `/api/payments/foo` → upstream `/foo`; sin `/` final en proxy_pass se reenvía la URI completa).

**Dockerfile web (contexto raíz):** build `FROM node:24.22.0-alpine AS build` … `RUN npm ci --workspace=apps/web --include-workspace-root=false`, `RUN npm run build -w apps/web`; runtime `FROM nginx:1.30.6-alpine`, `COPY apps/web/nginx/default.conf /etc/nginx/conf.d/default.conf`, `COPY --from=build /app/apps/web/dist /usr/share/nginx/html`, `EXPOSE 80`.

**Verificación:** build Vite; SPA routing vía `try_files`; proxy API según prefijos.

**Fuente:** registry.npmjs.org (react, react-router, vite); nginx docs.

---

## 17. Testing

**Versión:** vitest 5.0.5; @testing-library/react 16.3.3; @testing-library/dom 10.4.1; @testing-library/user-event 14.6.8; @testing-library/jest-dom 6.9.1; jsdom 30.1.3; testcontainers 12.2.1; @testcontainers/postgresql 12.2.1.

**Instalación:** `npm i -D vitest@5.0.5 @testing-library/react@16.3.3 @testing-library/dom@10.4.1 @testing-library/user-event@14.6.8 @testing-library/jest-dom@6.9.1 jsdom@30.1.3 testcontainers@12.2.1 @testcontainers/postgresql@12.2.1`.

**Snippet:**

```ts
// vitest.config.ts (apps/web: environment 'jsdom'; services/*: environment 'node' + globalSetup)
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', globals: true, globalSetup: ['./tests/global-setup.ts'] } });
// tests/global-setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
export default async function setup() {
  const container = await new PostgreSqlContainer('postgres:18.6-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  return async () => { await container.stop(); };
}
```

**Verificación:** Windows 11 + Docker Desktop (WSL2): Testcontainers detecta `//./pipe/docker_engine`; mantener Ryuk habilitado.

**Fuente:** registry.npmjs.org (vitest, testcontainers).

---

## 18. npm workspaces

**Versión:** Node.js 24.22.0; npm workspaces.

**Instalación — raíz `package.json`:**

```json
{ "name": "fluxone-payment", "private": true, "type": "module", "engines": { "node": "24.22.0" }, "workspaces": ["apps/*", "services/*"] }
```

**Comandos:** `npm run test -w services/payments`; `npm run test --workspaces --if-present`; `npm run build --workspaces --if-present`.

**Verificación:** `npm ci` en raíz instala workspaces.

**Fuente:** docs.npmjs.com (workspaces).

---

## 19. Verificación local: lefthook 2.1.12 + ESLint 10 + Prettier 3

**Versión:** lefthook 2.1.12; eslint 10.12.0; @eslint/js 10.0.1; typescript-eslint 8.71.2; eslint-config-prettier 10.1.8; globals 17.13.0; prettier 3.9.10; eslint-plugin-react-hooks 7.1.1; eslint-plugin-react-refresh 0.5.7 (apps/web).

**Instalación:** `npm i -D lefthook@2.1.12 eslint@10.12.0 @eslint/js@10.0.1 typescript-eslint@8.71.2 eslint-config-prettier@10.1.8 globals@17.13.0 prettier@3.9.10` y en apps/web `eslint-plugin-react-hooks@7.1.1 eslint-plugin-react-refresh@0.5.7`; luego `npx lefthook install`.

**Snippet — eslint.config.js (raíz):**

```js
// eslint.config.js (raíz)
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite(),
  prettierConfig,
);
```

(`tseslint.config()` está deprecado en typescript-eslint v8 tardío: usar `defineConfig` de `eslint/config`).

**`.prettierrc`:** `{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100, "endOfLine": "lf" }`.

**`.gitattributes`:** `* text=auto eol=lf`, `*.sh text eol=lf`, `Dockerfile* text eol=lf`, `*.cmd text eol=crlf`, `*.bat text eol=crlf`, `*.ps1 text eol=crlf`.

Scripts de contenedor: `#!/bin/sh`, UTF-8 sin BOM, LF, `chmod +x` (o `RUN chmod +x`).

**Comandos de verificación:** `npx eslint . --max-warnings 0`, `npx prettier --check .`, `npx tsc --noEmit -p services/payments/tsconfig.json`.

**Fuente:** registry.npmjs.org (eslint, lefthook, prettier).

---

## 20. Lo no verificado en ejecución

LEARN verificó contra registry.npmjs.org, Docker Hub y docs/.d.ts publicados (2026-10-15) sin ejecutar npm/docker localmente (modo lectura). La primera tarea de IMPLEMENT que instale dependencias debe correr `npm ci` y `npx tsc --noEmit` como verificación.

**Fuente:** criterio de cierre LEARN (2026-10-15).
