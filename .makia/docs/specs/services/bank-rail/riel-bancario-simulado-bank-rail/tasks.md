# Implementation Tasks: Riel bancario simulado (servicio bank-rail)

## 1. Metadata & Traceability
- **Spec:** `riel-bancario-simulado-bank-rail`
- **Requirements Ref:** `requirements.md` (spec: `riel-bancario-simulado-bank-rail`)
- **Design Ref:** `design.md` (spec: `riel-bancario-simulado-bank-rail`)

`[P]`: puede ejecutarse en paralelo (archivos distintos, sin dependencias).

---

## 2. Execution Guidelines
- **Sequential Ordering:** ejecutar las fases en orden estricto; dentro de cada fase, las subtareas atómicas se completan antes de pasar a la siguiente. Una tarea solo inicia cuando todas las tareas listadas en su campo **Depende de** están marcadas `[x]`. El orden sigue datos → reglas → interfaces e infraestructura.
- **Test-Verified:** cada funcionalidad debe tener su prueba correspondiente antes de marcarse `[x]`. Las pruebas incluyen en su nombre el ID `[AC-RIE-NN]` del criterio que verifican.
- **Traceability Tags:** cada tarea referencia su origen en `requirements.md` (ej. `[REQ-1.1]`) y su componente en `design.md` (ej. `[DESIGN §5]`).
- **Rutas:** todas las rutas son relativas a la raíz del repositorio. Los archivos de raíz del monorepo (`package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.npmrc`, `.gitattributes`, `.dockerignore`, `lefthook.yml`, `.githooks/pre-commit`) ya existen y este spec no los toca; su único archivo de raíz tocado es `package-lock.json`.
- **Entorno:** todo comando se ejecuta dentro del contenedor `dev` (nada se ejecuta en el host salvo `git` y `docker`). Los comandos se lanzan desde la raíz del repositorio con el prefijo `docker compose -f services/bank-rail/compose.dev.yaml`. No hay base de datos: todo comando de `dev` usa `run --rm --no-deps dev`.
- **Comando de pruebas `unit`:** `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project unit <ruta>`.
- **Comando de pruebas `acceptance`:** `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project acceptance <ruta>`.
- **Typecheck del servicio:** `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/bank-rail`.
- **Limpieza:** `docker compose -f services/bank-rail/compose.dev.yaml down -v`.
- **Evidencia:** una tarea con campo **Evidencia** solo se marca `[x]` cuando la evidencia descrita queda registrada (salida de comandos o aserciones de las pruebas indicadas).
- **Archivos de prueba creados antes que las rutas que ejercitan:** `design.md § 5` fija en qué tarea nace cada archivo. Cuando una prueba de aceptación necesita rutas de una tarea posterior, la tarea que la crea la ejecuta solo con el filtro `-t` indicado y la tarea posterior la ejecuta completa; esa tarea posterior es la que cubre el criterio.
- **Versiones:** si una verificación falla por versiones de dependencias, se reporta; no se cambian versiones sin escalar.

---

## 3. Phase Breakdown & Actionable Tasks

### Phase 1: Foundation, Schemas & Core Domain
- [x] **Task 1.1: Entorno de contenedores de desarrollo** `[REQ-9.1]` `[DESIGN §2.3, §5]`
  - **Archivos:**
    - `services/bank-rail/compose.dev.yaml` (crear; solo el servicio `dev` y los volúmenes con nombre `node_modules_root`, `node_modules_bank_rail`, `npm_cache`)
    - `services/bank-rail/Dockerfile` (crear; solo la etapa `dev`)
  - **Depende de:** ninguna (primera tarea, antes de cualquier código de producto).
  - **Alcance:** crear el entorno 100 % Docker de desarrollo con el contenido exacto de `design.md § 2.3`: `compose.dev.yaml` (proyecto `fluxone-bank-rail-dev`, YAML con comillas simples) con el servicio `dev` (contexto = raíz del repositorio, repositorio montado en `/app`) y la etapa `dev` del `Dockerfile` (`node:24.22.0-alpine`, `git`, `safe.directory /app`, `WORKDIR /app`). No incluye el servicio `bank-rail` ni la imagen runtime (tarea 4.2).
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f services/bank-rail/compose.dev.yaml config -q`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev node --version` (muestra `v24.22.0`)
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev git --version`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps -w / dev sh -c "git config --system --get-all safe.directory | grep -qx /app"` (`-w /`: `git` corre con cwd `/`. Prohibido ejecutarlo con cwd `/app` o con cualquier cwd desde el que Git descubra `/app/.git`. Ese archivo es un gitfile de worktree; si Git lo descubre, sale 1 con `fatal: not a git repository: (null)` aunque la imagen ya tenga `safe.directory=/app`. No montar un volumen sobre `/app/.git`.)
    - limpieza: `docker compose -f services/bank-rail/compose.dev.yaml down -v`
  - **Evidencia:** salida de cada comando.

- [x] **Task 1.2: Workspace `services/bank-rail` e instalación reproducible** `[REQ-9.1]` `[DESIGN §1, §5]`
  - **Archivos:** `services/bank-rail/package.json`, `services/bank-rail/tsconfig.json`, `services/bank-rail/tsconfig.build.json`, `services/bank-rail/vitest.config.ts`, `package-lock.json` (modificar: regenerado con `npm install`)
  - **Depende de:** 1.1
  - **Alcance:** crear el workspace `@fluxone/bank-rail` con las versiones exactas de `design.md § 1` y la configuración de `design.md § 5` (sección "Configuración del workspace"), y regenerar `package-lock.json` con `npm install` dentro del contenedor `dev`. `vitest.config.ts` define los proyectos `unit` y `acceptance`. Es la verificación de versiones: instalación reproducible y chequeos base antes de escribir código de producto.
  - **Criterio de aceptación:** todos con código de salida 0 y en este orden:
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm install` (regenera `package-lock.json`)
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm ci`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev node -e "const p=JSON.parse(require('node:fs').readFileSync('services/bank-rail/package.json','utf8'));for(const d of [p.dependencies,p.devDependencies])for(const v of Object.values(d))if(/[\^~]/.test(v))process.exit(1);if(p.name!=='@fluxone/bank-rail')process.exit(1)"`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run typecheck --workspaces --if-present`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run lint`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run format:check`
  - **Evidencia:** salida de cada comando. Si `npm ci` o `tsc` fallan por versiones, se reporta (no se cambian versiones sin escalar).

- [x] **Task 1.3: Dominio puro con pruebas unitarias** `[REQ-1.6, REQ-1.7, REQ-2.1, REQ-2.2, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5, REQ-4.6, REQ-5.5, REQ-6.2]` `[DESIGN §3.1]`
  - **Archivos:**
    - `services/bank-rail/src/domain/errors.ts`
    - `services/bank-rail/src/domain/amount.ts`
    - `services/bank-rail/src/domain/reference.ts`
    - `services/bank-rail/src/domain/requests.ts`
    - `services/bank-rail/src/domain/operation.ts`
    - `services/bank-rail/src/domain/outcome.ts`
    - `services/bank-rail/src/domain/reversal-rules.ts`
    - `services/bank-rail/tests/unit/domain/amount.test.ts`
    - `services/bank-rail/tests/unit/domain/reference.test.ts`
    - `services/bank-rail/tests/unit/domain/requests.test.ts`
    - `services/bank-rail/tests/unit/domain/operation.test.ts`
    - `services/bank-rail/tests/unit/domain/outcome.test.ts`
    - `services/bank-rail/tests/unit/domain/reversal-rules.test.ts`
  - **Depende de:** 1.2
  - **Alcance:** errores de dominio, monto, referencia y partes, solicitudes, operación registrada (`buildOperation`, `isSamePayload`, `parseStoredOperation`, `rejectionCode`), pesos y selección de resultado, y `decideReversalRejection`, según `design.md § 3.1`. Sin imports de Fastify ni de módulos de Node. La cobertura HTTP de estos REQ (códigos de estado, registro y orden de evaluación completo) se verifica en las tareas 3.3 y 3.4; aquí se verifica la regla pura.
  - **Criterio de aceptación:** `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project unit tests/unit/domain` y `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/bank-rail`
  - **Evidencia (comportamiento crítico: idempotencia y reglas de reverso):**
    - `[AC-RIE-09]` `isSamePayload`: mismo `from`, `to` y monto por valor (`10` y `10.00`) es igual; difiere en cualquiera de ellos, o en el tipo de operación, es distinto; en reverso compara `originalReference` y monto.
    - `[AC-RIE-17]`..`[AC-RIE-21]` `decideReversalRejection`: devuelve `ORIGINAL_NOT_FOUND`, `ORIGINAL_NOT_ACCEPTED` (original rechazada y original que es un reverso), `AMOUNT_MISMATCH`, `ALREADY_REVERSED` y `undefined`, y con varias violaciones a la vez gana la de menor número del orden fijo; un reverso previo rechazado no cuenta (se pasa `undefined` como `acceptedReversalOfOriginal`).
    - `[AC-RIE-07]` monto: `0`, `0.00`, `-1`, `1.234`, `01`, número JSON y 17 dígitos enteros inválidos; `9999999999999999.99` válido. Referencia: 255 válida; 256, vacía, con espacio y no ASCII inválidas. Solicitudes: campos faltantes, adicionales y de tipo incorrecto lanzan `ValidationError`.
    - `[AC-RIE-06]`/`[AC-RIE-31]` `parseOutcomeWeights` rechaza `1,2,3`, `a,b,c,d`, `-1,2,3,4`, `0,0,0,0` y `25, 25,25,25`, y acepta `100,0,0,0`; `pickByWeights` respeta los límites de cada tramo y nunca devuelve un resultado de peso 0.
    - `[AC-RIE-28]` `parseStoredOperation` rechaza campos faltantes, `reason` en una operación aceptada e incoherencia entre `kind` y sus campos.

### Phase 2: Core Logic & Application Layer
- [x] **Task 2.1: Puertos, flujo de operación, `SerialExecutor` y casos de uso** `[REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.5, REQ-2.1, REQ-2.2, REQ-2.3, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5, REQ-4.6, REQ-4.7, REQ-4.8, REQ-6.4]` `[DESIGN §4.1]`
  - **Archivos:**
    - `services/bank-rail/src/application/ports/ledger.ts`
    - `services/bank-rail/src/application/ports/outcome-picker.ts`
    - `services/bank-rail/src/application/ports/delay.ts`
    - `services/bank-rail/src/application/operation-result.ts`
    - `services/bank-rail/src/application/serial-executor.ts`
    - `services/bank-rail/src/application/operation-flow.ts`
    - `services/bank-rail/src/application/use-cases/submit-transfer.ts`
    - `services/bank-rail/src/application/use-cases/submit-reversal.ts`
    - `services/bank-rail/src/application/use-cases/get-operation.ts`
    - `services/bank-rail/tests/support/fakes.ts`
    - `services/bank-rail/tests/unit/application/serial-executor.test.ts`
  - **Depende de:** 1.3
  - **Alcance:** los tres puertos (`Ledger`, `OutcomePicker`, `Delay`), los tipos de aplicación, el `SerialExecutor`, el `OperationFlow` con el orden de `design.md § 4.1` (idempotencia, reglas, sorteo, registro, espera del timeout fuera de la sección serializada), los tres casos de uso y los dobles de prueba (`SequenceOutcomePicker`, `FakeDelay`, `FlakyLedger`). Solo dependen de `src/domain` y de los puertos. Los REQ de comportamiento (1.x, 2.x, 3.x, 4.x) se cubren transitivamente: esta tarea implementa la lógica y la verificación de extremo a extremo con las rutas y el ledger real está en las tareas 3.3 y 3.4; aquí se verifica el `SerialExecutor` y el tipado.
  - **Criterio de aceptación:** `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project unit tests/unit/application` y `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/bank-rail`
  - **Evidencia (comportamiento crítico: concurrencia):** `[AC-RIE-10]` `SerialExecutor` ejecuta las tareas de una en una y en orden de llegada (una segunda tarea no inicia hasta que termina la primera) y el rechazo de una tarea no bloquea las siguientes ni se oculta a quien la llamó.

- [ ] **Task 2.2: Adaptadores de salida: ledger JSONL, sorteo aleatorio y reloj** `[REQ-1.6, REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.4, REQ-5.5, REQ-5.6, REQ-6.4]` `[DESIGN §3.2, §4.3]`
  - **Archivos:**
    - `services/bank-rail/src/adapters/outbound/ledger/jsonl-file-ledger.ts`
    - `services/bank-rail/src/adapters/outbound/random/random-outcome-picker.ts`
    - `services/bank-rail/src/adapters/outbound/time/system-delay.ts`
    - `services/bank-rail/tests/unit/adapters/jsonl-file-ledger.test.ts`
    - `services/bank-rail/tests/unit/adapters/random-outcome-picker.test.ts`
    - `services/bank-rail/tests/unit/adapters/system-delay.test.ts`
  - **Depende de:** 2.1
  - **Alcance:** implementar los puertos `Ledger` (`JsonlFileLedger`: carga, índices, línea final truncada, línea corrupta, `append` serializado), `OutcomePicker` (`RandomOutcomePicker`) y `Delay` (`SystemDelay`), según `design.md § 3.2` y `§ 4.3`.
  - **Criterio de aceptación:** `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project unit tests/unit/adapters`
  - **Evidencia (comportamiento crítico: persistencia del ledger):**
    - `[AC-RIE-26]` `open` crea el directorio y el archivo si no existen y arranca con el libro vacío.
    - `[AC-RIE-24]` cada `append` deja exactamente una línea JSON terminada en `\n` con las claves en el orden de `design.md § 3.2`, y `append` resuelve solo después de escribir.
    - `[AC-RIE-25]` tras `append` y reabrir con `open`, `find` y `findAcceptedReversalOf` devuelven las mismas operaciones.
    - `[AC-RIE-27]` línea final sin `\n` que no es JSON: se ignora, el archivo queda truncado hasta el último `\n` y `loadWarnings` trae `rail.ledger_truncated_line_discarded`; una última línea válida sin `\n` se acepta.
    - `[AC-RIE-28]` línea intermedia corrupta o referencia repetida: `open` rechaza con un mensaje que indica el número de línea y el archivo no cambia.
    - `[AC-RIE-29]` con el archivo reemplazado por un directorio, `append` lanza `LedgerUnavailableError`, la operación no queda visible y un `append` posterior sigue operativo; escrituras concurrentes producen líneas íntegras.
    - `[AC-RIE-06]` `RandomOutcomePicker` con `random` inyectado reparte según los pesos y `pickTimeoutProcessed` cambia en el umbral 0.5.

### Phase 3: Presentation, Endpoints & Integration
- [ ] **Task 3.1: Configuración** `[REQ-6.1, REQ-6.2, REQ-6.3]` `[DESIGN §4.3]`
  - **Archivos:** `services/bank-rail/src/config.ts`, `services/bank-rail/tests/unit/config.test.ts`
  - **Depende de:** 2.2
  - **Alcance:** `loadConfig(env)` con la tabla de variables de `design.md § 4.3` (`PORT`, `RAIL_OUTCOME_WEIGHTS`, `RAIL_TIMEOUT_DELAY_MS`, `RAIL_LEDGER_PATH`, `LOG_LEVEL`), con los defaults indicados y errores que nombran la variable.
  - **Criterio de aceptación:** `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project unit tests/unit/config.test.ts`
  - **Evidencia:**
    - `[AC-RIE-30]` sin variables definidas devuelve `3004`, pesos `25,25,25,25`, `15000`, `/data/rail-ledger.jsonl` e `info`; con valores válidos los respeta.
    - `[AC-RIE-31]` pesos inválidos (`1,2,3`, `a,b,c,d`, `-1,2,3,4`, `0,0,0,0`, `25, 25,25,25`) lanzan un error cuyo mensaje contiene `RAIL_OUTCOME_WEIGHTS`.
    - `[AC-RIE-32]` `PORT` fuera de 1–65535, `RAIL_TIMEOUT_DELAY_MS` no entero o negativo, `RAIL_LEDGER_PATH` vacío y `LOG_LEVEL` desconocido lanzan un error cuyo mensaje nombra la variable; una variable definida y vacía se valida (no toma el default).

- [ ] **Task 3.2: Raíz de composición, arranque y base HTTP con health, errores y logs** `[REQ-5.4, REQ-6.2, REQ-6.4, REQ-7.1, REQ-7.2, REQ-7.3, REQ-7.4]` `[DESIGN §4.2, §4.3, §7.1]`
  - **Archivos:**
    - `services/bank-rail/src/compose.ts`
    - `services/bank-rail/src/main.ts`
    - `services/bank-rail/src/adapters/inbound/http/app.ts`
    - `services/bank-rail/src/adapters/inbound/http/error-handler.ts`
    - `services/bank-rail/src/adapters/inbound/http/schemas.ts`
    - `services/bank-rail/src/adapters/inbound/http/operation-presenter.ts`
    - `services/bank-rail/src/adapters/inbound/http/routes/health-routes.ts`
    - `services/bank-rail/tests/support/build-test-app.ts`
    - `services/bank-rail/tests/acceptance/operability.test.ts`
    - `services/bank-rail/tests/acceptance/composition.test.ts`
  - **Depende de:** 3.1
  - **Alcance:** `composeApp` (sustitución de `OutcomePicker`, `Delay` y `Ledger`), `main.ts` (arranque, cierre ordenado y salida con código 1 y mensaje en `stderr` si la configuración o el ledger son inválidos), `buildApp` (Fastify con Ajv sin `removeAdditional` ni `coerceTypes`, hooks `rail.request`/`rail.response`, manejadores de error y de ruta inexistente, redacción de `authorization` y `cookie`, advertencias de `loadWarnings` como logs), esquemas, presentador de respuestas, ruta `GET /health` y el helper `buildTestApp`. Las rutas de transferencias y reversos las registran las tareas 3.3 y 3.4: las pruebas que necesitan un `POST` (parte de `operability.test.ts` y `composition.test.ts`) se ejecutan completas en 3.3 y 3.4, que son las tareas que cubren REQ-6.4 y REQ-7.2..7.4 de extremo a extremo; aquí se cubre lo que no requiere esas rutas.
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/bank-rail`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project acceptance tests/acceptance/operability.test.ts -t "AC-RIE-34"`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project acceptance tests/acceptance/operability.test.ts -t "AC-RIE-36"`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps -w /app/services/bank-rail -e RAIL_OUTCOME_WEIGHTS=0,0,0,0 dev sh -c 'out=$(npx tsx src/main.ts 2>&1); rc=$?; printf "%s\n" "$out" | grep -q RAIL_OUTCOME_WEIGHTS && [ "$rc" -ne 0 ]'`
  - **Evidencia:**
    - `[AC-RIE-34]` `GET /health` responde 200 `{status:"ok"}`.
    - `[AC-RIE-36]` `GET /health` con cabecera `Authorization` responde igual que sin ella.
    - `[AC-RIE-31]` `npx tsx src/main.ts` con `RAIL_OUTCOME_WEIGHTS=0,0,0,0` termina con código distinto de 0 (`rc` capturado de `tsx` antes del pipe) y un mensaje que contiene `RAIL_OUTCOME_WEIGHTS` (el comando de aceptación exige ambas condiciones a la vez; verificación por comando de `requirements.md`).

- [ ] **Task 3.3: Transferencias y consulta: rutas, idempotencia y persistencia de extremo a extremo** `[REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.5, REQ-1.6, REQ-1.7, REQ-2.1, REQ-2.2, REQ-2.3, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-3.5, REQ-5.1, REQ-5.2, REQ-5.4, REQ-5.5, REQ-5.6, REQ-6.4, REQ-7.4]` `[DESIGN §4.1, §4.2, §8.3]`
  - **Archivos:**
    - `services/bank-rail/src/adapters/inbound/http/routes/transfers-routes.ts` (rutas `POST /rail/transfers` y `GET /rail/transfers/{reference}`)
    - `services/bank-rail/src/adapters/inbound/http/app.ts` (modificar para registrar `transfers-routes`)
    - `services/bank-rail/tests/acceptance/transfers.test.ts`
    - `services/bank-rail/tests/acceptance/idempotency.test.ts`
    - `services/bank-rail/tests/acceptance/lookup.test.ts`
    - `services/bank-rail/tests/acceptance/persistence.test.ts`
  - **Depende de:** 3.2
  - **Alcance:** exponer `POST /rail/transfers` (validación, idempotencia, sorteo, observer con `rail.outcome_chosen` y `rail.timeout`) y `GET /rail/transfers/{reference}` (solo lectura) según `design.md § 4.2`, y verificar de extremo a extremo la idempotencia, el conflicto, la concurrencia, el timeout y la persistencia del ledger con `buildTestApp`. Incluye ejecutar completo `composition.test.ts` (REQ-6.4).
  - **Criterio de aceptación:** `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project acceptance tests/acceptance/transfers.test.ts tests/acceptance/idempotency.test.ts tests/acceptance/lookup.test.ts tests/acceptance/persistence.test.ts tests/acceptance/composition.test.ts`
  - **Evidencia (comportamiento crítico: idempotencia y persistencia del ledger):**
    - `[AC-RIE-08]` repetir la referencia con los mismos datos (incluido `10` y luego `10.00`) devuelve el mismo status y cuerpo, con `pickCalls` sin cambio, `delay.waits` sin cambio y sin línea nueva en el archivo.
    - `[AC-RIE-09]` misma referencia con `from`, `to` o monto distintos, o con una referencia que ya pertenece a un reverso, responde 409 `REFERENCE_CONFLICT` y el archivo no cambia.
    - `[AC-RIE-10]` dos `inject` simultáneos (`Promise.all`) con la misma referencia y los mismos datos: `pickCalls === 1`, una sola línea en el archivo y ambas respuestas iguales.
    - `[AC-RIE-01]`..`[AC-RIE-03]` ACCEPTED registra aceptada y responde 200; REJECTED registra `REJECTED_BY_BANK` y responde 422 `REJECTED`; UNAVAILABLE responde 503 sin línea en el archivo y la misma referencia se puede sortear de nuevo.
    - `[AC-RIE-04]` con `FakeDelay` en modo `gated`: mientras el `POST` espera, un `GET` de la referencia ya responde 200 y el archivo ya tiene la línea; tras `release()` el `POST` responde 200 y `delay.waits` es `[timeoutDelayMs]`.
    - `[AC-RIE-05]` TIMEOUT no procesado: espera, responde 503 `UNAVAILABLE`, no deja línea y el `GET` posterior responde 404.
    - `[AC-RIE-06]` con `weights: '100,0,0,0'` y el `RandomOutcomePicker` real, varias referencias distintas responden siempre 200.
    - `[AC-RIE-07]` cuerpos inválidos (referencia vacía, de 256 caracteres o con espacio; monto `0`, `0.00`, negativo, con tres decimales o número JSON; `from` o `to` ausentes; campos faltantes o adicionales; cuerpo que no es JSON) responden 400 `VALIDATION_ERROR` con `pickCalls === 0` y sin línea nueva.
    - `[AC-RIE-11]`..`[AC-RIE-14]` `GET` de transferencia y reverso aceptados responde 200; de rechazada, 422 `REJECTED` con el motivo en el `message`; sin registro, de referencia con formato inválido, de UNAVAILABLE y de TIMEOUT no procesado, 404 `NOT_FOUND`; un `GET` repetido no cambia `pickCalls` ni el contenido del archivo.
    - `[AC-RIE-15]` con `FlakyLedger` en `failReads`, `GET` responde 503 `UNAVAILABLE`.
    - `[AC-RIE-24]` el `POST` responde después de que la línea está en el archivo.
    - `[AC-RIE-25]` tras registrar una aceptada y una rechazada, cerrar la app y componer de nuevo sobre el mismo `ledgerPath`: los `GET` y las repeticiones devuelven los mismos resultados con `pickCalls === 0` en la segunda composición.
    - `[AC-RIE-27]` un archivo sembrado con la última línea truncada arranca, emite la advertencia en los logs y conserva el resto de operaciones.
    - `[AC-RIE-28]` un archivo sembrado con una línea intermedia corrupta hace que la composición rechace con un mensaje que indica el número de línea y el archivo no cambia.
    - `[AC-RIE-29]` con `FlakyLedger` en `failWrites`, `POST` responde 503 `UNAVAILABLE` y, tras `failWrites = false`, el `GET` responde 404.
    - `[AC-RIE-33]` `composition.test.ts` compone el servicio con `OutcomePicker`, `Delay` y `Ledger` sustitutos y las respuestas siguen su control sin esperas reales.

- [ ] **Task 3.4: Reversos: ruta, reglas deterministas y operación de extremo a extremo** `[REQ-4.1, REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5, REQ-4.6, REQ-4.7, REQ-4.8, REQ-7.2, REQ-7.3, REQ-7.4]` `[DESIGN §4.1, §4.2, §7.1, §8.3]`
  - **Archivos:**
    - `services/bank-rail/src/adapters/inbound/http/routes/reversals-routes.ts` (ruta `POST /rail/reversals`)
    - `services/bank-rail/src/adapters/inbound/http/app.ts` (modificar para registrar `reversals-routes`)
    - `services/bank-rail/tests/acceptance/reversals.test.ts`
  - **Depende de:** 3.3
  - **Alcance:** exponer `POST /rail/reversals` según `design.md § 4.2` y verificar de extremo a extremo las reglas de reverso. Incluye ejecutar completo `operability.test.ts` (que ya existe desde 3.2) para cubrir REQ-7.2, REQ-7.3 y REQ-7.4 con los `POST` disponibles.
  - **Criterio de aceptación:** `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project acceptance tests/acceptance/reversals.test.ts tests/acceptance/operability.test.ts`
  - **Evidencia (comportamiento crítico: reglas de reverso):**
    - `[AC-RIE-16]` reverso válido sobre transferencia aceptada con el mismo monto y sorteo ACCEPTED responde 200 y el archivo guarda la línea con `originalReference`.
    - `[AC-RIE-17]`..`[AC-RIE-20]` `ORIGINAL_NOT_FOUND`, `ORIGINAL_NOT_ACCEPTED` (original rechazada y original que es un reverso aceptado), `AMOUNT_MISMATCH` y `ALREADY_REVERSED` responden 422 con su propio `code`, quedan registrados como rechazados con ese motivo y `pickCalls` no aumenta; un reverso previo rechazado no cuenta: el nuevo reverso de la misma original con otra referencia supera las reglas y se sortea.
    - `[AC-RIE-21]` con un reverso que incumple a la vez varias reglas gana la primera del orden `ORIGINAL_NOT_FOUND`, `ORIGINAL_NOT_ACCEPTED`, `AMOUNT_MISMATCH`, `ALREADY_REVERSED`; con cuerpo inválido responde 400 antes de cualquier regla; con referencia ya registrada aplica idempotencia antes de las reglas.
    - `[AC-RIE-22]` repetir la referencia de reverso con los mismos datos devuelve el mismo status y `code` sin sorteo ni línea nueva; con `originalReference` o monto distintos, o si la referencia pertenece a una transferencia, responde 409 `REFERENCE_CONFLICT`.
    - `[AC-RIE-23]` tras superar las reglas, REJECTED responde 422 `REJECTED`, UNAVAILABLE responde 503 sin línea y TIMEOUT procesado y no procesado siguen la semántica de registro y espera de las transferencias.
    - Dos reversos simultáneos de la misma original con distinta referencia dejan como máximo uno aceptado y el otro `ALREADY_REVERSED`.
    - `[AC-RIE-35]` todo error usa `{error:{code,message}}` en español, ruta o método inexistente responde 404 `NOT_FOUND` y un fallo inesperado responde 500 `INTERNAL_ERROR` con cuerpo genérico.
    - `[AC-RIE-36]` los `POST` y `GET` con cabecera `Authorization` responden igual que sin ella.
    - `[AC-RIE-37]` los logs capturados contienen `rail.request`, `rail.response`, `rail.outcome_chosen` (con referencia, tipo y resultado sorteado) y `rail.timeout`, con el `reqId` igual a `X-Request-Id` (o generado si falta), y NO contienen las cabeceras `Authorization` ni `Cookie`, ni cuentas ni montos.

### Phase 4: Verification, Testing & Polish
- [ ] **Task 4.1: [P] Contrato OpenAPI 3.1** `[REQ-8.1]` `[DESIGN §4.2, §5, §8.3]`
  - **Archivos:** `services/bank-rail/openapi.yaml`, `services/bank-rail/tests/acceptance/openapi.test.ts`
  - **Depende de:** 3.4
  - **Alcance:** documentar el contrato HTTP del servicio en OpenAPI 3.1 según `design.md § 5` (sección "Contrato OpenAPI") y verificarlo con una prueba.
  - **Criterio de aceptación:** `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail -- --project acceptance tests/acceptance/openapi.test.ts`
  - **Evidencia:** `[AC-RIE-39]` el archivo declara `openapi: 3.1.x`, describe los cuatro paths de `design.md § 4.2` con sus métodos, los esquemas `TransferRequest`, `ReversalRequest`, `OperationStatus` y `ErrorResponse`, todos los códigos de estado y `code` de error de la tabla de mensajes, y ningún esquema de seguridad.

- [ ] **Task 4.2: [P] Imagen de contenedor del servicio y ejecución en Compose** `[REQ-7.5, REQ-9.1]` `[DESIGN §2.3, §5]`
  - **Archivos:**
    - `services/bank-rail/Dockerfile` (modificar: añadir las etapas `build` y runtime tras la etapa `dev` de 1.1, según `design.md § 5`)
    - `services/bank-rail/compose.dev.yaml` (modificar: añadir el servicio `bank-rail` y el volumen `rail_data`, con el contenido de `design.md § 2.3`)
  - **Depende de:** 3.4
  - **Alcance:** etapas de compilación y runtime del Dockerfile (usuario `node`, `/data` con propietario `node`) y servicio `bank-rail` en Compose (puerto `3004:3004`, volumen `rail_data` en `/data`, healthcheck a `/health`).
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f services/bank-rail/compose.dev.yaml config -q`
    - `docker compose -f services/bank-rail/compose.dev.yaml build bank-rail`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps --entrypoint sh bank-rail -c "ls services/bank-rail/dist/main.js && id -un"` (lista el archivo y muestra `node`)
    - `RAIL_OUTCOME_WEIGHTS=100,0,0,0 docker compose -f services/bank-rail/compose.dev.yaml up -d --wait bank-rail`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev node -e "fetch('http://bank-rail:3004/rail/transfers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reference:'PERSIST-1',from:'ACC-001',to:'EXT-0001',amount:'10.00'})}).then((r)=>process.exit(r.status===200?0:1))"`
    - `docker compose -f services/bank-rail/compose.dev.yaml up -d --force-recreate --wait bank-rail`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev node -e "fetch('http://bank-rail:3004/rail/transfers/PERSIST-1').then((r)=>process.exit(r.status===200?0:1))"`
    - limpieza: `docker compose -f services/bank-rail/compose.dev.yaml down -v`
  - **Evidencia (comportamiento crítico: persistencia en el contenedor):** `[AC-RIE-38]` salida de cada comando: el `POST` responde 200 con los pesos `100,0,0,0` y, tras recrear el contenedor sin borrar volúmenes, el `GET` de `PERSIST-1` responde 200.

- [ ] **Task 4.3: Verificación global del spec** `[REQ-9.1]` `[DESIGN §5, §8.3]`
  - **Archivos:** ninguno (solo verificación).
  - **Depende de:** 4.1, 4.2
  - **Alcance:** ejecutar la verificación completa del monorepo dentro del contenedor `dev` y confirmar la cobertura de los criterios de aceptación AC-RIE-01..40.
  - **Criterio de aceptación:** todos con código de salida 0:
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm ci`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run lint`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run format:check`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run typecheck --workspaces --if-present`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail`
    - `docker compose -f services/bank-rail/compose.dev.yaml config -q`
    - `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev node --version` (muestra `v24.22.0`)
    - `docker compose -f services/bank-rail/compose.dev.yaml down -v`
  - **Evidencia:** salida de cada comando y recuento de pruebas que incluyen `[AC-RIE-` (deben aparecer los AC-RIE-01 a AC-RIE-37 y AC-RIE-39; AC-RIE-38 y AC-RIE-40 se verifican con los comandos de las tareas 4.2 y de esta tarea).

---

## 4. Execution Progress Tracker
| Fase | Total Tareas | Completadas | Estado |
|:---|:---:|:---:|:---|
| **Phase 1: Foundation & Domain** | 3 | 3 | `Done` |
| **Phase 2: Core Logic & Application** | 2 | 1 | `In Progress` |
| **Phase 3: Presentation & Endpoints** | 4 | 0 | `Pending` |
| **Phase 4: Verification & Polish** | 3 | 0 | `Pending` |
| **Total Global** | **12** | **4** | **33%** |

---

## 5. Definition of Done (DoD) Gate
- [ ] Todas las tareas están marcadas como completadas (`[x]`).
- [ ] Todos los criterios EARS de `requirements.md` pasan las pruebas asociadas.
- [ ] Los 40 criterios AC-RIE-01..40 pasan su verificación (ver la tabla de trazabilidad de `requirements.md`).
- [ ] La estructura de archivos coincide con el mapeo de `design.md`.
- [ ] Todos los tests unitarios, de aceptación y los comandos de contenedor pasan sin advertencias críticas.
- [ ] La fila del spec en `.makia/docs/specs/services/bank-rail/INDEX.md` está sincronizada con el `Estado global` de `summary.md`.

---

> IMPLEMENT ejecuta este documento tarea por tarea. Cada tarea se valida con un TEST acotado a sus propios archivos (no la suite completa) antes de marcarse `[x]`. Máximo 2 iteraciones de corrección por tarea antes de cancelar y escalar (ver sub-orchestrator.md del Orquestador).
