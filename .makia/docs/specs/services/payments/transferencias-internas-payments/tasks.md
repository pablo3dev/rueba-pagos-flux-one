# Implementation Tasks: Transferencias internas (servicio de pagos `services/payments`)

## 1. Metadata & Traceability
- **Spec:** `transferencias-internas-payments`
- **Requirements Ref:** `requirements.md` (spec: `transferencias-internas-payments`)
- **Design Ref:** `design.md` (spec: `transferencias-internas-payments`)

`[P]`: puede ejecutarse en paralelo (archivos distintos, sin dependencias entre sí).

Rutas relativas a la raíz del repositorio. Prefijo de todo comando (nada se instala ni ejecuta en el host): `docker compose -f services/payments/compose.dev.yaml`. Sin DB: `run --rm --no-deps dev <cmd>`; con DB: `run --rm dev <cmd>`.

---

## 2. Execution Guidelines
- **Sequential Ordering:** ejecutar las fases en orden estricto (datos primero: andamiaje, migraciones y semilla; luego dominio y casos de uso; luego adaptadores HTTP, idempotencia, JWT y OpenAPI; al final verificación); dentro de cada fase, las subtareas se completan antes de pasar a la siguiente, salvo las marcadas `[P]`.
- **Test-Verified:** cada funcionalidad debe tener su prueba correspondiente antes de marcarse `[x]`. El nombre de cada prueba incluye su ID, por ejemplo `it('[AC-TRI-06] ...')`; imports explícitos de `vitest` (sin globals).
- **Evidencia de comportamiento crítico:** las tareas marcadas `Evidencia` (idempotencia concurrente, saldo no negativo, A→B / B→A sin interbloqueo, visibilidad 404, verificación JWT) se marcan `[x]` solo con la salida del comando que muestre cada prueba con su ID `[AC-TRI-NN]` en estado aprobado (usar `--reporter=verbose`).
- **Alcance acotado:** cada tarea se valida con las pruebas de sus propios archivos, más tipos, lint y formato sobre sus rutas; la suite completa se ejecuta en la tarea 4.2.
- **Archivos exactos:** cada tarea toca únicamente los archivos que lista, que coinciden con la tabla de `design.md` §5. Los archivos que otra tarea ya creó y esta modifica figuran como "Modificar".
- **Convenciones:** LF, ESM `module NodeNext` con imports relativos con extensión `.js`, `import type` para tipos, consultas parametrizadas con nombres `payment_schema.<tabla>`, versiones exactas sin `^` ni `~`.
- **Traceability Tags:** cada tarea referencia su origen en `requirements.md` (ej. `[REQ-1.1]`) y su componente en `design.md` (ej. `[DESIGN §5]`).

---

## 3. Phase Breakdown & Actionable Tasks

### Phase 1: Foundation, Schemas & Core Domain

- [ ] **Task 1.1: Andamiaje Docker del workspace y verificación del entorno** `[REQ-10.1, REQ-7.1]` `[DESIGN §2.3, §5]`
  - **Alcance:** Compose de desarrollo con los servicios `postgres` y `dev`, script de inicialización del rol `payment_svc` y el esquema `payment_schema`, y etapa `dev` del Dockerfile, con el contenido exacto de `design.md` §2.3.
  - **Archivos:** `services/payments/compose.dev.yaml` (Crear), `services/payments/docker/postgres-init/01-payments-role-schema.sh` (Crear), `services/payments/Dockerfile` (Crear).
  - **Dependencias:** ninguna (primera tarea; antes de cualquier código de producto).
  - **Criterio de aceptación (todos con exit 0 y salida indicada):**
    - `docker compose -f services/payments/compose.dev.yaml config -q`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev node --version` imprime `v24.22.0`.
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm ci`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx tsc --version` imprime la versión 6.0.3 (el chequeo `tsc --noEmit` del workspace corre en 1.2, cuando existe su `tsconfig.json`).
    - `docker compose -f services/payments/compose.dev.yaml up -d --wait postgres` y luego `docker compose -f services/payments/compose.dev.yaml exec -T postgres psql -U postgres -d fluxone -tAc "SELECT r.rolname, n.nspname FROM pg_roles r JOIN pg_namespace n ON n.nspowner = r.oid WHERE r.rolname = 'payment_svc'"` imprime `payment_svc|payment_schema`; limpieza con `docker compose -f services/payments/compose.dev.yaml down -v`.

- [ ] **Task 1.2: Workspace `@fluxone/payments` (dependencias y configuración TypeScript/Vitest)** `[REQ-10.1]` `[DESIGN §1, §5 Contenido exacto de la configuración del workspace]`
  - **Alcance:** `package.json` del workspace con dependencias y scripts exactos, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts` con los proyectos `unit` y `db`, y regeneración del `package-lock.json` raíz dentro del contenedor.
  - **Archivos:** `services/payments/package.json` (Crear), `services/payments/tsconfig.json` (Crear), `services/payments/tsconfig.build.json` (Crear), `services/payments/vitest.config.ts` (Crear), `package-lock.json` (Modificar).
  - **Dependencias:** 1.1.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm install`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm ci` (reproducible; cubre AC-TRI-32)
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm ls -w services/payments --depth=0` lista fastify 5.12.7, pg 8.23.1, node-pg-migrate 9.0.0, jose 6.2.12, vitest 5.0.5, tsx 4.23.15 y @types/pg 8.23.1.
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev sh -c "! grep -E '\": \"[~^]' services/payments/package.json"`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments`

- [ ] **Task 1.3: Migraciones, semilla y soporte de pruebas de DB** `[REQ-7.1]` `[DESIGN §3.2, §5 Soporte de pruebas]`
  - **Alcance:** migración 1 (tablas `accounts`, `transfers`, `idempotency_keys` con restricciones e índices) y migración 2 (semilla de ACC-001, ACC-002, ACC-003 con `ON CONFLICT DO NOTHING`), exactas a `design.md` §3.2 y `db-design.dbml`; `global-setup.ts` que solo migra; `createTestPool()` y `resetData()`; pruebas de migraciones y de entorno.
  - **Archivos:** `services/payments/migrations/1792108800000_create-payment-tables.sql` (Crear), `services/payments/migrations/1792108800001_seed-demo-accounts.sql` (Crear), `services/payments/tests/global-setup.ts` (Crear), `services/payments/tests/support/db.ts` (Crear), `services/payments/tests/integration/migrations.test.ts` (Crear), `services/payments/tests/integration/environment.test.ts` (Crear).
  - **Dependencias:** 1.1, 1.2.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/integration/migrations.test.ts tests/integration/environment.test.ts --reporter=verbose` exit 0, con las pruebas `[AC-TRI-27]` (versión 18.6, `current_user` = `payment_svc`, `CREATE SCHEMA` y `CREATE TABLE public.x` fallan con `42501`, host `postgres`, semilla de tres cuentas y saldos) y `[AC-TRI-12]` (`accounts_balance_chk` rechaza saldo negativo; también `transfers_failure_chk`, `transfers_distinct_chk`, `transfers_type_chk`, FKs y clave primaria compuesta) en estado aprobado.
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/tests --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/tests services/payments/migrations`

### Phase 2: Core Logic & Application Layer

- [ ] **Task 2.1: Dominio puro (dinero, cuenta, transferencia, idempotencia, errores)** `[REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.7, REQ-4.1, REQ-4.2, REQ-4.4, REQ-8.2]` `[DESIGN §3.1, §8.1]` — **Evidencia**
  - **Alcance:** `Money` (`parseAmount`, `formatMoney`, `moneyFromDb`), `Account` con `debit`/`credit`, `executeInternalTransfer` (COMPLETED conserva la suma; FAILED `INSUFFICIENT_FUNDS` sin cambiar saldos; misma cuenta lanza `SameAccountError`), `parseIdempotencyKey`, `canonicalJson`, `computeRequestHash` y los errores tipados. Sin imports de Fastify, `pg` ni `jose`.
  - **Archivos:** `services/payments/src/domain/errors.ts`, `services/payments/src/domain/money.ts`, `services/payments/src/domain/account.ts`, `services/payments/src/domain/transfer.ts`, `services/payments/src/domain/idempotency.ts`, `services/payments/tests/unit/money.test.ts`, `services/payments/tests/unit/account.test.ts`, `services/payments/tests/unit/transfer.test.ts`, `services/payments/tests/unit/idempotency-key.test.ts`, `services/payments/tests/unit/request-hash.test.ts` (todos Crear).
  - **Dependencias:** 1.2.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run test -w services/payments -- --project unit --reporter=verbose` exit 0. Evidencia: salida con `[AC-TRI-09]` (montos `"0"`, `"-1"`, `"1.234"`, `"01"`, número JSON, `null`, `10000000000000000` inválidos; límites `0.01` y `9999999999999999.99` válidos), `[AC-TRI-12]` (débito con saldo igual al monto deja `0n`; saldo menor lanza; la suma se conserva), `[AC-TRI-14]` (límites 1 y 255 válidos; 0 y 256 caracteres, 0x20 y 0x7F inválidos) y las pruebas de `canonicalJson` y huella de 64 hex que cambia con la operación (`[AC-TRI-17]`).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev sh -c "! grep -rEn \"from '(fastify|pg|jose)\" services/payments/src/domain"` exit 0.
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src services/payments/tests/unit --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src services/payments/tests/unit`

- [ ] **Task 2.2: Interfaces de aplicación, vistas y cursor de paginación** `[REQ-6.2, REQ-6.3, REQ-2.1, REQ-5.1]` `[DESIGN §4.1]`
  - **Alcance:** las siete interfaces de `src/application/ports/` (`Clock`, `IdGenerator`, `TokenVerifier`, `AccountRepository`, `TransferRepository` con `TransferCursor`, `IdempotencyStore`, `UnitOfWork` con `TransactionScope`), vistas de API con sus funciones de mapeo dominio → vista (saldos y montos con 2 decimales, fechas ISO con milisegundos, `failureReason` solo si FAILED) y `encodeCursor`/`decodeCursor` (base64url de `{"c","i"}`; `ValidationError` ante base64url o JSON inválido, `c` no ISO canónico o `i` no uuid).
  - **Archivos:** `services/payments/src/application/ports/clock.ts`, `services/payments/src/application/ports/id-generator.ts`, `services/payments/src/application/ports/token-verifier.ts`, `services/payments/src/application/ports/account-repository.ts`, `services/payments/src/application/ports/transfer-repository.ts`, `services/payments/src/application/ports/idempotency-store.ts`, `services/payments/src/application/ports/unit-of-work.ts`, `services/payments/src/application/views.ts`, `services/payments/src/application/transfer-cursor.ts`, `services/payments/tests/unit/transfer-cursor.test.ts` (todos Crear).
  - **Dependencias:** 2.1.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run test -w services/payments -- --project unit tests/unit/transfer-cursor.test.ts --reporter=verbose` exit 0 con `[AC-TRI-25]` aprobado (ida y vuelta; entradas inválidas lanzan `ValidationError`).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/application services/payments/tests/unit --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/application services/payments/tests/unit`

- [ ] **Task 2.3: Casos de uso de consulta (cuentas, saldo, transferencia, historial)** `[REQ-2.1, REQ-2.2, REQ-2.3, REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4]` `[DESIGN §4.1 Casos de uso]` — **Evidencia**
  - **Alcance:** `ListAccounts`, `GetAccountBalance` (`AccountNotFoundError` si `findOwned` devuelve `null`), `GetTransfer` (id no uuid o no visible → `TransferNotFoundError`), `ListTransfers` (`limit` por defecto 20; `^[0-9]+$` y entre 1 y 100; consulta `limit + 1`; `nextCursor` solo si hay más) y los fakes en memoria de repositorios y reloj.
  - **Archivos:** `services/payments/src/application/use-cases/list-accounts.ts`, `services/payments/src/application/use-cases/get-account-balance.ts`, `services/payments/src/application/use-cases/get-transfer.ts`, `services/payments/src/application/use-cases/list-transfers.ts`, `services/payments/tests/support/fakes.ts`, `services/payments/tests/unit/list-transfers.test.ts`, `services/payments/tests/unit/get-transfer.test.ts` (todos Crear).
  - **Dependencias:** 2.2.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run test -w services/payments -- --project unit tests/unit/list-transfers.test.ts tests/unit/get-transfer.test.ts --reporter=verbose` exit 0. Evidencia: `[AC-TRI-22]` (id no uuid, ajena e inexistente dan el mismo `TransferNotFoundError`), `[AC-TRI-21]` (visible para origen y destino), `[AC-TRI-24]` (`limit` por defecto, `nextCursor` solo si hay más), `[AC-TRI-25]` (`limit` 0, 101 y `abc` y cursor inválido lanzan `ValidationError`) y `[AC-TRI-26]` (lista vacía).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/application services/payments/tests --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/application services/payments/tests`

- [ ] **Task 2.4: Caso de uso `CreateTransfer` (atomicidad e idempotencia)** `[REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-3.7, REQ-3.8, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.6, REQ-4.7]` `[DESIGN §4.1 Flujo de CreateTransfer]` — **Evidencia**
  - **Alcance:** `CreateTransfer.execute` con el flujo exacto de `design.md` §4.1: `parseAmount`, `SameAccountError`, huella y ámbito (usuario, operación, clave), una sola unidad de trabajo con `begin` (`MISMATCH` → error; `REPLAY` → respuesta guardada sin escribir), bloqueo ordenado por `lockByIds`, errores de origen ajeno o inexistente y de destino inexistente, `executeInternalTransfer`, débito condicional y crédito solo si COMPLETED, `transfers.insert` y `idempotency.complete` con el 201; cualquier error revierte todo y no almacena la clave. Se añaden a los fakes la unidad de trabajo, el almacén de idempotencia y el generador de ids.
  - **Archivos:** `services/payments/src/application/use-cases/create-transfer.ts` (Crear), `services/payments/tests/support/fakes.ts` (Modificar), `services/payments/tests/unit/create-transfer.test.ts` (Crear).
  - **Dependencias:** 2.3.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run test -w services/payments -- --project unit tests/unit/create-transfer.test.ts --reporter=verbose` exit 0. Evidencia: `[AC-TRI-06]` (COMPLETED mueve débito y crédito), `[AC-TRI-07]` (saldo igual al monto deja 0.00), `[AC-TRI-08]` (FAILED `INSUFFICIENT_FUNDS` sin mover saldos), `[AC-TRI-10]` (origen ajeno, destino inexistente y misma cuenta sin efectos), `[AC-TRI-12]` (suma de saldos conservada), `[AC-TRI-15]` (`REPLAY` sin segundo débito), `[AC-TRI-17]` (`MISMATCH`), `[AC-TRI-19]` (los rechazos no almacenan clave) y `[AC-TRI-20]` (ámbito por usuario).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/application services/payments/tests --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/application services/payments/tests`

### Phase 3: Presentation, Endpoints & Integration

- [ ] **Task 3.1: [P] Adaptadores PostgreSQL y de sistema** `[REQ-3.1, REQ-3.3, REQ-3.7, REQ-3.8, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5, REQ-4.6, REQ-4.7, REQ-5.1, REQ-6.1, REQ-6.2, REQ-7.1]` `[DESIGN §3.2, §4.1, §8.2]` — **Evidencia**
  - **Alcance:** `createPool` (`max: 10`, handler `pool.on('error')`), `runMigrations` (`createSchema: false`), `PgAccountRepository` (`lockByIds` ordena ids ascendente y usa `FOR UPDATE` por id; `debit` condicional `WHERE balance >= monto`), `PgTransferRepository` (predicado de visibilidad por dueño de origen o destino; keyset `(created_at, id)` descendente), `PgIdempotencyStore` (`INSERT ... ON CONFLICT DO NOTHING`; `55P03`/`57014` → `IdempotencyKeyInProgressError`), `PgUnitOfWork` (`BEGIN`, `SET LOCAL lock_timeout`/`statement_timeout` = `5s`, `COMMIT`/`ROLLBACK`, cliente siempre liberado), `SystemClock` y `UuidIdGenerator`.
  - **Archivos:** `services/payments/src/adapters/outbound/postgres/pool.ts`, `services/payments/src/adapters/outbound/postgres/migrate.ts`, `services/payments/src/adapters/outbound/postgres/pg-account-repository.ts`, `services/payments/src/adapters/outbound/postgres/pg-transfer-repository.ts`, `services/payments/src/adapters/outbound/postgres/pg-idempotency-store.ts`, `services/payments/src/adapters/outbound/postgres/pg-unit-of-work.ts`, `services/payments/src/adapters/outbound/system/system-clock.ts`, `services/payments/src/adapters/outbound/system/uuid-id-generator.ts`, `services/payments/tests/integration/pg-account-repository.test.ts`, `services/payments/tests/integration/pg-transfer-repository.test.ts`, `services/payments/tests/integration/pg-idempotency-store.test.ts` (todos Crear).
  - **Dependencias:** 1.3, 2.2. Archivos disjuntos de 3.2.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/integration/pg-account-repository.test.ts tests/integration/pg-transfer-repository.test.ts tests/integration/pg-idempotency-store.test.ts --reporter=verbose` exit 0. Evidencia: `[AC-TRI-12]` (`debit` devuelve `false` y deja el saldo intacto si no alcanza), `[AC-TRI-13]` (`lockByIds` en transacciones simultáneas con ids en sentidos opuestos termina sin interbloqueo), `[AC-TRI-16]` (dos `begin` simultáneos con la misma clave: uno espera y obtiene `REPLAY`), `[AC-TRI-18]` (clave retenida por otra transacción más de 5 s produce `IdempotencyKeyInProgressError`), `[AC-TRI-20]` (ámbito por usuario), `[AC-TRI-21]` y `[AC-TRI-23]` (visibilidad para origen y destino, oculta a terceros) y `[AC-TRI-24]` (keyset con empates de `created_at`).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/adapters/outbound services/payments/tests/integration --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/adapters/outbound services/payments/tests/integration`

- [ ] **Task 3.2: [P] Verificador de credenciales JWT y servidor JWKS de prueba** `[REQ-1.1, REQ-1.2]` `[DESIGN §4.1 Adaptadores de sistema y JWT, §7.2]` — **Evidencia**
  - **Alcance:** `JoseTokenVerifier` (`createRemoteJWKSet` una sola vez; `jwtVerify` con `algorithms: ['EdDSA']`, `issuer`, `audience`, `clockTolerance: '5s'`, `currentDate` del `Clock`; `sub` debe ser uuid; cualquier fallo, incluido JWKS inalcanzable, lanza `AccessTokenInvalidError`) y servidor JWKS efímero con firmador de tokens Ed25519 para pruebas.
  - **Archivos:** `services/payments/src/adapters/outbound/jwt/jose-token-verifier.ts`, `services/payments/tests/support/jwks-server.ts`, `services/payments/tests/integration/jose-token-verifier.test.ts` (todos Crear).
  - **Dependencias:** 2.2. Archivos disjuntos de 3.1.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/integration/jose-token-verifier.test.ts --reporter=verbose` exit 0. Evidencia: `[AC-TRI-01]` (token válido devuelve el `sub`) y `[AC-TRI-02]` aprobado para cada caso: expirado, firma de otra llave, `iss` incorrecto, `aud` incorrecto, algoritmo distinto de EdDSA, `sub` no uuid y JWKS inalcanzable.
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/adapters/outbound/jwt services/payments/tests/support services/payments/tests/integration --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/adapters/outbound/jwt services/payments/tests/support services/payments/tests/integration`

- [ ] **Task 3.3: Configuración, composición, arranque y servidor HTTP base** `[REQ-7.1, REQ-8.1, REQ-8.2, REQ-8.3, REQ-1.2, REQ-3.4, REQ-3.6]` `[DESIGN §4.3, §7.1]`
  - **Alcance:** `loadConfig` (variables y reglas de §4.3), `composeApp`, `main.ts` (configuración → `runMigrations` → `createPool` → `composeApp` → `listen` en `0.0.0.0` → cierre ordenado; salida 1 si un paso falla), `buildApp` (logger JSON con redacción de `authorization`, `cookie` y `set-cookie`, `X-Request-Id`, Ajv con `removeAdditional: false`, `coerceTypes: false`, `useDefaults: false`, manejador de errores, ruta inexistente `NOT_FOUND`, rutas de salud), hook de autenticación Bearer, tabla de errores con los mensajes en español de §4.2, esquemas JSON de entrada y salida, `GET /health/live` y `GET /health/ready`, fixtures de usuarios y cuentas semilla, `buildTestApp` (app real con JWKS de prueba) y pruebas de configuración y de semilla.
  - **Archivos:** `services/payments/src/config.ts`, `services/payments/src/compose.ts`, `services/payments/src/main.ts`, `services/payments/src/adapters/inbound/http/app.ts`, `services/payments/src/adapters/inbound/http/auth-hook.ts`, `services/payments/src/adapters/inbound/http/error-handler.ts`, `services/payments/src/adapters/inbound/http/schemas.ts`, `services/payments/src/adapters/inbound/http/routes/health-routes.ts`, `services/payments/tests/support/fixtures.ts`, `services/payments/tests/support/build-test-app.ts`, `services/payments/tests/unit/config.test.ts`, `services/payments/tests/acceptance/seed.test.ts` (todos Crear).
  - **Dependencias:** 2.4, 3.1, 3.2.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/acceptance/seed.test.ts --reporter=verbose` exit 0 con `[AC-TRI-27]` aprobado (tras reejecutar `runMigrations` y el SQL de la semilla con saldos movidos siguen 3 cuentas con saldos intactos; el rol no puede crear esquemas).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run test -w services/payments -- --project unit tests/unit/config.test.ts` exit 0 (variable faltante o inválida produce un `Error` que nombra la variable sin imprimir valores).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run build -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src services/payments/tests --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src services/payments/tests`

- [ ] **Task 3.4: Autenticación de endpoints y rutas de cuentas** `[REQ-1.1, REQ-1.2, REQ-2.1, REQ-2.2, REQ-2.3]` `[DESIGN §4.2 GET /accounts, GET /accounts/{id}/balance, §7.2]` — **Evidencia**
  - **Alcance:** `GET /accounts` y `GET /accounts/{id}/balance` (`id` de 1 a 64 caracteres); registro, en un contexto encapsulado de `buildApp`, del hook de autenticación (401 `UNAUTHORIZED` en `onRequest`, antes de tocar la DB; log `warn` `auth.token_rejected`) y de las rutas de cuentas. Cuenta inexistente y ajena responden el mismo 404 `ACCOUNT_NOT_FOUND`. Los endpoints de salud siguen sin autenticación.
  - **Archivos:** `services/payments/src/adapters/inbound/http/routes/account-routes.ts` (Crear), `services/payments/src/adapters/inbound/http/app.ts` (Modificar), `services/payments/tests/acceptance/auth.test.ts` (Crear), `services/payments/tests/acceptance/accounts.test.ts` (Crear).
  - **Dependencias:** 3.3.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/acceptance/auth.test.ts tests/acceptance/accounts.test.ts --reporter=verbose` exit 0. Evidencia: `[AC-TRI-01]` (credencial válida atiende como el `sub`), `[AC-TRI-02]` (ausente, expirada, firma inválida, `iss` o `aud` incorrectos → 401 `UNAUTHORIZED` sin ejecutar la operación), `[AC-TRI-03]` (lista solo las cuentas propias y `[]` para un usuario sin cuentas), `[AC-TRI-04]` (saldo con 2 decimales) y `[AC-TRI-05]` (cuenta inexistente y ajena con cuerpo 404 idéntico).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/adapters/inbound services/payments/tests/acceptance --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/adapters/inbound services/payments/tests/acceptance`

- [ ] **Task 3.5: `POST /transfers` (creación, idempotencia y concurrencia)** `[REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-3.6, REQ-3.7, REQ-3.8, REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5, REQ-4.6, REQ-4.7, REQ-8.3]` `[DESIGN §4.2 POST /transfers, §7.2, §8.3]` — **Evidencia**
  - **Alcance:** ruta `POST /transfers` con hook `preValidation` que valida `Idempotency-Key` antes del cuerpo, esquema con `additionalProperties: false` y `amount` sin tipo en el esquema, precedencia de errores de `design.md` §4.2, respuesta 201 (incluida FAILED), header `Idempotent-Replayed: true` solo en repeticiones, `X-Request-Id` guardado como `correlation_id` y logs `transfer.created` (info), `idempotency.replayed` (info) e `idempotency.mismatch` (warn). Registro de `transfer-routes` en `buildApp`.
  - **Archivos:** `services/payments/src/adapters/inbound/http/routes/transfer-routes.ts` (Crear), `services/payments/src/adapters/inbound/http/app.ts` (Modificar), `services/payments/tests/acceptance/create-transfer.test.ts` (Crear), `services/payments/tests/acceptance/idempotency.test.ts` (Crear), `services/payments/tests/acceptance/concurrency.test.ts` (Crear).
  - **Dependencias:** 3.4.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/acceptance/create-transfer.test.ts tests/acceptance/idempotency.test.ts tests/acceptance/concurrency.test.ts --reporter=verbose` exit 0. Evidencia (cada ID en estado aprobado): `[AC-TRI-06]`, `[AC-TRI-07]`, `[AC-TRI-08]` (201 FAILED con saldos intactos), `[AC-TRI-09]` (monto ausente, numérico o fuera de formato o rango → 400 `INVALID_AMOUNT`), `[AC-TRI-10]` (404 `ACCOUNT_NOT_FOUND`, 404 `DESTINATION_NOT_FOUND`, 422 `SAME_ACCOUNT`), `[AC-TRI-11]` (400 `VALIDATION_ERROR`), `[AC-TRI-12]` (saldos nunca negativos y suma 1500000.00 conservada), `[AC-TRI-13]` (A→B y B→A con `Promise.all`, varias iteraciones, sin 500 y con saldos consistentes), `[AC-TRI-14]` (400 `IDEMPOTENCY_KEY_REQUIRED`), `[AC-TRI-15]` (repetición con `Idempotent-Replayed: true` y un solo débito), `[AC-TRI-16]` (solicitudes simultáneas con la misma clave: un único débito y respuestas iguales), `[AC-TRI-17]` (422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`), `[AC-TRI-18]` (409 `IDEMPOTENCY_KEY_IN_PROGRESS` reteniendo la fila de la clave en otra transacción abierta más de 5 s), `[AC-TRI-19]` (solo se almacenan 201; un 4xx corregido se reintenta con la misma clave), `[AC-TRI-20]` (usuarios distintos con la misma clave son independientes).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/adapters/inbound services/payments/tests/acceptance --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/adapters/inbound services/payments/tests/acceptance`

- [ ] **Task 3.6: `GET /transfers/{id}` y `GET /transfers`** `[REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4]` `[DESIGN §4.2 GET /transfers/{id}, GET /transfers, §3.1]` — **Evidencia**
  - **Alcance:** consulta de una transferencia (`id` de 1 a 64 caracteres; 404 `TRANSFER_NOT_FOUND` idéntico para inexistente, id sin formato uuid y de terceros; sin exigir `Idempotency-Key`) e historial paginado (query `limit` y `cursor` con `additionalProperties: false`; orden `created_at` y `id` descendentes; `nextCursor` opaco o `null`; 400 `VALIDATION_ERROR` ante `limit` o cursor inválidos).
  - **Archivos:** `services/payments/src/adapters/inbound/http/routes/transfer-routes.ts` (Modificar), `services/payments/tests/acceptance/get-transfer.test.ts` (Crear), `services/payments/tests/acceptance/list-transfers.test.ts` (Crear).
  - **Dependencias:** 3.5.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/acceptance/get-transfer.test.ts tests/acceptance/list-transfers.test.ts --reporter=verbose` exit 0. Evidencia: `[AC-TRI-21]` (origen y destino consultan con 200), `[AC-TRI-22]` (inexistente, id inválido y de terceros con cuerpo 404 idéntico), `[AC-TRI-23]` (enviadas y recibidas, orden descendente, sin transferencias de terceros), `[AC-TRI-24]` (cursor sin repetir ni omitir aun creando transferencias durante la paginación; `limit` por defecto 20 y máximo 100), `[AC-TRI-25]` (400 `VALIDATION_ERROR`) y `[AC-TRI-26]` (`{"items":[],"nextCursor":null}`).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/adapters/inbound services/payments/tests/acceptance --max-warnings 0` y `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/adapters/inbound services/payments/tests/acceptance`

- [ ] **Task 3.7: Operabilidad y contrato OpenAPI 3.1** `[REQ-8.1, REQ-8.2, REQ-8.3, REQ-9.1]` `[DESIGN §4.2 Health, §7.3, §5 Contenido de openapi.yaml]`
  - **Alcance:** pruebas de aceptación de salud (`live` 200; `ready` 200, o 503 `{"status":"unavailable"}` con `buildApp` y un `isDatabaseReady` que devuelve `false`, mientras `live` sigue en 200), formato uniforme de errores en español sin datos sensibles y rechazo de campos no definidos, y logs JSON con `X-Request-Id` sin `Authorization`, `Cookie` ni `Set-Cookie` (captura con `logStream`); `openapi.yaml` (OpenAPI `3.1.0`, `bearerAuth`, rutas y métodos de §4.2, header `Idempotency-Key` obligatorio, header `Idempotent-Replayed` en el 201, esquemas `AccountView`, `BalanceView`, `CreateTransferRequest`, `TransferView`, `TransferPage`, `ErrorResponse` y respuestas 400, 401, 404, 409, 422, 503) y su prueba. No crea archivos de producción; si una prueba revela un fallo se corrige en el archivo de la tarea que lo creó (3.3 a 3.6), sin añadir archivos a esta lista.
  - **Archivos:** `services/payments/tests/acceptance/operability.test.ts` (Crear), `services/payments/openapi.yaml` (Crear), `services/payments/tests/acceptance/openapi.test.ts` (Crear).
  - **Dependencias:** 3.6.
  - **Criterio de aceptación:**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/acceptance/operability.test.ts tests/acceptance/openapi.test.ts --reporter=verbose` exit 0 con `[AC-TRI-28]`, `[AC-TRI-29]`, `[AC-TRI-30]` y `[AC-TRI-31]` aprobados.
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/openapi.yaml services/payments/tests/acceptance`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/tests/acceptance --max-warnings 0`

### Phase 4: Verification, Testing & Polish

- [ ] **Task 4.1: Imagen de producción y servicio `payments` en Compose** `[REQ-10.2]` `[DESIGN §2.3, §5 Dockerfile]` — **Evidencia**
  - **Alcance:** etapas `build` y runtime del Dockerfile (`node:24.22.0-alpine`; instalación con `npm ci`, compilación, reinstalación solo de producción; runtime con `NODE_ENV=production`, `USER node`, `EXPOSE 3002`, `CMD ["node","services/payments/dist/main.js"]`; copia de `dist` y `migrations`) y servicio `payments` en `compose.dev.yaml` (puerto `3002:3002`, `depends_on` `postgres` sano, healthcheck con `wget` a `/health/ready`), con el contenido exacto de `design.md` §2.3 y §5.
  - **Archivos:** `services/payments/Dockerfile` (Modificar), `services/payments/compose.dev.yaml` (Modificar).
  - **Dependencias:** 3.7.
  - **Criterio de aceptación (en orden, cubre AC-TRI-33):**
    - `docker compose -f services/payments/compose.dev.yaml build payments` exit 0.
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps --entrypoint sh payments -c "ls services/payments/dist/main.js services/payments/migrations && id -un"` lista `services/payments/dist/main.js` y las dos migraciones, y muestra `node`.
    - `docker compose -f services/payments/compose.dev.yaml up -d --wait payments` exit 0 (el servicio queda `healthy` con PostgreSQL 18.6, sin el servicio de autenticación).
    - `docker compose -f services/payments/compose.dev.yaml down -v` (limpieza).
    - Evidencia: salida de los cuatro comandos, con el `node` del segundo y el estado `healthy` del tercero.

- [ ] **Task 4.2: Verificación integral del workspace `payments`** `[REQ-1.1, REQ-1.2, REQ-2.1, REQ-2.2, REQ-2.3, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-3.6, REQ-3.7, REQ-3.8, REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5, REQ-4.6, REQ-4.7, REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4, REQ-7.1, REQ-8.1, REQ-8.2, REQ-8.3, REQ-9.1, REQ-10.1, REQ-10.2]` `[DESIGN §8]` — **Evidencia**
  - **Alcance:** no crea ni modifica archivos; ejecuta la verificación global. Un fallo se corrige en la tarea dueña del archivo y se repite este bloque completo.
  - **Archivos:** ninguno.
  - **Dependencias:** 4.1.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm ci` (AC-TRI-32)
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run build -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --reporter=verbose` (proyectos `unit` y `db`) sin pruebas omitidas ni fallidas; evidencia: salida con los IDs `[AC-TRI-01]` a `[AC-TRI-31]` aprobados, incluidos `[AC-TRI-13]`, `[AC-TRI-16]`, `[AC-TRI-18]` y `[AC-TRI-22]`.
    - OpenAPI válido: `[AC-TRI-31]` aprobado en `tests/acceptance/openapi.test.ts` (`openapi: 3.1` y cada ruta y método de `design.md` §4.2) dentro de la ejecución anterior.
    - `docker compose -f services/payments/compose.dev.yaml down -v` (limpieza).

---

## 4. Cobertura EARS: requerimiento → tareas

| Requerimiento | Tareas |
|:---|:---|
| REQ-1.1 | 3.2, 3.4, 4.2 |
| REQ-1.2 | 3.2, 3.3, 3.4, 4.2 |
| REQ-2.1 | 2.2, 2.3, 3.4, 4.2 |
| REQ-2.2 | 2.3, 3.4, 4.2 |
| REQ-2.3 | 2.3, 3.4, 4.2 |
| REQ-3.1 | 2.1, 2.4, 3.1, 3.5, 4.2 |
| REQ-3.2 | 2.1, 2.4, 3.5, 4.2 |
| REQ-3.3 | 2.1, 2.4, 3.1, 3.5, 4.2 |
| REQ-3.4 | 2.1, 2.4, 3.3, 3.5, 4.2 |
| REQ-3.5 | 2.4, 3.5, 4.2 |
| REQ-3.6 | 3.3, 3.5, 4.2 |
| REQ-3.7 | 2.1, 2.4, 3.1, 3.5, 4.2 |
| REQ-3.8 | 2.4, 3.1, 3.5, 4.2 |
| REQ-4.1 | 2.1, 3.5, 4.2 |
| REQ-4.2 | 2.1, 2.4, 3.1, 3.5, 4.2 |
| REQ-4.3 | 2.4, 3.1, 3.5, 4.2 |
| REQ-4.4 | 2.1, 2.4, 3.1, 3.5, 4.2 |
| REQ-4.5 | 3.1, 3.5, 4.2 |
| REQ-4.6 | 2.4, 3.1, 3.5, 4.2 |
| REQ-4.7 | 2.4, 3.1, 3.5, 4.2 |
| REQ-5.1 | 2.2, 2.3, 3.1, 3.6, 4.2 |
| REQ-5.2 | 2.3, 3.6, 4.2 |
| REQ-6.1 | 2.3, 3.1, 3.6, 4.2 |
| REQ-6.2 | 2.2, 2.3, 3.1, 3.6, 4.2 |
| REQ-6.3 | 2.2, 2.3, 3.6, 4.2 |
| REQ-6.4 | 2.3, 3.6, 4.2 |
| REQ-7.1 | 1.1, 1.3, 3.1, 3.3, 4.2 |
| REQ-8.1 | 3.3, 3.7, 4.2 |
| REQ-8.2 | 2.1, 3.3, 3.7, 4.2 |
| REQ-8.3 | 3.3, 3.5, 3.7, 4.2 |
| REQ-9.1 | 3.7, 4.2 |
| REQ-10.1 | 1.1, 1.2, 4.2 |
| REQ-10.2 | 4.1, 4.2 |

---

## 5. Execution Progress Tracker
| Fase | Total Tareas | Completadas | Estado |
|:---|:---:|:---:|:---|
| **Phase 1: Foundation, Schemas & Core Domain** | 3 | 0 | `Pending` |
| **Phase 2: Core Logic & Application Layer** | 4 | 0 | `Pending` |
| **Phase 3: Presentation, Endpoints & Integration** | 7 | 0 | `Pending` |
| **Phase 4: Verification, Testing & Polish** | 2 | 0 | `Pending` |
| **Total Global** | **16** | **0** | **0%** |

---

## 6. Definition of Done (DoD) Gate
- [ ] Todas las tareas están marcadas como completadas (`[x]`).
- [ ] Todos los criterios EARS de `requirements.md` pasan las pruebas asociadas (`[AC-TRI-01]` a `[AC-TRI-33]`).
- [ ] La estructura de archivos coincide con el mapeo de `design.md` §5.
- [ ] Todos los tests unitarios, de integración y de aceptación pasan sin advertencias críticas.
- [ ] La fila del spec en el `INDEX.md` de specs (`.makia/docs/specs/services/payments/INDEX.md`) está sincronizada con el `Estado global` de `summary.md`.

---

> IMPLEMENT ejecuta este documento tarea por tarea. Cada tarea se valida con un TEST acotado a sus propios archivos (no la suite completa) antes de marcarse `[x]`. Máximo 2 iteraciones de corrección por tarea antes de cancelar y escalar (ver sub-orchestrator.md del Orquestador).
