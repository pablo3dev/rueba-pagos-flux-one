# Implementation Tasks: Transferencias externas (servicio de pagos `services/payments`)

## 1. Metadata & Traceability
- **Spec:** `transferencias-externas-payments`
- **Requirements Ref:** `requirements.md` (spec: `transferencias-externas-payments`)
- **Design Ref:** `design.md` (spec: `transferencias-externas-payments`)

`[P]`: puede ejecutarse en paralelo (archivos distintos, sin dependencias entre sí).

Rutas relativas a la raíz del repositorio. Prefijo de todo comando (nada se instala ni ejecuta en el host): `docker compose -f services/payments/compose.dev.yaml`. Sin DB: `run --rm --no-deps dev <cmd>`; con DB: `run --rm dev <cmd>`.

---

## 2. Execution Guidelines
- **Sequential Ordering:** ejecutar las fases en orden estricto (datos primero: migración y dominio; luego puertos y casos de uso; luego adaptadores, HTTP y aceptación; al final la verificación global). Dentro de cada fase, las subtareas se completan antes de pasar a la siguiente, salvo las marcadas `[P]`.
- **Test-Verified:** cada funcionalidad debe tener su prueba correspondiente antes de marcarse `[x]`, salvo la tarea 2.2, que no tiene archivo de prueba propio: su comportamiento se verifica en las pruebas de las tareas 3.2, 3.3 y 3.5 (cobertura transitiva de la sección 4). El nombre de cada prueba incluye su ID, por ejemplo `it('[AC-TEX-01] ...')`; imports explícitos de `vitest` (sin globals).
- **Evidencia de comportamiento crítico:** las tareas marcadas `Evidencia` se marcan `[x]` solo con la salida del comando que muestre cada prueba con su ID `[AC-TEX-NN]` en estado aprobado (usar `--reporter=verbose`).
- **Alcance acotado:** cada tarea se valida con las pruebas de sus propios archivos, más tipos, lint y formato sobre sus rutas; la suite completa se ejecuta en la tarea 4.1.
- **Archivos exactos:** cada tarea toca únicamente los archivos que lista, que coinciden con la tabla de `design.md` §5. Los archivos del spec previo figuran como «Modificar [actualización incremental previo]».
- **Convenciones:** LF. El código nuevo no incluye `eslint-disable` ni `@ts-ignore`. No se tocan `package.json`, `package-lock.json`, `Dockerfile`, `.env.example` ni `README.md`.
- **Traceability Tags:** cada tarea referencia su origen en `requirements.md` (ej. `[REQ-1.1]`) y su componente en `design.md` (ej. `[DESIGN §5]`).

---

## 3. Phase Breakdown & Actionable Tasks

### Phase 1: Foundation, Schemas & Core Domain

- [x] **Task 1.1: Migración y esquema de transferencias externas** `[REQ-4.1, REQ-4.4, REQ-7.3]` `[DESIGN §3.2, §5]`
  - **Alcance:** migración 3 de `design.md` §3.2 (`1792108800002_externalize-transfers.sql`): columnas y constraints de la transferencia externa, índice parcial `transfers_rail_work_idx` y referencia única del riel. `buildTransfer(overrides)` incorpora los campos nuevos con sus valores por defecto. Las filas INTERNAL previas siguen válidas y una INTERNAL no puede quedar PENDING.
  - **Archivos:** `services/payments/migrations/1792108800002_externalize-transfers.sql` (Crear), `services/payments/tests/integration/migrations.test.ts` (Modificar [actualización incremental previo]), `services/payments/tests/support/fixtures.ts` (Modificar [actualización incremental previo]).
  - **Dependencias:** ninguna.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/integration/migrations.test.ts --reporter=verbose` Evidencia: `[AC-TEX-26]` y `[AC-TEX-37]` aprobados (constraints nuevas y vigentes, columnas, índice parcial, `pgmigrations` incluye `1792108800002`, filas INTERNAL intactas, una INTERNAL no puede ser PENDING).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/tests/integration/migrations.test.ts services/payments/tests/support/fixtures.ts --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/migrations services/payments/tests/integration/migrations.test.ts services/payments/tests/support/fixtures.ts`

- [x] **Task 1.2: Dominio de la transferencia externa** `Evidencia` `[REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.5, REQ-1.7, REQ-1.8, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-3.6, REQ-3.7, REQ-4.3, REQ-4.4, REQ-5.4, REQ-5.6, REQ-7.3]` `[DESIGN §3.1, §5]`
  - **Alcance:** `InvalidTransferTransitionError`; `Transfer` con los campos nuevos y `executeInternalTransfer` rellenándolos con sus valores por defecto; creación con retención, siguiente acción, efectos de cada resultado del riel y backoff `min(2^intentos, 30)` en `external-transfer.ts`. La referencia del riel es el id de la transferencia y no cambia.
  - **Archivos:** `services/payments/src/domain/errors.ts` (Modificar [actualización incremental previo]), `services/payments/src/domain/transfer.ts` (Modificar [actualización incremental previo]), `services/payments/src/domain/external-transfer.ts` (Crear), `services/payments/tests/unit/external-transfer.test.ts` (Crear), `services/payments/tests/unit/transfer.test.ts` (Modificar [actualización incremental previo]).
  - **Dependencias:** 1.1.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run test -w services/payments -- --project unit tests/unit/external-transfer.test.ts tests/unit/transfer.test.ts --reporter=verbose` Evidencia: `[AC-TEX-04]`, `[AC-TEX-05]`, `[AC-TEX-08]`, `[AC-TEX-18]`, `[AC-TEX-25]`, `[AC-TEX-26]` y `[AC-TEX-32]` aprobados (`parseExternalAccount` acepta 6 y 34 y rechaza 5, 35, minúsculas y espacios; saldo igual al monto deja 0 y PENDING; saldo menor queda FAILED sin cambios y el saldo nunca es negativo; `backoffSeconds` vale 1, 2, 4, 8, 16, 30 y 30 para 0..6; transiciones desde COMPLETED, FAILED e INTERNAL lanzan `InvalidTransferTransitionError`; `transfer.test.ts` espera los campos nuevos por defecto).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/domain services/payments/tests/unit/external-transfer.test.ts services/payments/tests/unit/transfer.test.ts --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/domain services/payments/tests/unit/external-transfer.test.ts services/payments/tests/unit/transfer.test.ts`

### Phase 2: Core Logic & Application Layer

- [x] **Task 2.1: Puertos, vista unificada y creación externa** `Evidencia` `[REQ-1.1, REQ-1.3, REQ-1.6, REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.5, REQ-6.1, REQ-6.5, REQ-7.2]` `[DESIGN §4.1, §4.2, §5]`
  - **Alcance:** puertos `Logger`, `BankRailPort` y `RailWorkRepository`; `TransactionScope.railWork`; `TransferView` unificada; `CreateTransfer` con cuerpo discriminado, rama `EXTERNAL` y resultado `{replayed, status, transfer}`. Con esta tarea el código de aplicación acepta `type` `EXTERNAL` en la creación. El fake de `railWork` lanza `Error('no usado')`. Los documentos del spec previo se actualizan en la tarea 3.6.
  - **Archivos:** `services/payments/src/application/ports/logger.ts` (Crear), `services/payments/src/application/ports/bank-rail-port.ts` (Crear), `services/payments/src/application/ports/rail-work-repository.ts` (Crear), `services/payments/src/application/ports/unit-of-work.ts` (Modificar [actualización incremental previo]), `services/payments/src/application/views.ts` (Modificar [actualización incremental previo]), `services/payments/src/application/use-cases/create-transfer.ts` (Modificar [actualización incremental previo]), `services/payments/tests/support/fakes.ts` (Modificar [actualización incremental previo]), `services/payments/tests/unit/create-external-transfer.test.ts` (Crear), `services/payments/tests/unit/create-transfer.test.ts` (Modificar [actualización incremental previo]), `services/payments/tests/unit/get-transfer.test.ts` (Modificar [actualización incremental previo]), `services/payments/tests/unit/list-transfers.test.ts` (Modificar [actualización incremental previo]).
  - **Dependencias:** 1.2.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run test -w services/payments -- --project unit tests/unit/create-external-transfer.test.ts tests/unit/create-transfer.test.ts tests/unit/get-transfer.test.ts tests/unit/list-transfers.test.ts --reporter=verbose` Evidencia: `[AC-TEX-04]`, `[AC-TEX-05]` y `[AC-TEX-08]` aprobados (PENDING con débito, FAILED sin movimiento, destino inválido, monto inválido, cuenta ajena, `REPLAY` con estado 202, `MISMATCH`). Las pruebas de internas siguen pasando con el campo `status` y usan `buildTransfer()`.
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/application services/payments/tests/support/fakes.ts services/payments/tests/unit/create-external-transfer.test.ts services/payments/tests/unit/create-transfer.test.ts services/payments/tests/unit/get-transfer.test.ts services/payments/tests/unit/list-transfers.test.ts --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/application services/payments/tests/support/fakes.ts services/payments/tests/unit/create-external-transfer.test.ts services/payments/tests/unit/create-transfer.test.ts services/payments/tests/unit/get-transfer.test.ts services/payments/tests/unit/list-transfers.test.ts`

- [x] **Task 2.2: Casos de uso de despacho y conciliación** `[REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-3.8, REQ-4.1, REQ-4.2, REQ-4.3, REQ-5.1, REQ-5.4, REQ-5.5, REQ-5.6, REQ-8.2]` `[DESIGN §4.1, §5]`
  - **Alcance:** constantes `BATCH_SIZE` y `LEASE_MS`, `applyRailTransition` (reembolso como máximo una vez, en la misma transacción que marca FAILED, y solo si el guardado afectó 1 fila), caso de uso de despacho y caso de uso de conciliación. La llamada al riel queda fuera de la transacción. `design.md` §5 no asigna un archivo de prueba a esta tarea: el comportamiento se verifica en las tareas 3.2, 3.3 y 3.5.
  - **Archivos:** `services/payments/src/application/rail-work.ts` (Crear), `services/payments/src/application/use-cases/dispatch-external-transfers.ts` (Crear), `services/payments/src/application/use-cases/reconcile-external-transfers.ts` (Crear).
  - **Dependencias:** 2.1.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/application/rail-work.ts services/payments/src/application/use-cases/dispatch-external-transfers.ts services/payments/src/application/use-cases/reconcile-external-transfers.ts --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/application/rail-work.ts services/payments/src/application/use-cases/dispatch-external-transfers.ts services/payments/src/application/use-cases/reconcile-external-transfers.ts`

### Phase 3: Presentation, Endpoints & Integration

- [x] **Task 3.1: [P] Adaptadores Postgres de transferencias y trabajo del riel** `Evidencia` `[REQ-1.1, REQ-3.2, REQ-3.8, REQ-4.1, REQ-4.2, REQ-4.3, REQ-5.4, REQ-6.2, REQ-6.3]` `[DESIGN §3.2, §4.1, §5]`
  - **Alcance:** columnas y mapeo de externas, predicado de visibilidad, export de `TRANSFER_COLUMNS` y `mapTransferRow`; reclamo con `FOR UPDATE SKIP LOCKED` y guardado con fencing; el scope de la unidad de trabajo instancia `PgRailWorkRepository`.
  - **Archivos:** `services/payments/src/adapters/outbound/postgres/pg-transfer-repository.ts` (Modificar [actualización incremental previo]), `services/payments/src/adapters/outbound/postgres/pg-rail-work-repository.ts` (Crear), `services/payments/src/adapters/outbound/postgres/pg-unit-of-work.ts` (Modificar [actualización incremental previo]), `services/payments/tests/integration/pg-rail-work-repository.test.ts` (Crear), `services/payments/tests/integration/pg-transfer-repository.test.ts` (Modificar [actualización incremental previo]).
  - **Dependencias:** 1.1 y 2.1. Paralela con 3.2.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/integration/pg-rail-work-repository.test.ts tests/integration/pg-transfer-repository.test.ts --reporter=verbose` Evidencia: `[AC-TEX-23]`, `[AC-TEX-24]`, `[AC-TEX-25]`, `[AC-TEX-34]` y `[AC-TEX-35]` aprobados (dos `claim` concurrentes obtienen conjuntos disjuntos; se respetan `LIMIT`, `next_attempt_at` y el arrendamiento; las variantes `DISPATCH` y `RECONCILE` no se solapan; `saveGuarded` devuelve false con otro `lease_until` o estado y no modifica la fila; el reclamo no toca `updated_at`; la externa solo la ve el dueño del origen; la interna, origen y destino; keyset con externas e internas mezcladas).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/adapters/outbound/postgres services/payments/tests/integration/pg-rail-work-repository.test.ts services/payments/tests/integration/pg-transfer-repository.test.ts --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/adapters/outbound/postgres services/payments/tests/integration/pg-rail-work-repository.test.ts services/payments/tests/integration/pg-transfer-repository.test.ts`

- [x] **Task 3.2: [P] Adaptador HTTP del riel y riel de prueba** `Evidencia` `[REQ-1.7, REQ-3.1, REQ-3.6, REQ-3.7, REQ-5.1, REQ-7.3, REQ-8.2]` `[DESIGN §4.1, §5]`
  - **Alcance:** `HttpBankRail` con `fetch`, header `X-Request-Id` igual al identificador de correlación, vencimiento de 10 s (`RAIL_TIMEOUT_MS = 10000`) y referencia igual al id de la transferencia. Servidor HTTP de prueba controlable y reloj controlable (`set`, `advance`) para las pruebas posteriores.
  - **Archivos:** `services/payments/src/adapters/outbound/rail/http-bank-rail.ts` (Crear), `services/payments/tests/support/fake-rail.ts` (Crear), `services/payments/tests/support/test-clock.ts` (Crear), `services/payments/tests/unit/http-bank-rail.test.ts` (Crear).
  - **Dependencias:** 2.1. Paralela con 3.1.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run test -w services/payments -- --project unit tests/unit/http-bank-rail.test.ts --reporter=verbose` Evidencia: `[AC-TEX-15]`, `[AC-TEX-18]`, `[AC-TEX-20]`, `[AC-TEX-21]`, `[AC-TEX-27]`, `[AC-TEX-40]` y `[AC-TEX-41]` aprobados (forma de `POST /rail/transfers` y `GET /rail/transfers/{reference}`; traducción de 200, 422, 503, timeout, error tras enviar, 400, 409 y cuerpo no interpretable; `baseUrl` con barra final se normaliza).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/adapters/outbound/rail services/payments/tests/support/fake-rail.ts services/payments/tests/support/test-clock.ts services/payments/tests/unit/http-bank-rail.test.ts --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/adapters/outbound/rail services/payments/tests/support/fake-rail.ts services/payments/tests/support/test-clock.ts services/payments/tests/unit/http-bank-rail.test.ts`

- [x] **Task 3.3: HTTP, configuración, composición y workers** `[REQ-1.1, REQ-1.4, REQ-1.5, REQ-2.1, REQ-2.4, REQ-3.1, REQ-6.1, REQ-6.5, REQ-8.1, REQ-8.2, REQ-8.4]` `[DESIGN §4.2, §4.3, §5]`
  - **Alcance:** `PollingWorker` con `runOnce()` y cadencia de 500 ms; esquema condicional de `POST /transfers` y respuestas 201/202 con la vista unificada; la ruta responde el `status` del resultado (201 o 202); `redact` incluye `headers.authorization`, `headers.cookie` y `headers["set-cookie"]`; `RAIL_BASE_URL` obligatoria (URL absoluta http o https; si falta o es inválida, `loadConfig` lanza `Error` que nombra la variable y no imprime el valor); `clock?` en `composeApp` y `composeWorkers`; `main.ts` arranca y detiene los workers. Con esta tarea el código HTTP acepta `type` `EXTERNAL` y publica los estados PENDING y UNKNOWN. Los documentos del spec previo se actualizan en la tarea 3.6.
  - **Archivos:** `services/payments/src/adapters/inbound/workers/polling-worker.ts` (Crear), `services/payments/src/adapters/inbound/http/schemas.ts` (Modificar [actualización incremental previo]), `services/payments/src/adapters/inbound/http/routes/transfer-routes.ts` (Modificar [actualización incremental previo]), `services/payments/src/adapters/inbound/http/app.ts` (Modificar [actualización incremental previo]), `services/payments/src/config.ts` (Modificar [actualización incremental previo]), `services/payments/src/compose.ts` (Modificar [actualización incremental previo]), `services/payments/src/main.ts` (Modificar [actualización incremental previo]), `services/payments/tests/support/rail-harness.ts` (Crear), `services/payments/tests/support/build-test-app.ts` (Modificar [actualización incremental previo]), `services/payments/tests/unit/polling-worker.test.ts` (Crear), `services/payments/tests/unit/config.test.ts` (Modificar [actualización incremental previo]).
  - **Dependencias:** 2.2, 3.1 y 3.2.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run test -w services/payments -- --project unit tests/unit/polling-worker.test.ts tests/unit/config.test.ts --reporter=verbose` Evidencia: `[AC-TEX-15]`, `[AC-TEX-23]` y `[AC-TEX-41]` aprobados (cadencia de 500 ms, sin solapamiento, un error del caso de uso no detiene el bucle, `stop()` espera al tick en curso; `RAIL_BASE_URL` ausente, vacía, relativa o con esquema distinto de http/https falla nombrando la variable; una URL válida se normaliza).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/src/adapters/inbound services/payments/src/config.ts services/payments/src/compose.ts services/payments/src/main.ts services/payments/tests/support/rail-harness.ts services/payments/tests/support/build-test-app.ts services/payments/tests/unit/polling-worker.test.ts services/payments/tests/unit/config.test.ts --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/src/adapters/inbound services/payments/src/config.ts services/payments/src/compose.ts services/payments/src/main.ts services/payments/tests/support/rail-harness.ts services/payments/tests/support/build-test-app.ts services/payments/tests/unit/polling-worker.test.ts services/payments/tests/unit/config.test.ts`

- [x] **Task 3.4: [P] Aceptación de creación, idempotencia, consulta y regresión interna** `Evidencia` `[REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.5, REQ-1.6, REQ-1.7, REQ-2.1, REQ-2.3, REQ-2.4, REQ-2.5, REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4, REQ-6.5]` `[DESIGN §4.2, §8.3, §5]`
  - **Alcance:** creación externa (202 PENDING con débito, 201 FAILED por fondos insuficientes, validación y cuenta origen), idempotencia de esa creación, consulta e historial con externas, y regresión de internas, cuentas e idempotencia. En `create-transfer.test.ts` el `type` inválido de AC-TRI-11 usa un valor distinto de `INTERNAL` y de `EXTERNAL`.
  - **Archivos:** `services/payments/tests/acceptance/create-external-transfer.test.ts` (Crear), `services/payments/tests/acceptance/external-idempotency.test.ts` (Crear), `services/payments/tests/acceptance/get-external-transfer.test.ts` (Crear), `services/payments/tests/acceptance/internal-regression.test.ts` (Crear), `services/payments/tests/acceptance/create-transfer.test.ts` (Modificar [actualización incremental previo]).
  - **Dependencias:** 3.3. Paralela con 3.5.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/acceptance/create-external-transfer.test.ts tests/acceptance/external-idempotency.test.ts tests/acceptance/get-external-transfer.test.ts tests/acceptance/internal-regression.test.ts tests/acceptance/create-transfer.test.ts --reporter=verbose` Evidencia: `[AC-TEX-01]` a `[AC-TEX-07]`, `[AC-TEX-09]`, `[AC-TEX-11]`, `[AC-TEX-12]`, `[AC-TEX-13]` y `[AC-TEX-33]` a `[AC-TEX-37]` aprobados. `POST /transfers` con `type` `EXTERNAL` y saldo suficiente debita el origen, queda PENDING y responde 202; saldo igual al monto deja el origen en 0.00; saldo insuficiente responde 201 FAILED `INSUFFICIENT_FUNDS` sin enviar; destino inválido responde 400 `VALIDATION_ERROR`; monto inválido responde 400 `INVALID_AMOUNT`; origen ajeno o inexistente responde 404 `ACCOUNT_NOT_FOUND` idéntico; la referencia es el id. La repetición con la misma clave y payload devuelve el 202 original con `Idempotent-Replayed: true` sin segundo débito; payload distinto responde 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`; clave ausente o inválida responde 400 `IDEMPOTENCY_KEY_REQUIRED`; se almacenan 202 y 201 con efecto, y no los 4xx sin efecto. El detalle trae `type` `EXTERNAL`, `toAccountId` nulo, estados PENDING, COMPLETED, FAILED o UNKNOWN, y `failureReason` solo si es FAILED. Ajena o inexistente responde 404 `TRANSFER_NOT_FOUND`. El historial mezcla internas y externas del usuario, ordenado por creación descendente e id descendente, con cursor sin repetir ni omitir, y nunca incluye externas de terceros. El estado vigente se ve en el GET siguiente sin `Idempotency-Key`. Internas, cuentas e idempotencia responden igual que antes.
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/tests/acceptance/create-external-transfer.test.ts services/payments/tests/acceptance/external-idempotency.test.ts services/payments/tests/acceptance/get-external-transfer.test.ts services/payments/tests/acceptance/internal-regression.test.ts services/payments/tests/acceptance/create-transfer.test.ts --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/tests/acceptance/create-external-transfer.test.ts services/payments/tests/acceptance/external-idempotency.test.ts services/payments/tests/acceptance/get-external-transfer.test.ts services/payments/tests/acceptance/internal-regression.test.ts services/payments/tests/acceptance/create-transfer.test.ts`

- [x] **Task 3.5: [P] Aceptación de despacho, conciliación, concurrencia, dinero y registros** `Evidencia` `[REQ-1.8, REQ-2.2, REQ-2.6, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-3.6, REQ-3.7, REQ-3.8, REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.4, REQ-5.5, REQ-5.6, REQ-7.1, REQ-7.2, REQ-7.3, REQ-8.1, REQ-8.2]` `[EC-01, EC-02, EC-03, EC-04, EC-07, EC-09, EC-10, EC-11, EC-16, EC-17]` `[DESIGN §4.1, §8.3, §5]`
  - **Alcance:** envío al riel, conciliación, concurrencia y fencing, invariante de dinero, arranque con `RAIL_BASE_URL` ausente o inválida, y logs `rail.*` y `reconcile.*`. Los workers se ejercitan con `runOnce()` sobre PostgreSQL, el riel de prueba y el reloj controlable.
  - **Archivos:** `services/payments/tests/acceptance/rail-dispatch.test.ts` (Crear), `services/payments/tests/acceptance/rail-reconcile.test.ts` (Crear), `services/payments/tests/acceptance/external-concurrency.test.ts` (Crear), `services/payments/tests/acceptance/external-money-invariant.test.ts` (Crear), `services/payments/tests/acceptance/rail-config.test.ts` (Crear), `services/payments/tests/acceptance/rail-logs.test.ts` (Crear).
  - **Dependencias:** 3.3. Paralela con 3.4.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/acceptance/rail-dispatch.test.ts tests/acceptance/rail-reconcile.test.ts tests/acceptance/external-concurrency.test.ts tests/acceptance/external-money-invariant.test.ts tests/acceptance/rail-config.test.ts tests/acceptance/rail-logs.test.ts --reporter=verbose` Evidencia: `[AC-TEX-08]`, `[AC-TEX-10]`, `[AC-TEX-14]`, `[AC-TEX-15]` a `[AC-TEX-25]`, `[AC-TEX-27]` a `[AC-TEX-32]`, `[AC-TEX-38]`, `[AC-TEX-39]`, `[AC-TEX-40]`, `[AC-TEX-41]` y `[AC-TEX-42]` aprobados. El envío usa `POST /rail/transfers` con `X-Request-Id`. 200 pasa a COMPLETED sin mover saldos. 422 pasa a FAILED `RAIL_REJECTED` con reembolso en la misma transacción. 503 y ECONNREFUSED/ENOTFOUND mantienen PENDING y esperan 2, 4, 8 y 16 s al avanzar el reloj; el quinto intento pasa a FAILED `RAIL_UNAVAILABLE` con reembolso (EC-01, EC-04). Timeout, error tras enviar, 400, 409, 5xx y cuerpo inválido pasan a UNKNOWN con fondos retenidos (EC-09). Una reserva vencida se retoma con la misma referencia sin segundo débito (EC-11). La conciliación usa `GET /rail/transfers/{reference}`: 200 `ACCEPTED` pasa a COMPLETED sin reenviar (EC-02); 422 reembolsa; 404 reenvía la misma referencia (EC-03); 503, timeout, fallo de conexión u otra respuesta permanece UNKNOWN y reintenta sin límite (EC-16). Solicitudes simultáneas con la misma clave producen un único débito (EC-07). Una espera mayor de 5 s responde 409 `IDEMPOTENCY_KEY_IN_PROGRESS`. El riel retenido no bloquea creaciones, consultas ni `SELECT ... FOR UPDATE NOWAIT` de la cuenta origen (EC-17). Dos despachadores no procesan la misma fila. Un resultado tardío cuyo arrendamiento venció se descarta sin segundo reembolso. La suma de saldos más retenidos PENDING o UNKNOWN más externas COMPLETED es 1500000.00 y ningún saldo es negativo. `node --import tsx src/main.ts` con `RAIL_BASE_URL` ausente o inválida termina con código 1 y stderr nombra la variable. Los logs traen `rail.*`, `reconcile.result` y `transfer.status_changed` con `transferId` y `correlationId`, y ninguna línea contiene `authorization`, `cookie`, `set-cookie` ni el token.
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/tests/acceptance/rail-dispatch.test.ts services/payments/tests/acceptance/rail-reconcile.test.ts services/payments/tests/acceptance/external-concurrency.test.ts services/payments/tests/acceptance/external-money-invariant.test.ts services/payments/tests/acceptance/rail-config.test.ts services/payments/tests/acceptance/rail-logs.test.ts --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/tests/acceptance/rail-dispatch.test.ts services/payments/tests/acceptance/rail-reconcile.test.ts services/payments/tests/acceptance/external-concurrency.test.ts services/payments/tests/acceptance/external-money-invariant.test.ts services/payments/tests/acceptance/rail-config.test.ts services/payments/tests/acceptance/rail-logs.test.ts`

- [x] **Task 3.6: OpenAPI, Compose y actualización incremental de transferencias-internas-payments** `[REQ-6.5, REQ-8.1, REQ-8.3, REQ-8.4]` `[DESIGN §4.2, §4.3, §5]`
  - **Alcance:** `openapi.yaml` describe `type` `EXTERNAL`, `toExternalAccount`, la respuesta 202, los estados PENDING y UNKNOWN y los motivos `RAIL_REJECTED` y `RAIL_UNAVAILABLE`. `compose.dev.yaml` define `RAIL_BASE_URL` en el servicio `payments` (`${RAIL_BASE_URL:-http://bank-rail:3004}`), sobreescribible, sin añadir un servicio de riel. Esta es la tarea en la que IMPLEMENT actualiza el spec previo `transferencias-internas-payments` para que `POST /transfers` acepte `type` `EXTERNAL` y los estados PENDING y UNKNOWN. La edición de documentos se limita a lo siguiente y no reescribe el resto:
    - `design.md`, solo §4.2: en `POST /transfers`, sustituir Entrada, Esquema, Response y «Errores y precedencia» por los de `design.md` §4.2 de este spec (acepta `type` `INTERNAL` o `EXTERNAL`; 202 para externa PENDING; precedencia con el esquema condicional). En `GET /transfers/{id}` y `GET /transfers`, sustituir `TransferView` por la vista unificada de este §4.2 y la pertenencia por el predicado de §3.1 de este spec. Solo §2.8: retirar la entrada `transferencias-externas-payments`; las demás entradas no se tocan.
    - `summary.md`: añadir al final la sección `## Actualizaciones incrementales recibidas` con la línea `transferencias-externas-payments: design.md §4.2 (contratos de POST /transfers y GET) y §2.8; requirements.md REQ-3.6, REQ-3.7 y REQ-4.6 con sus AC-TRI-11, AC-TRI-12 y AC-TRI-19.`
    - `requirements.md`, solo estos criterios: REQ-3.6 y AC-TRI-11 pasan de «`type` es distinto de `INTERNAL`» a «`type` no es `INTERNAL` ni `EXTERNAL`, o trae `toExternalAccount`». REQ-3.7 y AC-TRI-12 pasan de «la suma de saldos del sistema constante» a «la suma de saldos constante en las transferencias internas». REQ-4.6 y AC-TRI-19 pasan de almacenar solo respuestas con efecto (201, incluidas las FAILED por `INSUFFICIENT_FUNDS`) a incluir también 202. El resto de REQ, RN y EC del spec previo no se edita.
    - El código que hace que `POST /transfers` acepte `type` `EXTERNAL` y publique PENDING y UNKNOWN está en las tareas 1.2, 2.1, 3.1 y 3.3. Esta tarea no vuelve a editar esos archivos.
  - **Archivos:** `services/payments/openapi.yaml` (Modificar [actualización incremental previo]), `services/payments/compose.dev.yaml` (Modificar [actualización incremental previo]), `services/payments/tests/acceptance/openapi-external.test.ts` (Crear), `services/payments/tests/acceptance/external-operability.test.ts` (Crear), `.makia/docs/specs/services/payments/transferencias-internas-payments/design.md` (Modificar [actualización incremental previo]), `.makia/docs/specs/services/payments/transferencias-internas-payments/summary.md` (Modificar [actualización incremental previo]), `.makia/docs/specs/services/payments/transferencias-internas-payments/requirements.md` (Modificar [actualización incremental previo]).
  - **Dependencias:** 3.4 y 3.5.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --project db tests/acceptance/openapi-external.test.ts tests/acceptance/external-operability.test.ts --reporter=verbose` Evidencia: `[AC-TEX-43]` y `[AC-TEX-44]` aprobados (`openapi.yaml` describe `EXTERNAL`, `toExternalAccount`, `202`, `PENDING`, `UNKNOWN`, `RAIL_REJECTED` y `RAIL_UNAVAILABLE`; `/health/ready` responde 200 y 503 según la base de datos con los workers compuestos; `compose.dev.yaml` define `RAIL_BASE_URL` en `payments`).
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments/tests/acceptance/openapi-external.test.ts services/payments/tests/acceptance/external-operability.test.ts --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments/openapi.yaml services/payments/compose.dev.yaml services/payments/tests/acceptance/openapi-external.test.ts services/payments/tests/acceptance/external-operability.test.ts`

### Phase 4: Verification, Testing & Polish

- [x] **Task 4.1: Verificación global** `[REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.5, REQ-1.6, REQ-1.7, REQ-1.8, REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4, REQ-2.5, REQ-2.6, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-3.6, REQ-3.7, REQ-3.8, REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.4, REQ-5.5, REQ-5.6, REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4, REQ-6.5, REQ-7.1, REQ-7.2, REQ-7.3, REQ-8.1, REQ-8.2, REQ-8.3, REQ-8.4]` `[DESIGN §2.3, §8.3]`
  - **Alcance:** no crea ni modifica archivos. Ejecuta la verificación global en contenedores. Un fallo se corrige en la tarea dueña del archivo y se repite este bloque completo.
  - **Archivos:** ninguno.
  - **Dependencias:** 3.6.
  - **Criterio de aceptación (todos exit 0):**
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm ci`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx eslint services/payments --max-warnings 0`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npx prettier --check services/payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/payments`
    - `docker compose -f services/payments/compose.dev.yaml build payments`
    - `docker compose -f services/payments/compose.dev.yaml run --rm dev npm run test -w services/payments -- --reporter=verbose` (proyectos `unit` y `db`) sin pruebas omitidas ni fallidas. Evidencia: la salida muestra `[AC-TEX-01]` a `[AC-TEX-44]` aprobados, incluidos `[AC-TEX-08]`, `[AC-TEX-10]`, `[AC-TEX-14]`, `[AC-TEX-22]`, `[AC-TEX-23]`, `[AC-TEX-38]` y `[AC-TEX-39]`.
    - `docker compose -f services/payments/compose.dev.yaml up -d --wait payments`
    - `docker compose -f services/payments/compose.dev.yaml down -v`

---

## 4. Cobertura EARS: requerimiento → tareas

| Requerimiento | Tareas |
|:---|:---|
| REQ-1.1 | 1.2, 2.1, 3.1, 3.3, 3.4, 4.1 |
| REQ-1.2 | 1.2, 3.4, 4.1 |
| REQ-1.3 | 1.2, 2.1, 3.4, 4.1 |
| REQ-1.4 | 1.2, 3.3, 3.4, 4.1 |
| REQ-1.5 | 1.2, 3.3, 3.4, 4.1 |
| REQ-1.6 | 2.1, 3.4, 4.1 |
| REQ-1.7 | 1.2, 3.2, 3.4, 4.1 |
| REQ-1.8 | 1.2, 3.5, 4.1 |
| REQ-2.1 | 2.1, 3.3, 3.4, 4.1 |
| REQ-2.2 | 2.1, 3.5, 4.1 |
| REQ-2.3 | 2.1, 3.4, 4.1 |
| REQ-2.4 | 3.3, 3.4, 4.1 |
| REQ-2.5 | 2.1, 3.4, 4.1 |
| REQ-2.6 | 3.5, 4.1 |
| REQ-3.1 | 2.2, 3.2, 3.3, 3.5, 4.1 |
| REQ-3.2 | 1.2, 2.2, 3.1, 3.5, 4.1 |
| REQ-3.3 | 1.2, 2.2, 3.5, 4.1 |
| REQ-3.4 | 1.2, 2.2, 3.5, 4.1 |
| REQ-3.5 | 1.2, 2.2, 3.5, 4.1 |
| REQ-3.6 | 1.2, 2.2, 3.2, 3.5, 4.1 |
| REQ-3.7 | 1.2, 2.2, 3.2, 3.5, 4.1 |
| REQ-3.8 | 2.2, 3.1, 3.5, 4.1 |
| REQ-4.1 | 1.1, 2.2, 3.1, 3.5, 4.1 |
| REQ-4.2 | 2.2, 3.1, 3.5, 4.1 |
| REQ-4.3 | 1.2, 2.2, 3.1, 3.5, 4.1 |
| REQ-4.4 | 1.1, 1.2, 3.5, 4.1 |
| REQ-5.1 | 2.2, 3.2, 3.5, 4.1 |
| REQ-5.2 | 1.2, 2.2, 3.5, 4.1 |
| REQ-5.3 | 2.2, 3.5, 4.1 |
| REQ-5.4 | 1.2, 2.2, 3.1, 3.5, 4.1 |
| REQ-5.5 | 2.2, 3.5, 4.1 |
| REQ-5.6 | 1.2, 2.2, 3.5, 4.1 |
| REQ-6.1 | 2.1, 3.3, 3.4, 4.1 |
| REQ-6.2 | 3.1, 3.4, 4.1 |
| REQ-6.3 | 3.1, 3.4, 4.1 |
| REQ-6.4 | 3.4, 4.1 |
| REQ-6.5 | 1.2, 2.1, 3.3, 3.4, 3.6, 4.1 |
| REQ-7.1 | 1.2, 2.1, 2.2, 3.5, 4.1 |
| REQ-7.2 | 2.1, 3.5, 4.1 |
| REQ-7.3 | 1.1, 1.2, 3.2, 3.5, 4.1 |
| REQ-8.1 | 3.3, 3.5, 3.6, 4.1 |
| REQ-8.2 | 2.2, 3.2, 3.3, 3.5, 4.1 |
| REQ-8.3 | 3.6, 4.1 |
| REQ-8.4 | 3.3, 3.6, 4.1 |

La tarea 2.2 no tiene archivo de prueba propio. El comportamiento de REQ-3.1 a REQ-3.8, REQ-4.1 a REQ-4.3, REQ-5.1 a REQ-5.6 y REQ-8.2 queda cubierto por las pruebas de las tareas 3.2, 3.3 y 3.5, que dependen de 2.2. Ninguna tarea excluye ni condiciona el alcance de un requerimiento EARS.

---

## 5. Execution Progress Tracker
| Fase | Total Tareas | Completadas | Estado |
|:---|:---:|:---:|:---|
| **Phase 1: Foundation, Schemas & Core Domain** | 2 | 0 | `Pending` |
| **Phase 2: Core Logic & Application Layer** | 2 | 0 | `Pending` |
| **Phase 3: Presentation, Endpoints & Integration** | 6 | 0 | `Pending` |
| **Phase 4: Verification, Testing & Polish** | 1 | 0 | `Pending` |
| **Total Global** | **11** | **0** | **0%** |

---

## 6. Definition of Done (DoD) Gate
- [x] Todas las tareas están marcadas como completadas (`[x]`).
- [x] Todos los criterios EARS de `requirements.md` pasan las pruebas asociadas (`[AC-TEX-01]` a `[AC-TEX-44]`).
- [x] La estructura de archivos coincide con el mapeo de `design.md` §5.
- [x] Todos los tests unitarios, de integración y de aceptación pasan sin advertencias críticas.
- [x] La fila del spec en el `INDEX.md` de specs (`.makia/docs/specs/services/payments/INDEX.md`) está sincronizada con el `Estado global` de `summary.md`.

---

> IMPLEMENT ejecuta este documento tarea por tarea. Cada tarea se valida con un TEST acotado a sus propios archivos (no la suite completa) antes de marcarse `[x]`. Máximo 2 iteraciones de corrección por tarea antes de cancelar y escalar (ver sub-orchestrator.md del Orquestador).
