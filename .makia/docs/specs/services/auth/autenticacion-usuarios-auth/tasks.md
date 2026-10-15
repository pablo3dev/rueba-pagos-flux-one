# Implementation Tasks: Autenticación de usuarios (servicio auth)

## 1. Metadata & Traceability
- **Spec:** `autenticacion-usuarios-auth`
- **Requirements Ref:** `requirements.md` (spec: `autenticacion-usuarios-auth`)
- **Design Ref:** `design.md` (spec: `autenticacion-usuarios-auth`)

`[P]`: puede ejecutarse en paralelo (archivos distintos, sin dependencias).

---

## 2. Execution Guidelines
- **Sequential Ordering:** ejecutar las fases en orden estricto; dentro de cada fase, las subtareas atómicas se completan antes de pasar a la siguiente. Una tarea solo inicia cuando todas las tareas listadas en su campo **Depende de** están marcadas `[x]`.
- **Test-Verified:** cada funcionalidad debe tener su prueba correspondiente antes de marcarse `[x]`. Las pruebas incluyen en su nombre el ID `[AC-AUT-NN]` del criterio que verifican.
- **Traceability Tags:** cada tarea referencia su origen en `requirements.md` (ej. `[REQ-1.1]`) y su componente en `design.md` (ej. `[DESIGN §5]`).
- **Rutas:** todas las rutas son relativas a la raíz del repositorio.
- **Fase 5:** las tareas 5.1, 5.2 y 5.3 se ejecutan en este orden. El resultado deja el directorio de trabajo del host en `services/auth/` y el prefijo `docker compose -f compose.dev.yaml`. No muevas `.makia/`, `AGENTS.md`, `CLAUDE.md`, `README.md`, el enlace `docs/` ni `.gitignore`.
- **Entorno:** todo comando se ejecuta dentro del contenedor `dev` (nada se ejecuta en el host salvo `git` y `docker`). Los comandos se lanzan desde la raíz del repositorio con el prefijo `docker compose -f services/auth/compose.dev.yaml`.
- **Comando de prueba sin base de datos (`unit`) y de typecheck:** `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm run test -w services/auth -- --project unit <ruta>`.
- **Comando de prueba con base de datos (`db`):** `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db <ruta>` (levanta el servicio `postgres` de Compose, PostgreSQL 18.6 en la red de Compose).
- **Limpieza:** `docker compose -f services/auth/compose.dev.yaml down -v` reinicia el estado de Postgres.
- **Evidencia:** una tarea con campo **Evidencia** solo se marca `[x]` cuando la evidencia descrita queda registrada (salida de comandos o aserciones de las pruebas indicadas).
- **Versiones:** si una verificación falla por versiones de dependencias, se reporta; no se cambian versiones sin escalar.

---

## 3. Phase Breakdown & Actionable Tasks

### Phase 1: Foundation, Schemas & Core Domain
- [x] **Task 1.1: Entorno de contenedores de desarrollo** `[REQ-11.1, REQ-11.2, REQ-10.4]` `[DESIGN §2.3, §5]`
  - **Archivos:**
    - `services/auth/Dockerfile` (crear; en esta tarea solo la etapa `dev`: `FROM node:24.22.0-alpine AS dev`, `RUN apk add --no-cache git`, `RUN git config --system --add safe.directory /app`, `WORKDIR /app`)
    - `services/auth/compose.dev.yaml` (solo los servicios `postgres` y `dev` y sus volúmenes con nombre)
    - `services/auth/docker/postgres-init/01-auth-role-schema.sh`
    - `.dockerignore`
    - `.gitattributes`
  - **Depende de:** ninguna (primera tarea, antes de cualquier código de producto).
  - **Alcance:** crear el entorno 100 % Docker de desarrollo según `design.md § 2.3` y `§ 5`. `compose.dev.yaml` (proyecto `fluxone-auth-dev`, YAML con comillas simples) define `postgres` (`postgres:18.6-alpine`, sin puertos publicados, sin volumen persistente, con el script de inicialización que crea el rol `auth_svc` sin permiso de crear esquemas y el esquema `auth_schema`) y `dev` (Node 24.22.0, imagen construida desde la etapa `dev` del Dockerfile, repo montado en `/app`, alcanza Postgres por `postgres:5432`). `.dockerignore` y `.gitattributes` (`Dockerfile* text eol=lf`, scripts `.sh` con LF) se crean aquí.
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f services/auth/compose.dev.yaml config -q`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev node --version` (muestra `v24.22.0`)
    - `docker compose -f services/auth/compose.dev.yaml up -d --wait postgres`
    - `docker compose -f services/auth/compose.dev.yaml exec -T postgres psql -h 127.0.0.1 -U auth_svc -d fluxone -c "\dn+ auth_schema"` (muestra `auth_schema` con dueño `auth_svc`)
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev node -e "const fs=require('node:fs');if(!fs.readFileSync('.gitattributes','utf8').includes('Dockerfile* text eol=lf')||fs.readFileSync('services/auth/docker/postgres-init/01-auth-role-schema.sh','utf8').includes('\r'))process.exit(1)"`
    - limpieza: `docker compose -f services/auth/compose.dev.yaml down -v`
  - **Evidencia:** salida de cada comando.

- [x] **Task 1.2: Hook de pre-commit: `lefthook.yml` y `.githooks/pre-commit`** `[REQ-10.3]` `[DESIGN §5]`
  - **Archivos:** `lefthook.yml`, `.githooks/pre-commit`
  - **Depende de:** 1.1
  - **Alcance:** crear `lefthook.yml` en la raíz con el contenido exacto de `design.md § 5` (YAML con comillas simples, por `singleQuote` de `.prettierrc`) y el script versionado `.githooks/pre-commit`, que ejecuta `docker compose -f services/auth/compose.dev.yaml run --rm -T --no-deps dev npx lefthook run pre-commit --no-auto-install` y se omite con aviso si `.git` no es un directorio (worktree). El archivo se marca ejecutable en el índice con `git update-index --add --chmod=+x .githooks/pre-commit` al preparar el commit de la tarea. El desarrollador activa el hook con `git config core.hooksPath .githooks` (paso manual, fuera de los criterios).
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev node -e "const fs=require('node:fs');const f=fs.readFileSync('lefthook.yml','utf8');for(const k of ['parallel: true','eslint:','prettier:','typecheck:','stage_fixed: true','npm run typecheck --workspaces --if-present'])if(!f.includes(k))process.exit(1);if(!fs.readFileSync('.githooks/pre-commit','utf8').includes('lefthook run pre-commit'))process.exit(1)"` termina con código 0 (la validación ejecutable de lefthook ocurre en la Tarea 1.4).

- [x] **Task 1.3: Tooling raíz del monorepo** `[REQ-10.1, REQ-10.2]` `[DESIGN §5]`
  - **Archivos:** `package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.npmrc`, `.gitignore` (modificar: solo añadir el bloque `# Proyecto`)
  - **Depende de:** 1.2
  - **Alcance:** crear el tooling raíz del monorepo según `design.md § 5`. `.npmrc` contiene `ignore-scripts=true`.
  - **Criterio de aceptación:** todos con código de salida 0:
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev node -e "JSON.parse(require('node:fs').readFileSync('package.json','utf8'))"`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev node -e "if(!require('node:fs').readFileSync('.npmrc','utf8').includes('ignore-scripts=true'))process.exit(1)"`
  - **Evidencia:** salida de ambos comandos.

- [x] **Task 1.4: Workspace `services/auth` e instalación reproducible** `[REQ-10.1, REQ-10.2, REQ-10.3, REQ-11.1]` `[DESIGN §1, §5]`
  - **Archivos:** `services/auth/package.json`, `services/auth/tsconfig.json`, `services/auth/tsconfig.build.json`, `services/auth/vitest.config.ts`, `package-lock.json` (generado con `npm install`)
  - **Depende de:** 1.3
  - **Alcance:** crear el workspace `services/auth` con las versiones exactas de `design.md § 1` y generar `package-lock.json` con `npm install` dentro del contenedor `dev`. Las devDependencies de pruebas del workspace son `vitest`, `tsx` y `@types/pg`. `vitest.config.ts` define los proyectos `unit` y `db`; el proyecto `db` usa la PostgreSQL 18.6 del servicio `postgres` de Compose y `fileParallelism: false`. Es la verificación de versiones: instalación reproducible y chequeos base antes de escribir código de producto.
  - **Criterio de aceptación:** todos con código de salida 0 y en este orden:
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm install` (genera `package-lock.json`)
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm ci`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npx tsc --noEmit -p services/auth/tsconfig.json`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npx eslint . --max-warnings 0`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npx prettier --check .`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev sh -c "git init -q /tmp/lh && cp lefthook.yml /tmp/lh/ && cd /tmp/lh && /app/node_modules/.bin/lefthook validate | grep -q 'All good'"` (`lefthook validate` sale con 0 sin validar si no hay repo git; por eso se ejecuta en un repo git temporal y se exige la salida `All good`)
  - **Evidencia:** salida de cada comando. Si `npm ci` o `tsc` fallan por versiones, se reporta (no se cambian versiones sin escalar).

- [x] **Task 1.5: [P] Esquema de datos: migración y soporte de pruebas con DB real** `[REQ-1.1, REQ-3.4, REQ-6.2, REQ-11.2]` `[DESIGN §3.2, §8.2]`
  - **Archivos:** `services/auth/migrations/1792022400000_create-auth-tables.sql` (DDL exacto de `design.md § 3.2`), `services/auth/tests/global-setup.ts`, `services/auth/tests/support/db.ts`, `services/auth/tests/integration/migrations.test.ts`, `services/auth/tests/integration/environment.test.ts`
  - **Depende de:** 1.4
  - **Alcance:** migración SQL con el DDL de `design.md § 3.2`, setup global y utilidades de DB real para las pruebas de integración y aceptación. El setup global no inicia contenedores: toma `DATABASE_URL` del entorno (falla con mensaje claro si falta), ejecuta las migraciones con el runner y no crea esquema ni rol (los provee el servicio `postgres` de Compose). `environment.test.ts` verifica el entorno de pruebas.
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db tests/integration/migrations.test.ts tests/integration/environment.test.ts`
  - **Evidencia:**
    - `migrations.test.ts` verifica las tablas `users`, `refresh_tokens`, `signing_keys`, el CHECK `users_email_lower_chk`, el índice único parcial `signing_keys_one_active`, las FKs y la unicidad de `token_hash`.
    - `environment.test.ts` afirma `[AC-AUT-32]`: versión de PostgreSQL 18.6, `current_user` = `auth_svc`, `CREATE SCHEMA` rechazado con código 42501 y `DATABASE_URL` con host `postgres` y puerto 5432.

- [x] **Task 1.6: [P] Dominio puro con pruebas unitarias** `[REQ-1.1, REQ-1.4, REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4]` `[DESIGN §3.1]`
  - **Archivos:** `services/auth/src/domain/errors.ts`, `services/auth/src/domain/email.ts`, `services/auth/src/domain/password-policy.ts`, `services/auth/src/domain/user.ts`, `services/auth/src/domain/refresh-token.ts`, `services/auth/src/domain/signing-key.ts`, `services/auth/tests/unit/domain/email.test.ts`, `services/auth/tests/unit/domain/password-policy.test.ts`, `services/auth/tests/unit/domain/refresh-token.test.ts`
  - **Depende de:** 1.4
  - **Alcance:** errores de dominio, normalización de email, política de contraseña, entidades `User`, `RefreshToken`, `SigningKey` y la función `decideRotation`, según `design.md § 3.1`.
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm run test -w services/auth -- --project unit tests/unit/domain`
  - **Evidencia:** pruebas de límites de contraseña (12 y 128 aceptan; 11 y 129 rechazan), normalización de email y `decideRotation` con las tres salidas `ROTATE`/`REUSED`/`EXPIRED` (incluido revocado y expirado → `REUSED`).

### Phase 2: Core Logic & Application Layer
- [x] **Task 2.1: Puertos y casos de uso con fakes** `[REQ-1.2, REQ-1.3, REQ-2.1, REQ-2.2, REQ-3.1, REQ-3.2, REQ-3.3, REQ-4.1, REQ-4.2, REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2, REQ-7.1]` `[DESIGN §4.1]`
  - **Archivos:**
    - `services/auth/src/application/ports/clock.ts`
    - `services/auth/src/application/ports/password-hasher.ts`
    - `services/auth/src/application/ports/opaque-token-generator.ts`
    - `services/auth/src/application/ports/signing-key-generator.ts`
    - `services/auth/src/application/ports/token-issuer.ts`
    - `services/auth/src/application/ports/user-repository.ts`
    - `services/auth/src/application/ports/refresh-token-repository.ts`
    - `services/auth/src/application/ports/signing-key-repository.ts`
    - `services/auth/src/application/use-cases/register-user.ts`
    - `services/auth/src/application/use-cases/login-user.ts`
    - `services/auth/src/application/use-cases/refresh-session.ts`
    - `services/auth/src/application/use-cases/logout-session.ts`
    - `services/auth/src/application/use-cases/get-profile.ts`
    - `services/auth/src/application/use-cases/get-jwks.ts`
    - `services/auth/src/application/use-cases/ensure-signing-key.ts`
    - `services/auth/src/application/use-cases/seed-demo-users.ts`
    - `services/auth/tests/support/fakes.ts`
    - `services/auth/tests/unit/application/register-user.test.ts`
    - `services/auth/tests/unit/application/login-user.test.ts`
    - `services/auth/tests/unit/application/refresh-session.test.ts`
    - `services/auth/tests/unit/application/logout-session.test.ts`
    - `services/auth/tests/unit/application/ensure-signing-key.test.ts`
    - `services/auth/tests/unit/application/seed-demo-users.test.ts`
  - **Depende de:** 1.6
  - **Alcance:** definir los puertos y los ocho casos de uso de `design.md § 4.1`, con fakes en memoria para probarlos sin infraestructura.
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm run test -w services/auth -- --project unit tests/unit/application`
  - **Evidencia:** login con email inexistente invoca `verify` con `dummyPasswordHash` y lanza `InvalidCredentialsError`; refresh con salida `REUSED` lanza `RefreshTokenReusedError`; logout con token desconocido no falla.

- [x] **Task 2.2: [P] Adaptadores de salida crypto** `[REQ-1.1, REQ-2.4, REQ-3.4, REQ-5.2, REQ-6.2]` `[DESIGN §4.1]`
  - **Archivos:**
    - `services/auth/src/adapters/outbound/crypto/argon2-password-hasher.ts`
    - `services/auth/src/adapters/outbound/crypto/jose-token-issuer.ts`
    - `services/auth/src/adapters/outbound/crypto/jose-signing-key-generator.ts`
    - `services/auth/src/adapters/outbound/crypto/node-opaque-token-generator.ts`
    - `services/auth/src/adapters/outbound/crypto/system-clock.ts`
    - `services/auth/tests/unit/adapters/argon2-password-hasher.test.ts`
    - `services/auth/tests/unit/adapters/jose-token-issuer.test.ts`
    - `services/auth/tests/unit/adapters/jose-signing-key-generator.test.ts`
    - `services/auth/tests/unit/adapters/node-opaque-token-generator.test.ts`
  - **Depende de:** 2.1
  - **Alcance:** implementar los puertos de hashing, emisión y verificación de JWT, generación de llaves, tokens opacos y reloj.
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm run test -w services/auth -- --project unit tests/unit/adapters`
  - **Evidencia:** el hash comienza con `$argon2id$v=19$m=19456,t=2,p=1$`; el JWT tiene header `alg EdDSA` y `kid`, claims `iss`, `aud`, `sub`, `email`, `exp - iat = 900`; se rechazan token expirado, `iss`/`aud` incorrectos y `alg` distinto; el token opaco decodifica a 32 bytes y su hash es SHA-256 hex de 64 caracteres.

- [x] **Task 2.3: [P] Adaptadores de salida Postgres** `[REQ-1.1, REQ-1.3, REQ-3.1, REQ-3.2, REQ-4.1, REQ-6.2, REQ-7.1]` `[DESIGN §3.2, §4.1]`
  - **Archivos:**
    - `services/auth/src/adapters/outbound/postgres/pool.ts`
    - `services/auth/src/adapters/outbound/postgres/migrate.ts`
    - `services/auth/src/adapters/outbound/postgres/pg-user-repository.ts`
    - `services/auth/src/adapters/outbound/postgres/pg-refresh-token-repository.ts`
    - `services/auth/src/adapters/outbound/postgres/pg-signing-key-repository.ts`
    - `services/auth/tests/integration/pg-user-repository.test.ts`
    - `services/auth/tests/integration/pg-refresh-token-repository.test.ts`
    - `services/auth/tests/integration/pg-signing-key-repository.test.ts`
  - **Depende de:** 2.1, 1.5
  - **Alcance:** pool de conexiones, ejecución de migraciones y repositorios Postgres de usuarios, refresh tokens y llaves de firma.
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db tests/integration`
  - **Evidencia:** `rotate` concurrente con `Promise.all` sobre el mismo token produce exactamente un `ROTATED` y un `REUSED` y deja revocada toda la familia; `insertIfNoActive` concurrente deja una sola llave activa; `insert` de email duplicado lanza `EmailAlreadyRegisteredError`.

### Phase 3: Presentation, Endpoints & Integration
- [x] **Task 3.1: Configuración, raíz de composición y base HTTP con JWKS y health** `[REQ-6.1, REQ-6.2, REQ-7.1, REQ-8.1, REQ-8.2]` `[DESIGN §4.2, §4.3]`
  - **Archivos:**
    - `services/auth/src/config.ts`
    - `services/auth/src/compose.ts`
    - `services/auth/src/main.ts`
    - `services/auth/src/adapters/inbound/http/app.ts`
    - `services/auth/src/adapters/inbound/http/error-handler.ts`
    - `services/auth/src/adapters/inbound/http/schemas.ts`
    - `services/auth/src/adapters/inbound/http/rate-limit.ts`
    - `services/auth/src/adapters/inbound/http/refresh-cookie.ts`
    - `services/auth/src/adapters/inbound/http/routes/jwks-routes.ts`
    - `services/auth/src/adapters/inbound/http/routes/health-routes.ts`
    - `services/auth/tests/support/build-test-app.ts`
    - `services/auth/tests/acceptance/jwks.test.ts`
  - **Depende de:** 2.2, 2.3
  - **Alcance:** carga y validación de configuración, composición de dependencias, arranque (migraciones, llave de firma activa y usuarios demo), aplicación HTTP base con manejo de errores, rate limiting, cookie de refresh y rutas JWKS y health. La verificación de la semilla (AC-AUT-21) se hace en la Tarea 3.2, cuando existe la ruta de inicio de sesión.
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db tests/acceptance/jwks.test.ts` y `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm run typecheck -w services/auth`.
  - **Evidencia (comportamiento crítico):**
    - `[AC-AUT-20]` compone la app dos veces sobre la misma DB y verifica mismo `kid` y que un token emitido antes del segundo arranque verifica contra el JWKS del segundo.
      - Evidencia observada (2026-10-15): `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db --reporter=verbose tests/acceptance/jwks.test.ts` → exit 0, 1 archivo y 2 pruebas pasan contra PostgreSQL 18.6 de Compose: `✓ [AC-AUT-20] reutiliza el mismo par de llaves tras reiniciar y verifica tokens previos (283 ms)` (mismo `kid` en el JWKS de ambos arranques, 1 sola fila en `auth_schema.signing_keys`, token previo verificado con `jose` contra el JWKS del segundo arranque) y `✓ [AC-AUT-19] publica solo la llave pública Ed25519 vigente, sin material privado (523 ms)`.

- [x] **Task 3.2: Registro e inicio de sesión** `[REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.5, REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4, REQ-2.5, REQ-7.1, REQ-8.3]` `[DESIGN §4.2, §7.2]`
  - **Archivos:** `services/auth/src/adapters/inbound/http/routes/auth-routes.ts` (rutas `POST /auth/register` y `POST /auth/login`), `services/auth/src/adapters/inbound/http/app.ts` (modificar para registrarlas), `services/auth/tests/acceptance/register.test.ts`, `services/auth/tests/acceptance/login.test.ts`, `services/auth/tests/acceptance/seed.test.ts`
  - **Depende de:** 3.1
  - **Alcance:** exponer `POST /auth/register` y `POST /auth/login` con validación, límites de tasa por IP y cookie de refresh, y verificar la semilla de usuarios demo.
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db tests/acceptance/register.test.ts tests/acceptance/login.test.ts tests/acceptance/seed.test.ts`
  - **Evidencia (seguridad/límites):**
    - `[AC-AUT-05]` el 11.º registro por IP recibe 429.
    - `[AC-AUT-08]` el 6.º login por IP recibe 429 e IP distintas tienen límites independientes.
    - `[AC-AUT-06]` la cookie incluye `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Max-Age=604800`.
    - `[AC-AUT-07]` 401 sin cookie y mismo mensaje para email inexistente y contraseña errónea.
    - `[AC-AUT-09]` el token verifica con el JWKS publicado.
    - `[AC-AUT-21]` arrancar la app dos veces sobre la misma DB deja exactamente 3 usuarios demo con los ids fijos (sin duplicar ni modificar a los existentes) y alice, bob y carol inician sesión con `DEMO_USERS_PASSWORD`.
    - Evidencia observada (2026-10-15): `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db --reporter=verbose tests/acceptance/register.test.ts tests/acceptance/login.test.ts tests/acceptance/seed.test.ts` → 3 archivos y 15 pruebas pasan contra PostgreSQL 18.6 de Compose, entre ellas: `✓ [AC-AUT-05] el 11.º registro por IP recibe 429 RATE_LIMITED y no se procesa`; `✓ [AC-AUT-08] el 6.º login por IP recibe 429 RATE_LIMITED e IP distintas tienen límites independientes`; `✓ [AC-AUT-06] un login válido responde 200 con la sesión y la cookie refresh_token con sus atributos` (HttpOnly, SameSite=Strict, Path=/api/auth, Max-Age=604800); `✓ [AC-AUT-07] email inexistente y contraseña errónea dan 401 con el mismo mensaje y sin cookie`; `✓ [AC-AUT-09] el access token EdDSA de 15 min verifica con el JWKS publicado`; `✓ [AC-AUT-21] arrancar dos veces deja exactamente 3 usuarios demo con ids fijos, sin modificar a los existentes`.

- [x] **Task 3.3: Renovación, cierre de sesión y perfil** `[REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-4.1, REQ-4.2, REQ-5.1, REQ-5.2, REQ-8.3]` `[DESIGN §4.1, §4.2]`
  - **Archivos:** `services/auth/src/adapters/inbound/http/routes/auth-routes.ts` (modificar: rutas `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`), `services/auth/tests/acceptance/refresh.test.ts`, `services/auth/tests/acceptance/logout.test.ts`, `services/auth/tests/acceptance/profile.test.ts`
  - **Depende de:** 3.2
  - **Alcance:** exponer `POST /auth/refresh` (rotación con detección de reutilización), `POST /auth/logout` y `GET /auth/me` (verificación del token de acceso).
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db tests/acceptance/refresh.test.ts tests/acceptance/logout.test.ts tests/acceptance/profile.test.ts`
  - **Evidencia (seguridad/expiración):**
    - `[AC-AUT-12]` la reutilización revoca toda la familia (el token sucesor deja de servir) y responde 401 `REFRESH_TOKEN_REUSED`.
    - `[AC-AUT-11]` dos renovaciones simultáneas con el mismo token: una 200 y otra 401 `REFRESH_TOKEN_REUSED`.
    - `[AC-AUT-13]` cookie con firma alterada, expirada (fila con `expires_at` pasado) y ausente → 401 `REFRESH_TOKEN_INVALID`.
    - `[AC-AUT-14]` la DB guarda solo SHA-256 (el valor de la cookie no aparece en `refresh_tokens`) y `expires_at` = emisión + 7 días.
    - `[AC-AUT-18]` token expirado, firma inválida, `iss` y `aud` incorrectos → 401 `UNAUTHORIZED`.
    - Evidencia observada (2026-10-15): `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db --reporter=verbose tests/acceptance/refresh.test.ts tests/acceptance/logout.test.ts tests/acceptance/profile.test.ts` → 3 archivos y 18 pruebas pasan contra PostgreSQL 18.6 de Compose, entre ellas: `✓ [AC-AUT-11] dos renovaciones simultáneas con el mismo token: una 200 y otra 401 REFRESH_TOKEN_REUSED`; `✓ [AC-AUT-12] la reutilización revoca toda la familia: el token sucesor deja de servir y responde 401 REFRESH_TOKEN_REUSED`; `✓ [AC-AUT-13] cookie ausente, alterada, desconocida y expirada responden 401 REFRESH_TOKEN_INVALID y limpian la cookie`; `✓ [AC-AUT-14] la base solo guarda el SHA-256 del token y expires_at = emisión + 7 días`; `✓ [AC-AUT-18] token expirado, firma inválida, iss y aud incorrectos responden 401 UNAUTHORIZED`.

- [x] **Task 3.4: Operación: health, formato de errores y logs sin secretos** `[REQ-8.1, REQ-8.2, REQ-8.3]` `[DESIGN §4.2, §7.1]`
  - **Archivos:** `services/auth/tests/acceptance/operability.test.ts`; ajustes a los archivos de producción de 3.1–3.3 que la prueba requiera para pasar.
  - **Depende de:** 3.3
  - **Alcance:** verificar de extremo a extremo health, formato uniforme de errores y contenido de los logs.
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db tests/acceptance/operability.test.ts`
  - **Evidencia:**
    - `[AC-AUT-22]` `/health/ready` devuelve 503 con el pool cerrado y `/health/live` 200.
    - `[AC-AUT-23]` ruta inexistente 404 `NOT_FOUND` y error inesperado 500 `INTERNAL_ERROR` con cuerpo genérico.
    - `[AC-AUT-24]` los logs capturados contienen `auth.login_succeeded`, `auth.login_failed` (con hash SHA-256 del email) y `auth.refresh_reuse_detected`, y NO contienen la contraseña, el token de acceso, el valor de la cookie ni el email en el evento de login fallido.
    - Evidencia observada (2026-10-15): `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db --reporter=verbose tests/acceptance/operability.test.ts` → 1 archivo y 4 pruebas pasan contra PostgreSQL 18.6 de Compose: `✓ [AC-AUT-22] /health/ready devuelve 503 con el pool cerrado y /health/live sigue en 200`; `✓ [AC-AUT-23] una ruta inexistente responde 404 NOT_FOUND con el formato uniforme`; `✓ [AC-AUT-23] un error inesperado responde 500 INTERNAL_ERROR con cuerpo genérico y queda en el log`; `✓ [AC-AUT-24] los logs registran los eventos de auth sin contraseña, token, cookie ni email en el login fallido`.

### Phase 4: Verification, Testing & Polish
- [x] **Task 4.1: [P] Contrato OpenAPI 3.1** `[REQ-9.1]` `[DESIGN §4.2, §8.3]`
  - **Archivos:** `services/auth/openapi.yaml`, `services/auth/tests/acceptance/openapi.test.ts`
  - **Depende de:** 3.3
  - **Alcance:** documentar el contrato HTTP del servicio en OpenAPI 3.1 y verificarlo con una prueba.
  - **Criterio de aceptación:** `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test -w services/auth -- --project db tests/acceptance/openapi.test.ts`
  - **Evidencia:** `[AC-AUT-26]` el archivo declara `openapi: 3.1.x` y describe cada ruta y método de `design.md § 4.2` con sus respuestas de éxito y error, el esquema de error `{error:{code,message}}`, la cookie `refresh_token` y el esquema bearer.

- [x] **Task 4.2: [P] Imagen de contenedor del servicio y ejecución en Compose** `[REQ-8.4]` `[DESIGN §5]`
  - **Archivos:**
    - `services/auth/Dockerfile` (modificar: añadir las etapas `build` y runtime tras la etapa `dev` de 1.1, según `design.md § 5`; el `.dockerignore` raíz ya existe desde 1.1)
    - `services/auth/compose.dev.yaml` (modificar: añadir el servicio `auth`: build del Dockerfile con el contexto en la raíz del repositorio, puerto `3001:3001`, variables `PORT`, `DATABASE_URL`, `COOKIE_SECRET`, `COOKIE_SECURE=false` y `DEMO_USERS_PASSWORD`, `depends_on` con `postgres` en estado healthy, healthcheck con `wget` a `/health/ready`)
  - **Depende de:** 3.4
  - **Alcance:** etapas de compilación y runtime del Dockerfile según `design.md § 5` y servicio `auth` en Compose, ejecutando el servicio empaquetado contra el `postgres` de Compose.
  - **Criterio de aceptación:** todos con código de salida 0, en este orden:
    - `docker compose -f services/auth/compose.dev.yaml build auth`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps --entrypoint sh auth -c "ls services/auth/dist/main.js services/auth/migrations && id -un"` (lista ambos y muestra `node`)
    - `docker compose -f services/auth/compose.dev.yaml up -d --wait auth`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev node -e "fetch('http://auth:3001/.well-known/jwks.json').then((r) => process.exit(r.ok ? 0 : 1))"`
    - limpieza: `docker compose -f services/auth/compose.dev.yaml down -v`
  - **Evidencia:** salida de cada comando.

- [x] **Task 4.3: Verificación global del spec** `[REQ-10.1, REQ-10.2, REQ-10.3, REQ-10.4, REQ-11.1]` `[DESIGN §5, §8.3]`
  - **Archivos:** ninguno nuevo.
  - **Depende de:** 4.1, 4.2
  - **Alcance:** ejecutar la verificación completa del monorepo dentro del contenedor `dev` y confirmar la cobertura de los criterios de aceptación.
  - **Criterio de aceptación:** todos con código de salida 0:
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm ci`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm run lint`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm run format:check`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev npm run typecheck --workspaces --if-present`
    - `docker compose -f services/auth/compose.dev.yaml run --rm dev npm run test --workspaces --if-present`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev sh -c "git init -q /tmp/lh && cp lefthook.yml /tmp/lh/ && cd /tmp/lh && /app/node_modules/.bin/lefthook validate | grep -q 'All good'"`
    - `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev node -e "const fs=require('node:fs');if(!fs.readFileSync('.gitattributes','utf8').includes('Dockerfile* text eol=lf')||fs.readFileSync('services/auth/docker/postgres-init/01-auth-role-schema.sh','utf8').includes('\r'))process.exit(1)"`
    - `docker compose -f services/auth/compose.dev.yaml down -v`
  - **Evidencia:** salida de cada comando y recuento de pruebas que incluyen `[AC-AUT-` (deben aparecer los AC-AUT-01 a AC-AUT-24, AC-AUT-26 y AC-AUT-32).
    - Evidencia observada (2026-10-15), vía `makia verify --run` (8 comandos del criterio de aceptación, todos PASS, código de salida 0): `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck --workspaces --if-present`, `npm run test --workspaces --if-present` (suites `unit` y `db` verdes contra PostgreSQL 18.6 de Compose), `lefthook validate` con `All good`, comprobación de LF en `.gitattributes` y en el script de init de Postgres, y `down -v`. Recuento: las pruebas de `services/auth/tests` incluyen 137 casos con ID `[AC-AUT-NN]` en su nombre y cubren los 26 IDs exigidos: AC-AUT-01 a AC-AUT-24, AC-AUT-26 y AC-AUT-32 (0 faltantes).

### Phase 5: Límite de la unidad
- [x] **Task 5.1: Mover el tooling de la unidad a `services/auth/`** `[REQ-10.1, REQ-10.2, REQ-10.3, REQ-10.4]` `[DESIGN §2.7, §5]`
  - **Archivos:**
    - `services/auth/tsconfig.base.json` (mover desde `tsconfig.base.json`)
    - `services/auth/eslint.config.js` (mover desde `eslint.config.js`)
    - `services/auth/.prettierrc` (mover desde `.prettierrc`)
    - `services/auth/.prettierignore` (mover desde `.prettierignore`)
    - `services/auth/.npmrc` (mover desde `.npmrc`)
    - `services/auth/.gitattributes` (mover desde `.gitattributes`)
    - `services/auth/.dockerignore` (mover desde `.dockerignore`)
    - `services/auth/lefthook.yml` (mover desde `lefthook.yml` y ajustar el comando `typecheck` a `npm run typecheck`; cada comando lleva `root: services/auth`)
    - `services/auth/.githooks/pre-commit` (mover desde `.githooks/pre-commit`; el contenido se ajusta en la tarea 5.2)
    - `services/auth/package-lock.json` (mover desde `package-lock.json`; se regenera en la tarea 5.3)
    - `services/auth/package.json` (modificar: un solo paquete `@fluxone/auth`, sin campo `workspaces`; conserva dependencies y scripts `build`, `dev`, `start`, `typecheck`, `test`; añade `engines.node` `24.22.0`, scripts `lint`, `format`, `format:check` y las devDependencies de tooling: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals`, `prettier`, `lefthook`, `@types/node`, `typescript`, además de `vitest`, `tsx`, `@types/pg`)
    - `package.json` de la raíz del repositorio (eliminar tras volcar su tooling en `services/auth/package.json`)
    - `services/auth/tsconfig.json` (modificar: `extends` pasa de `../../tsconfig.base.json` a `./tsconfig.base.json`)
  - **Depende de:** 4.3
  - **Alcance:** dejar dentro de `services/auth/` los archivos de la unidad que hoy están en la raíz del repositorio, y fusionar los dos `package.json` en el del servicio. No cambies reglas de identidad, esquema, endpoints ni el código de `src/` o `tests/`. No muevas `.makia/`, `AGENTS.md`, `CLAUDE.md`, `README.md`, el enlace `docs/` ni `.gitignore`. El contenido de `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.npmrc` y `.gitattributes` no cambia; solo su ruta. `lefthook.yml` queda como en `design.md` §5.
  - **Criterio de aceptación:** desde la raíz del repositorio, este comando termina con código 0 (el Compose de esta tarea sigue siendo el previo a la tarea 5.2, con el repositorio montado en `/app`): `docker compose -f services/auth/compose.dev.yaml run --rm --no-deps dev node -e "const fs=require('node:fs');const must=['services/auth/package.json','services/auth/package-lock.json','services/auth/tsconfig.base.json','services/auth/eslint.config.js','services/auth/.prettierrc','services/auth/.prettierignore','services/auth/.npmrc','services/auth/.gitattributes','services/auth/.dockerignore','services/auth/lefthook.yml','services/auth/.githooks/pre-commit'];const gone=['package.json','package-lock.json','tsconfig.base.json','eslint.config.js','.prettierrc','.prettierignore','.npmrc','.gitattributes','.dockerignore','lefthook.yml','.githooks/pre-commit'];for(const p of must)if(!fs.existsSync(p))process.exit(1);for(const p of gone)if(fs.existsSync(p))process.exit(1);const pkg=JSON.parse(fs.readFileSync('services/auth/package.json','utf8'));if(pkg.name!=='@fluxone/auth'||pkg.workspaces||!pkg.scripts.lint||!pkg.devDependencies.lefthook||!String(fs.readFileSync('services/auth/tsconfig.json','utf8')).includes('./tsconfig.base.json')||!fs.readFileSync('services/auth/.npmrc','utf8').includes('ignore-scripts=true'))process.exit(1)"`
  - **Evidencia:** salida de ese comando.
  - Evidencia observada (2026-10-15): el traslado ya está en f43f47c. En el host, los 11 archivos exigidos existen bajo services/auth/ y los 11 homólogos no existen en la raíz. package.json es @fluxone/auth, sin workspaces, con script lint y devDependency lefthook; tsconfig.json extiende ./tsconfig.base.json; .npmrc contiene ignore-scripts=true. No se repitió el move.

- [x] **Task 5.2: Contexto Docker y comando de la unidad** `[REQ-8.4, REQ-10.3, REQ-11.1]` `[DESIGN §2.3, §5]`
  - **Archivos:**
    - `services/auth/compose.dev.yaml` (modificar: `context: .`, `dockerfile: Dockerfile` en `dev` y en `auth`; `dev.working_dir` `/app`; volúmenes `.:/app`, `../..:/repo`, `node_modules` en `/app/node_modules` y en `/repo/services/auth/node_modules`, `npm_cache` en `/root/.npm`; sin `node_modules_root` ni `node_modules_auth`)
    - `services/auth/Dockerfile` (modificar: `safe.directory` `/app` y `/repo`; etapas `build` y runtime con `npm ci` y `npm run build` sin workspaces; copiar `dist` y `migrations` a `/app`; `CMD ["node","dist/main.js"]`)
    - `services/auth/.githooks/pre-commit` (modificar al contenido exacto de `design.md` §2.3; `git update-index --add --chmod=+x services/auth/.githooks/pre-commit`)
  - **Depende de:** 5.1
  - **Alcance:** el contexto de build es el directorio `services/auth/`. El comando que levanta la unidad se ejecuta con el directorio de trabajo en `services/auth/`. El hook, invocado por git desde la raíz del repositorio, entra en `services/auth/` y ejecuta `docker compose -f compose.dev.yaml run --rm -T --no-deps -w /repo dev npx lefthook run pre-commit --config services/auth/lefthook.yml --no-auto-install`. No cambies el servicio `postgres` ni el negocio de identidad.
  - **Criterio de aceptación:** todos con código de salida 0, ejecutados con el directorio de trabajo en `services/auth/`:
    - `docker compose -f compose.dev.yaml config -q`
    - `docker compose -f compose.dev.yaml run --rm --no-deps dev node --version` (muestra `v24.22.0`)
    - `docker compose -f compose.dev.yaml run --rm --no-deps dev node -e "const fs=require('node:fs');const c=fs.readFileSync('compose.dev.yaml','utf8');if(c.includes('context: ../..')||c.includes('node_modules_root')||c.includes('node_modules_auth')||!c.includes('context: .'))process.exit(1);const d=fs.readFileSync('Dockerfile','utf8');if(!d.includes('dist/main.js')||d.includes('services/auth/dist')||d.includes('--workspace'))process.exit(1);const h=fs.readFileSync('.githooks/pre-commit','utf8');if(!h.includes('docker compose -f compose.dev.yaml')||!h.includes('cd services/auth'))process.exit(1)"`
  - **Evidencia:** salida de cada comando.
  - Evidencia observada (2026-10-15), vía makia verify --cwd services/auth (todos PASS, código 0): docker compose -f compose.dev.yaml config -q; node --version mostró v24.22.0; el node -e del criterio (context: ., sin node_modules_root ni node_modules_auth, Dockerfile con dist/main.js y sin --workspace, hook con docker compose y cd services/auth) PASS.

- [x] **Task 5.3: Lockfile y verificación de la unidad** `[REQ-10.1, REQ-10.2, REQ-10.3, REQ-10.4, REQ-11.1, REQ-8.4]` `[DESIGN §2.3, §5, §8]`
  - **Archivos:** `services/auth/package-lock.json` (regenerar con `npm install` dentro del contenedor `dev`)
  - **Depende de:** 5.2
  - **Alcance:** regenerar el lockfile del paquete único y verificar instalación, lint, tipos, pruebas, lefthook, saltos de línea y la imagen `auth`. Los comandos se ejecutan con el directorio de trabajo en `services/auth/`.
  - **Criterio de aceptación:** todos con código de salida 0, en este orden, con el directorio de trabajo en `services/auth/`:
    - `docker compose -f compose.dev.yaml run --rm --no-deps dev npm install`
    - `docker compose -f compose.dev.yaml run --rm --no-deps dev npm ci`
    - `docker compose -f compose.dev.yaml run --rm --no-deps dev npm run lint`
    - `docker compose -f compose.dev.yaml run --rm --no-deps dev npm run format:check`
    - `docker compose -f compose.dev.yaml run --rm --no-deps dev npm run typecheck`
    - `docker compose -f compose.dev.yaml run --rm dev npm run test`
    - `docker compose -f compose.dev.yaml run --rm --no-deps dev sh -c "git init -q /tmp/lh && cp lefthook.yml /tmp/lh/ && cd /tmp/lh && /app/node_modules/.bin/lefthook validate | grep -q 'All good'"`
    - `docker compose -f compose.dev.yaml run --rm --no-deps dev node -e "const fs=require('node:fs');if(!fs.readFileSync('.gitattributes','utf8').includes('Dockerfile* text eol=lf')||fs.readFileSync('docker/postgres-init/01-auth-role-schema.sh','utf8').includes('\r'))process.exit(1)"`
    - `docker compose -f compose.dev.yaml build auth`
    - `docker compose -f compose.dev.yaml run --rm --no-deps --entrypoint sh auth -c "ls dist/main.js migrations && id -un"` (lista ambos y muestra `node`)
    - `docker compose -f compose.dev.yaml down -v`
  - **Evidencia:** salida de cada comando. Las pruebas deben seguir cubriendo AC-AUT-01 a AC-AUT-24, AC-AUT-26 y AC-AUT-32.
  - Evidencia observada (2026-10-15), vía makia verify --cwd services/auth (11 comandos PASS, código 0): npm install, npm ci, npm run lint, npm run format:check, npm run typecheck, npm run test (22.5s, suites unit y db), lefthook validate con All good, comprobación LF de .gitattributes y del script de init, build auth, ls dist/main.js migrations && id -un (dist/main.js, migrations/1792022400000_create-auth-tables.sql, usuario node) y down -v. package-lock.json no cambió. Las pruebas siguen cubriendo AC-AUT-01 a AC-AUT-24, AC-AUT-26 y AC-AUT-32.

---

## 4. Execution Progress Tracker
| Fase | Total Tareas | Completadas | Estado |
|:---|:---:|:---:|:---|
| **Phase 1: Foundation & Domain** | 6 | 6 | `Done` |
| **Phase 2: Core Logic & Application** | 3 | 3 | `Done` |
| **Phase 3: Presentation & Endpoints** | 4 | 4 | `Done` |
| **Phase 4: Verification & Polish** | 3 | 3 | `Done` |
| **Phase 5: Límite de la unidad** | 3 | 3 | `Done` |
| **Total Global** | **19** | **19** | **100%** |

---

## 5. Definition of Done (DoD) Gate
- [x] Todas las tareas están marcadas como completadas (`[x]`).
- [x] Todos los criterios EARS de `requirements.md` pasan las pruebas asociadas.
- [x] Los 32 criterios AC-AUT-01..32 pasan su verificación (ver la tabla de trazabilidad de `requirements.md`).
- [x] La estructura de archivos coincide con el mapeo de `design.md`.
- [x] Todos los tests unitarios, de integración y E2E pasan sin advertencias críticas.
- [x] La fila del spec en `.makia/docs/specs/services/auth/INDEX.md` está sincronizada con el `Estado global` de `summary.md`.

---

> IMPLEMENT ejecuta este documento tarea por tarea. Cada tarea se valida con un TEST acotado a sus propios archivos (no la suite completa) antes de marcarse `[x]`. Máximo 2 iteraciones de corrección por tarea antes de cancelar y escalar (ver sub-orchestrator.md del Orquestador).
