# Transferencias internas (Pagos)

> Este documento es el **artefacto de aprobación del USUARIO**. Es autosuficiente: todo lo necesario para aprobar el alcance, los objetivos y los criterios de éxito del spec está aquí. El modelo de negocio de la capacidad vive en [domain-model.md](../domain-model.md).

- **Spec:** `transferencias-internas-payments`

## Resumen

Servicio de Pagos (`services/payments`, puerto 3002) que permite al cliente autenticado consultar sus cuentas y saldos, transferir dinero en COP entre cuentas del sistema y consultar sus transferencias, sin duplicar débitos, sin saldos negativos y sin perder dinero.

## Problema

Un cliente del portal necesita mover dinero entre cuentas y saber cuánto tiene. Hoy no existe ninguna forma de hacerlo. Una operación monetaria mal resuelta (doble clic, reintento por una red inestable, dos transferencias simultáneas) puede duplicar un débito, dejar un saldo negativo o hacer que el dinero total del sistema deje de cuadrar, y el cliente pierde confianza en el portal.

## Solución

- **En qué consiste:** el cliente autenticado puede listar sus cuentas, consultar el saldo de cada una, transferir un monto a otra cuenta del sistema, consultar una transferencia concreta y ver su historial paginado. Cada transferencia queda registrada como COMPLETED (el dinero se movió) o FAILED por fondos insuficientes (no se movió nada). Repetir una solicitud con la misma clave de idempotencia nunca produce un segundo movimiento.
- **Cómo resuelve el problema:** el débito, el crédito y el registro de la transferencia ocurren juntos o no ocurren; el saldo nunca baja de cero; las transferencias simultáneas entre las mismas cuentas se resuelven sin bloqueos mutuos y con saldos consistentes; la clave de idempotencia garantiza un único efecto por intención del cliente; cada usuario solo ve sus cuentas y las transferencias en las que participa.

## Objetivos y criterios de éxito

- **Objetivo 1:** ninguna combinación de reintentos, repeticiones o solicitudes concurrentes produce un doble débito: la suma de saldos de las tres cuentas semilla permanece en 1500000.00 COP.
- **Objetivo 2:** el saldo de toda cuenta es siempre mayor o igual a 0.
- **Objetivo 3:** cada usuario consulta únicamente sus cuentas y las transferencias donde es dueño de la cuenta origen o destino; cualquier otro recurso se comporta como inexistente.
- **Objetivo 4:** todo rechazo usa un código de error estable y un mensaje claro, sin datos sensibles.
- **Objetivo 5:** el servicio arranca con sus datos iniciales listos sin pasos manuales y se ejecuta, prueba y construye íntegramente en contenedores.

---

## Actores de negocio y flujo de valor

- **Cliente autenticado:** usuario del portal con credencial de acceso vigente. Consulta sus cuentas y saldos, transfiere dinero a otra cuenta del sistema y consulta el estado y el historial de sus transferencias. Valor: mover dinero con certeza del resultado.
- **Dueño de la cuenta destino:** cliente que recibe una transferencia. Puede consultarla y verla en su historial. Valor: confirmar lo recibido.
- **Operador del entorno:** levanta el servicio y verifica su salud (`/health/live`, `/health/ready`) y sus registros. Valor: operar el servicio con visibilidad.

---

## Delimitación del Alcance (Scope Boundaries)

- **Dentro del Alcance (In Scope - Fase Actual):**
  - Verificación de la credencial de acceso (Bearer JWT) en todos los endpoints de negocio.
  - Listado de cuentas del usuario y consulta de saldo de una cuenta propia.
  - Transferencia entre dos cuentas del sistema (tipo `INTERNAL`) con estado COMPLETED o FAILED por `INSUFFICIENT_FUNDS`.
  - Idempotencia de la creación de transferencias.
  - Consulta de una transferencia y de su historial paginado (cursor).
  - Datos iniciales: tres cuentas en COP y su saldo.
  - Endpoints de salud, errores uniformes, logs JSON y contrato OpenAPI 3.1 del servicio.
  - Ejecución, pruebas y construcción en contenedores Docker.
- **Fuera del Alcance (Out of Scope / Non-Goals):**
  - Alta, edición y baja de cuentas; las cuentas existen solo por los datos iniciales y un usuario recién registrado no tiene cuentas.
  - Monedas distintas de COP y conversión de moneda.
  - Purga o expiración de claves de idempotencia ya almacenadas.
  - Emisión y gestión de credenciales de usuario (la verificación consume credenciales emitidas por el servicio de autenticación).
  - Interfaz gráfica.

---

## Reglas de Negocio y Políticas del Dominio

- **RN-01 Credencial:** todo endpoint de negocio exige `Authorization: Bearer <JWT>` firmado con EdDSA, con emisor `urn:fluxone:auth` y audiencia `urn:fluxone:api`, vigente (tolerancia de reloj de 5 s) y verificable con las llaves públicas publicadas por el servicio de autenticación. El `sub` del token es el id del usuario que opera.
- **RN-02 Montos:** el monto es COP, es un string decimal que cumple `^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$`, es estrictamente mayor que 0 y como máximo 9999999999999999.99. Un número JSON o un string que no cumpla el formato es inválido. Todo monto y saldo en las respuestas es un string con exactamente 2 decimales.
- **RN-03 Saldo nunca negativo:** un débito solo se aplica si el saldo es mayor o igual al monto. Un saldo exactamente igual al monto es suficiente y deja la cuenta en 0.00.
- **RN-04 Cuentas de la transferencia:** la cuenta origen debe existir y pertenecer al usuario que opera; la cuenta destino debe existir (puede ser de otro usuario); origen y destino deben ser distintos.
- **RN-05 Fondos insuficientes:** si el saldo del origen es menor que el monto, la transferencia se registra FAILED con `failureReason` `INSUFFICIENT_FUNDS`, sin mover saldos, y la respuesta es 201.
- **RN-06 Estados:** una transferencia nace y permanece en COMPLETED o FAILED. FAILED siempre lleva `failureReason`; COMPLETED no lo lleva.
- **RN-07 Atomicidad y concurrencia:** el débito, el crédito, el registro de la transferencia y la respuesta de idempotencia se confirman en una sola transacción: todo o nada. Transferencias simultáneas en sentidos opuestos entre las mismas cuentas (A→B y B→A) no se bloquean mutuamente y dejan saldos consistentes.
- **RN-08 Idempotencia:** la creación de transferencias (operación `CREATE_TRANSFER`) exige el header `Idempotency-Key`: 1 a 255 caracteres ASCII imprimibles (0x21 a 0x7E). El ámbito de la clave es (usuario, operación, clave). Misma clave y mismo payload devuelven la respuesta almacenada (mismo status y body) con el header `Idempotent-Replayed: true`, sin un segundo efecto, incluso en solicitudes concurrentes. Misma clave con payload distinto es un conflicto. El payload se compara por su huella: sha256 hexadecimal del JSON canónico (claves ordenadas) del body concatenado con la operación. Solo se almacenan respuestas de solicitudes que produjeron efecto (201); los rechazos 4xx sin efecto no se almacenan. Usuarios distintos con la misma clave son independientes. Las consultas (GET) ignoran la clave.
- **RN-09 Visibilidad:** una transferencia es visible para el dueño de la cuenta origen y para el dueño de la cuenta destino; para cualquier otro usuario no existe. Una cuenta es visible solo para su dueño.
- **RN-10 Historial:** el historial incluye las transferencias donde el usuario es dueño de la cuenta origen o destino, ordenado de la más reciente a la más antigua (`created_at` descendente, luego `id` descendente), con paginación por cursor opaco. `limit` por defecto 20, máximo 100.
- **RN-11 Datos iniciales:** al arrancar el servicio existen, sin duplicarse en arranques repetidos, tres cuentas en COP: `ACC-001` de alice (`11111111-1111-4111-8111-111111111111`) con 1000000.00, `ACC-002` de bob (`22222222-2222-4222-8222-222222222222`) con 500000.00 y `ACC-003` de carol (`33333333-3333-4333-8333-333333333333`) con 0.00. Un usuario sin cuentas recibe una lista vacía.
- **RN-12 Errores:** todo error responde `{error:{code,message}}` con mensaje en español, sin datos sensibles. Las solicitudes y respuestas rechazan campos no definidos en el contrato.

---

## Requerimientos Funcionales y Criterios EARS

### REQ-01: Autenticación de solicitudes
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** que el servicio reconozca mi identidad con la credencial que obtuve al iniciar sesión
  - **Para:** operar solo sobre mis propias cuentas y transferencias

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-1.1 (Flujo Principal):**
  - `CUANDO` una solicitud a un endpoint de negocio trae una credencial Bearer válida según RN-01
  - `EL SISTEMA DEBE` atenderla como el usuario identificado por el `sub` del token.
- **REQ-1.2 (Excepción):**
  - `SI` la credencial está ausente, expirada, con firma inválida o con emisor o audiencia incorrectos `CUANDO` se solicita un endpoint de negocio
  - `EL SISTEMA DEBE` responder 401 con código `UNAUTHORIZED` sin ejecutar la operación.

### REQ-02: Consulta de cuentas y saldo
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** ver mis cuentas y el saldo de cada una
  - **Para:** saber de cuánto dinero dispongo

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-2.1 (Flujo Principal):**
  - `CUANDO` el cliente solicita `GET /accounts`
  - `EL SISTEMA DEBE` responder 200 con las cuentas cuyo dueño es el usuario (id, moneda COP, saldo como string de 2 decimales), y una lista vacía si el usuario no tiene cuentas.
- **REQ-2.2 (Flujo Principal):**
  - `CUANDO` el cliente solicita `GET /accounts/{id}/balance` de una cuenta propia
  - `EL SISTEMA DEBE` responder 200 con el saldo actual de la cuenta como string de 2 decimales.
- **REQ-2.3 (Excepción):**
  - `SI` la cuenta no existe o pertenece a otro usuario `CUANDO` se solicita su saldo
  - `EL SISTEMA DEBE` responder 404 con código `ACCOUNT_NOT_FOUND`, idéntico en ambos casos.

### REQ-03: Creación de transferencias internas
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** transferir un monto desde una cuenta mía a otra cuenta del sistema
  - **Para:** mover dinero con certeza del resultado

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-3.1 (Flujo Principal):**
  - `CUANDO` el cliente envía `POST /transfers` con `{type:"INTERNAL", fromAccountId, toAccountId, amount}` válido, una cuenta origen propia con saldo suficiente y un `Idempotency-Key` válido
  - `EL SISTEMA DEBE` debitar el origen, acreditar el destino, registrar la transferencia COMPLETED y responder 201 con la transferencia, todo en una sola transacción atómica.
- **REQ-3.2 (Condicional):**
  - `CUANDO` el saldo del origen es exactamente igual al monto
  - `EL SISTEMA DEBE` completar la transferencia y dejar el saldo del origen en 0.00.
- **REQ-3.3 (Excepción, fondos insuficientes):**
  - `SI` el saldo del origen es menor que el monto `CUANDO` se crea la transferencia
  - `EL SISTEMA DEBE` registrar la transferencia FAILED con `failureReason` `INSUFFICIENT_FUNDS`, no modificar ningún saldo y responder 201.
- **REQ-3.4 (Excepción, monto):**
  - `SI` el monto está ausente, es un número JSON o no cumple RN-02 (por ejemplo `"0"`, `"-1"`, `"1.234"`, o mayor a 9999999999999999.99) `CUANDO` se crea la transferencia
  - `EL SISTEMA DEBE` responder 400 con código `INVALID_AMOUNT` sin registrar nada.
- **REQ-3.5 (Excepción, cuentas):**
  - `SI` la cuenta origen no existe o no pertenece al usuario `CUANDO` se crea la transferencia
  - `EL SISTEMA DEBE` responder 404 con código `ACCOUNT_NOT_FOUND`.
  - `SI` la cuenta destino no existe `CUANDO` se crea la transferencia
  - `EL SISTEMA DEBE` responder 404 con código `DESTINATION_NOT_FOUND`.
  - `SI` origen y destino son la misma cuenta `CUANDO` se crea la transferencia
  - `EL SISTEMA DEBE` responder 422 con código `SAME_ACCOUNT`.
  - En todos estos casos el sistema no modifica saldos ni registra la transferencia.
- **REQ-3.6 (Excepción, forma de la solicitud):**
  - `SI` el body no es un objeto, le faltan campos, trae campos adicionales o `type` es distinto de `INTERNAL` `CUANDO` se crea la transferencia
  - `EL SISTEMA DEBE` responder 400 con código `VALIDATION_ERROR` sin registrar nada.
- **REQ-3.7 (Ubicuo):**
  - `EL SISTEMA DEBE` mantener en todo momento el saldo de toda cuenta mayor o igual a 0 y la suma de saldos del sistema constante.
- **REQ-3.8 (Concurrencia):**
  - `CUANDO` se ejecutan simultáneamente transferencias A→B y B→A entre las mismas cuentas
  - `EL SISTEMA DEBE` completarlas sin bloqueo mutuo y dejar saldos consistentes con el resultado de cada transferencia.

### REQ-04: Idempotencia de la creación
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** repetir una solicitud de transferencia sin que el dinero se mueva dos veces
  - **Para:** reintentar con seguridad ante un doble clic o una red inestable

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-4.1 (Excepción, clave):**
  - `SI` el header `Idempotency-Key` falta o no cumple RN-08 (vacío, más de 255 caracteres o con caracteres fuera de 0x21 a 0x7E) `CUANDO` se crea una transferencia
  - `EL SISTEMA DEBE` responder 400 con código `IDEMPOTENCY_KEY_REQUIRED` sin ejecutar la operación.
- **REQ-4.2 (Repetición):**
  - `CUANDO` el mismo usuario repite `POST /transfers` con la misma clave y el mismo payload
  - `EL SISTEMA DEBE` responder con el mismo status y body de la respuesta original, agregar el header `Idempotent-Replayed: true` y no realizar un segundo débito.
- **REQ-4.3 (Concurrencia):**
  - `CUANDO` llegan simultáneamente dos o más solicitudes con la misma clave y el mismo payload
  - `EL SISTEMA DEBE` ejecutar un único débito y devolver respuestas iguales, marcando como repetidas las que no ejecutaron el efecto.
- **REQ-4.4 (Conflicto de payload):**
  - `SI` se reutiliza una clave con un payload distinto `CUANDO` se crea una transferencia
  - `EL SISTEMA DEBE` responder 422 con código `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` sin ejecutar la operación.
- **REQ-4.5 (Operación en curso):**
  - `SI` otra solicitud con la misma clave sigue en curso y la espera supera 5 segundos `CUANDO` se crea una transferencia
  - `EL SISTEMA DEBE` responder 409 con código `IDEMPOTENCY_KEY_IN_PROGRESS` sin ejecutar la operación.
- **REQ-4.6 (Ubicuo):**
  - `EL SISTEMA DEBE` guardar la respuesta de idempotencia en la misma transacción que el efecto, almacenar solo respuestas con efecto (201, incluidas las FAILED por `INSUFFICIENT_FUNDS`) y no almacenar los rechazos 4xx sin efecto, de modo que una solicitud rechazada pueda reintentarse con la misma clave una vez corregida.
- **REQ-4.7 (Ámbito):**
  - `CUANDO` dos usuarios distintos usan la misma clave
  - `EL SISTEMA DEBE` tratar cada ámbito de forma independiente, sin compartir respuestas ni conflictos.

### REQ-05: Consulta de una transferencia
- **Historia de Usuario:**
  - **Como:** Cliente autenticado (origen o destino)
  - **Quiero:** consultar el detalle de una transferencia
  - **Para:** confirmar su resultado

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-5.1 (Flujo Principal):**
  - `CUANDO` el dueño de la cuenta origen o el dueño de la cuenta destino solicita `GET /transfers/{id}`
  - `EL SISTEMA DEBE` responder 200 con la transferencia (id, tipo, cuentas, monto como string de 2 decimales, moneda, estado, `failureReason` solo si es FAILED, fechas), sin exigir `Idempotency-Key`.
- **REQ-5.2 (Excepción):**
  - `SI` la transferencia no existe, el id no tiene formato válido o el usuario no es dueño de la cuenta origen ni de la destino `CUANDO` se consulta
  - `EL SISTEMA DEBE` responder 404 con código `TRANSFER_NOT_FOUND`, idéntico en todos los casos.

### REQ-06: Historial de transferencias
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** ver mi historial de transferencias enviadas y recibidas
  - **Para:** revisar mis movimientos

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-6.1 (Flujo Principal):**
  - `CUANDO` el cliente solicita `GET /transfers`
  - `EL SISTEMA DEBE` responder 200 con las transferencias donde es dueño de la cuenta origen o destino, ordenadas por `created_at` descendente y `id` descendente, y nunca incluir transferencias de terceros.
- **REQ-6.2 (Paginación):**
  - `CUANDO` el cliente indica `limit` (por defecto 20, máximo 100) o un cursor recibido en una respuesta anterior
  - `EL SISTEMA DEBE` devolver la página siguiente sin repetir ni omitir transferencias, aun si se crean nuevas durante la paginación, e incluir un cursor opaco cuando existan más resultados.
- **REQ-6.3 (Excepción):**
  - `SI` `limit` es menor que 1, mayor que 100 o no es entero, o el cursor es inválido `CUANDO` se solicita el historial
  - `EL SISTEMA DEBE` responder 400 con código `VALIDATION_ERROR`.
- **REQ-6.4 (Condicional):**
  - `CUANDO` el usuario no tiene transferencias
  - `EL SISTEMA DEBE` responder 200 con una lista vacía.

### REQ-07: Datos iniciales
- **Historia de Usuario:**
  - **Como:** Operador del entorno
  - **Quiero:** que el servicio arranque con sus cuentas demo listas
  - **Para:** operar sin pasos manuales

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-7.1 (Flujo Principal):**
  - `CUANDO` el servicio arranca
  - `EL SISTEMA DEBE` preparar sus datos y crear las cuentas de RN-11, sin duplicarlas ni modificar sus saldos en arranques posteriores, y operar con un rol de base de datos limitado a su propio esquema.

### REQ-08: Operabilidad
- **Historia de Usuario:**
  - **Como:** Operador del entorno
  - **Quiero:** verificar la salud del servicio, recibir errores uniformes y contar con registros útiles
  - **Para:** operar y diagnosticar el servicio sin exponer información sensible

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-8.1 (Salud):**
  - `CUANDO` se solicita `GET /health/live`
  - `EL SISTEMA DEBE` responder 200.
  - `CUANDO` se solicita `GET /health/ready`
  - `EL SISTEMA DEBE` responder 200 si la base de datos es alcanzable y 503 si no lo es.
- **REQ-8.2 (Errores uniformes):**
  - `EL SISTEMA DEBE` responder todo error con `{error:{code,message}}` con mensaje en español, sin datos sensibles, y rechazar campos no definidos en solicitudes y respuestas.
- **REQ-8.3 (Registros):**
  - `EL SISTEMA DEBE` emitir logs JSON que incluyan el identificador de la solicitud (`X-Request-Id`) y nunca registrar las cabeceras `Authorization`, `Cookie` ni `Set-Cookie`.

### REQ-09: Contrato público
- **Historia de Usuario:**
  - **Como:** Consumidor de la API
  - **Quiero:** un contrato formal del servicio
  - **Para:** integrarme sin ambigüedades

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-9.1 (Ubicuo):**
  - `EL SISTEMA DEBE` publicar `services/payments/openapi.yaml` (OpenAPI 3.1) describiendo todos los endpoints, sus esquemas de solicitud, respuesta y error, y el header `Idempotency-Key`.

### REQ-10: Entorno contenedorizado
- **Historia de Usuario:**
  - **Como:** Operador del entorno
  - **Quiero:** instalar, probar y ejecutar el servicio solo con Docker
  - **Para:** no instalar nada en mi equipo

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-10.1 (Instalación):**
  - `CUANDO` se ejecuta la instalación de dependencias dentro del contenedor de desarrollo
  - `EL SISTEMA DEBE` instalarlas de forma reproducible con Node.js 24.22.0, sin instalar nada en el host.
- **REQ-10.2 (Imagen):**
  - `CUANDO` se construye la imagen del servicio
  - `EL SISTEMA DEBE` contener el servicio compilado y sus migraciones, ejecutarse como usuario no administrador y quedar sano en Compose junto a PostgreSQL 18.6.

---

## Edge Cases & Boundary Conditions
| ID | Escenario / Condición Límite | Comportamiento Esperado del Sistema |
|:---|:---|:---|
| **EC-01** | Dos POST simultáneos con la misma clave y payload | Un solo débito; ambas respuestas iguales y la repetida con `Idempotent-Replayed: true`. |
| **EC-02** | Misma clave con payload distinto | 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`. |
| **EC-03** | Misma clave usada por otro usuario | Ámbitos independientes; ninguna interferencia. |
| **EC-04** | POST sin `Idempotency-Key` | 400 `IDEMPOTENCY_KEY_REQUIRED`. |
| **EC-05** | Monto `"0"`, `"-1"`, `"1.234"` o número JSON | 400 `INVALID_AMOUNT`. |
| **EC-06** | Origen igual a destino | 422 `SAME_ACCOUNT`. |
| **EC-07** | Cuenta origen ajena al usuario | 404 `ACCOUNT_NOT_FOUND`. |
| **EC-08** | Saldo exactamente igual al monto | COMPLETED con saldo 0.00. |
| **EC-09** | Saldo insuficiente (por ejemplo ACC-003 con 0.00 como origen) | 201 con transferencia FAILED `INSUFFICIENT_FUNDS`; saldos intactos. |
| **EC-10** | A→B y B→A simultáneos | Sin bloqueo mutuo; saldos consistentes. |
| **EC-11** | Credencial expirada, con firma inválida o con audiencia o emisor incorrectos | 401 `UNAUTHORIZED`. |
| **EC-12** | Consultar transferencia de terceros | 404 `TRANSFER_NOT_FOUND`. |
| **EC-13** | Solicitud rechazada con 4xx y reintento con la misma clave ya corregida | La respuesta rechazada no se almacenó; el reintento se ejecuta normalmente. |
| **EC-14** | Otra solicitud con la misma clave retiene la operación más de 5 s | 409 `IDEMPOTENCY_KEY_IN_PROGRESS`. |
| **EC-15** | Destinatario inexistente | 404 `DESTINATION_NOT_FOUND`. |
| **EC-16** | Usuario registrado sin cuentas | `GET /accounts` responde `[]`; operar con cuentas ajenas es 404. |
| **EC-17** | Se crean transferencias mientras se pagina el historial | La paginación por cursor no repite ni omite transferencias ya paginadas. |
| **EC-18** | Base de datos no alcanzable | `/health/ready` responde 503; `/health/live` sigue en 200. |

---

## Restricciones Operativas y de Cumplimiento (Nivel Negocio)
- **Tiempo de Respuesta Operativo (SLA de Usuario):** la creación y las consultas deben ser perceptibles como inmediatas (menos de 1 segundo en condiciones normales).
- **Privacidad y Cumplimiento Normativo:** el servicio no almacena datos personales más allá del id de usuario; ningún token ni cabecera de autorización aparece en registros ni en errores.
- **Continuidad de Negocio:** un reinicio del servicio no altera saldos ni transferencias confirmadas, ni las respuestas de idempotencia almacenadas.
- **Ambiente:** todo se instala, ejecuta y prueba en contenedores Docker; no se instala nada en el host. Las credenciales de desarrollo del Compose son desechables y no son secretos del proyecto.

---

## Trazabilidad de criterios de aceptación
Cada prueba automatizada incluye su ID `[AC-TRI-NN]` en el nombre. Las rutas de pruebas son relativas a `services/payments/`. Los comandos se ejecutan desde la raíz del repositorio y usan el prefijo `docker compose -f services/payments/compose.dev.yaml`. En las celdas de la tabla el carácter `|` de un comando se escribe `\|` por sintaxis de tabla. Las pruebas de aceptación usan Fastify `inject`, la PostgreSQL 18.6 real del servicio `postgres` del Compose de desarrollo y un servidor de llaves públicas (JWKS) de prueba efímero con llaves Ed25519.

| AC | Criterio | Verificación |
|:---|:---|:---|
| AC-TRI-01 | REQ-1.1: credencial válida atiende la solicitud como el usuario del `sub` | `tests/acceptance/auth.test.ts` |
| AC-TRI-02 | REQ-1.2: credencial ausente, expirada, de firma inválida o con emisor o audiencia incorrectos responde 401 `UNAUTHORIZED` | `tests/acceptance/auth.test.ts` |
| AC-TRI-03 | REQ-2.1: `GET /accounts` lista solo las cuentas del usuario y `[]` si no tiene | `tests/acceptance/accounts.test.ts` |
| AC-TRI-04 | REQ-2.2: saldo de cuenta propia responde 200 con string de 2 decimales | `tests/acceptance/accounts.test.ts` |
| AC-TRI-05 | REQ-2.3: cuenta inexistente o ajena responde 404 `ACCOUNT_NOT_FOUND` | `tests/acceptance/accounts.test.ts` |
| AC-TRI-06 | REQ-3.1: transferencia válida responde 201 COMPLETED y mueve débito y crédito atómicamente | `tests/acceptance/create-transfer.test.ts` |
| AC-TRI-07 | REQ-3.2: saldo igual al monto completa la transferencia y deja el origen en 0.00 | `tests/acceptance/create-transfer.test.ts` |
| AC-TRI-08 | REQ-3.3: saldo insuficiente registra FAILED `INSUFFICIENT_FUNDS`, responde 201 y no mueve saldos | `tests/acceptance/create-transfer.test.ts` |
| AC-TRI-09 | REQ-3.4: monto ausente, numérico o fuera de formato o rango responde 400 `INVALID_AMOUNT` | `tests/acceptance/create-transfer.test.ts`, `tests/unit/money.test.ts` |
| AC-TRI-10 | REQ-3.5: origen ajeno o inexistente 404 `ACCOUNT_NOT_FOUND`, destino inexistente 404 `DESTINATION_NOT_FOUND`, misma cuenta 422 `SAME_ACCOUNT`, sin efectos | `tests/acceptance/create-transfer.test.ts` |
| AC-TRI-11 | REQ-3.6: body malformado, con campos faltantes o adicionales o `type` distinto de `INTERNAL` responde 400 `VALIDATION_ERROR` | `tests/acceptance/create-transfer.test.ts` |
| AC-TRI-12 | REQ-3.7: el saldo nunca es negativo y la suma de saldos se conserva | `tests/unit/account.test.ts`, `tests/acceptance/create-transfer.test.ts` |
| AC-TRI-13 | REQ-3.8: A→B y B→A simultáneos terminan sin bloqueo mutuo y con saldos consistentes | `tests/acceptance/concurrency.test.ts` |
| AC-TRI-14 | REQ-4.1: clave ausente o inválida responde 400 `IDEMPOTENCY_KEY_REQUIRED` | `tests/acceptance/idempotency.test.ts`, `tests/unit/idempotency-key.test.ts` |
| AC-TRI-15 | REQ-4.2: repetición con misma clave y payload devuelve la misma respuesta con `Idempotent-Replayed: true` y sin segundo débito | `tests/acceptance/idempotency.test.ts` |
| AC-TRI-16 | REQ-4.3: solicitudes simultáneas con misma clave y payload producen un único débito y respuestas iguales | `tests/acceptance/idempotency.test.ts` |
| AC-TRI-17 | REQ-4.4: misma clave con payload distinto responde 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` | `tests/acceptance/idempotency.test.ts` |
| AC-TRI-18 | REQ-4.5: espera de más de 5 s por una solicitud en curso responde 409 `IDEMPOTENCY_KEY_IN_PROGRESS` | `tests/acceptance/idempotency.test.ts` |
| AC-TRI-19 | REQ-4.6: solo se almacenan respuestas 201 en la misma transacción del efecto; los 4xx sin efecto no se almacenan | `tests/acceptance/idempotency.test.ts` |
| AC-TRI-20 | REQ-4.7: usuarios distintos con la misma clave son independientes | `tests/acceptance/idempotency.test.ts` |
| AC-TRI-21 | REQ-5.1: origen y destino consultan la transferencia con 200 sin exigir clave | `tests/acceptance/get-transfer.test.ts` |
| AC-TRI-22 | REQ-5.2: transferencia inexistente, id inválido o de terceros responde 404 `TRANSFER_NOT_FOUND` | `tests/acceptance/get-transfer.test.ts` |
| AC-TRI-23 | REQ-6.1: historial con enviadas y recibidas del usuario, en orden `created_at` y `id` descendentes, sin transferencias de terceros | `tests/acceptance/list-transfers.test.ts` |
| AC-TRI-24 | REQ-6.2: paginación por cursor con `limit` por defecto 20 y máximo 100, sin repetir ni omitir | `tests/acceptance/list-transfers.test.ts` |
| AC-TRI-25 | REQ-6.3: `limit` o cursor inválidos responden 400 `VALIDATION_ERROR` | `tests/acceptance/list-transfers.test.ts` |
| AC-TRI-26 | REQ-6.4: usuario sin transferencias recibe lista vacía | `tests/acceptance/list-transfers.test.ts` |
| AC-TRI-27 | REQ-7.1: cuentas semilla creadas sin duplicarse ni alterar saldos en arranques repetidos; rol limitado a su esquema | `tests/acceptance/seed.test.ts` |
| AC-TRI-28 | REQ-8.1: `/health/live` responde 200; `/health/ready` responde 200 o 503 según la base de datos | `tests/acceptance/operability.test.ts` |
| AC-TRI-29 | REQ-8.2: todo error usa `{error:{code,message}}` en español sin datos sensibles y se rechazan campos no definidos | `tests/acceptance/operability.test.ts` |
| AC-TRI-30 | REQ-8.3: logs JSON con `X-Request-Id` y sin `Authorization`, `Cookie` ni `Set-Cookie` | `tests/acceptance/operability.test.ts` |
| AC-TRI-31 | REQ-9.1: `services/payments/openapi.yaml` (OpenAPI 3.1) describe todos los endpoints | `tests/acceptance/openapi.test.ts` |
| AC-TRI-32 | REQ-10.1: `npm ci` dentro del contenedor Node instala de forma reproducible con Node.js 24.22.0, sin instalar nada en el host | comando `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps dev npm ci` (exit 0) |
| AC-TRI-33 | REQ-10.2: imagen con el servicio compilado y migraciones, como usuario no administrador, y servicio sano en Compose junto a PostgreSQL | en orden: (1) `docker compose -f services/payments/compose.dev.yaml build payments` (exit 0); (2) `docker compose -f services/payments/compose.dev.yaml run --rm --no-deps --entrypoint sh payments -c "ls services/payments/dist/main.js services/payments/migrations && id -un"` (lista ambos y muestra `node`); (3) `docker compose -f services/payments/compose.dev.yaml up -d --wait payments` (exit 0; el healthcheck consulta `/health/ready`); (4) `docker compose -f services/payments/compose.dev.yaml down -v` (limpieza) |

---

> **Reglas de redacción:** este documento habla el lenguaje del negocio y del stakeholder; los códigos de error y HTTP citados son parte del contrato observable. Los nombres de sintaxis (`REQ`, `RN`, `EC`) se mantienen en inglés por estándar; todo el contenido se redacta en español.
