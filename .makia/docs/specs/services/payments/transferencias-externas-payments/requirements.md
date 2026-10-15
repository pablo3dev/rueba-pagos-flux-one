# Transferencias externas (Pagos)

> Este documento es el **artefacto de aprobación del USUARIO**. Es autosuficiente: todo lo necesario para aprobar el alcance, los objetivos y los criterios de éxito del spec está aquí. El modelo de negocio de la capacidad vive en [domain-model.md](../domain-model.md); el contrato vigente de las transferencias internas, en [requirements de transferencias internas](../transferencias-internas-payments/requirements.md); el contrato HTTP del banco simulado, en [requirements del riel](../../bank-rail/riel-bancario-simulado-bank-rail/requirements.md).

- **Spec:** `transferencias-externas-payments`

## Resumen

Extiende el servicio de Pagos (`services/payments`, puerto 3002) para que el cliente autenticado transfiera dinero en COP desde una cuenta propia hacia una cuenta de un banco externo (el riel bancario simulado, un banco no confiable que puede aceptar, rechazar, no estar disponible o responder tarde). El dinero se retiene al crear la transferencia, el servicio lo envía al banco por su cuenta, resuelve los resultados inciertos consultando al banco y, ante cualquier falla definitiva, devuelve los fondos. El dinero nunca se pierde ni se duplica.

## Problema

Un cliente necesita enviar dinero a una cuenta de otro banco. Un banco externo no es confiable: puede rechazar, caerse o tardar tanto que no se sabe si procesó la operación. Si el sistema reintenta a ciegas puede pagar dos veces; si se rinde a ciegas puede dejar el dinero retenido para siempre o devolverlo cuando el banco sí lo pagó. En ambos casos el cliente pierde dinero o confianza. Además, la operación no puede bloquear al cliente esperando al banco.

## Solución

- **En qué consiste:** `POST /transfers` acepta transferencias de tipo `EXTERNAL`. Con saldo suficiente, el sistema debita el origen (fondos retenidos), registra la transferencia como PENDING y responde 202 de inmediato. Procesos internos del servicio envían la transferencia al banco, reintentan cuando el banco no está disponible, y resuelven los casos inciertos (UNKNOWN) consultando al banco por la referencia de la transferencia. El cliente consulta el estado con `GET /transfers/{id}` y `GET /transfers`.
- **Cómo resuelve el problema:** el débito ocurre una sola vez al crear la transferencia; el banco deduplica por una referencia estable (el id de la transferencia) que nunca cambia entre reenvíos; los resultados inciertos se conservan con los fondos retenidos hasta conocer la verdad del banco; solo un rechazo definitivo o la indisponibilidad agotada devuelven los fondos, exactamente una vez; la clave de idempotencia y la coordinación entre procesos impiden el doble débito y el doble envío.

## Objetivos y criterios de éxito

- **Objetivo 1:** ninguna combinación de reintentos del cliente, solicitudes concurrentes, reintentos hacia el banco, procesos concurrentes del servicio o reinicios produce un doble débito ni un doble reembolso.
- **Objetivo 2:** en ausencia de reversos, la suma de saldos de todas las cuentas más los fondos retenidos (transferencias externas PENDING o UNKNOWN) más las transferencias externas COMPLETED es siempre 1500000.00 COP.
- **Objetivo 3:** el saldo de toda cuenta es siempre mayor o igual a 0.
- **Objetivo 4:** toda transferencia externa termina en COMPLETED o FAILED: los resultados inciertos se resuelven por conciliación sin límite de intentos y sin perder los fondos.
- **Objetivo 5:** crear una transferencia externa responde de inmediato (202), sin esperar al banco.
- **Objetivo 6:** las transferencias internas se comportan exactamente igual que antes de este spec.
- **Objetivo 7:** el servicio se configura, ejecuta y prueba íntegramente en contenedores y consume al banco solo por su contrato HTTP.

---

## Actores de negocio y flujo de valor

- **Cliente autenticado:** dueño de la cuenta origen. Crea la transferencia externa, y consulta su estado e historial. Valor: enviar dinero a otro banco con certeza de que no se duplica ni se pierde.
- **Banco externo (riel):** sistema no confiable que recibe la transferencia, la acepta o la rechaza, y responde por la referencia qué ocurrió con ella. Pagos es su cliente.
- **Operador del entorno:** configura la dirección del banco, verifica el servicio y traza el envío y la conciliación en los registros. Valor: operar con visibilidad.

---

## Delimitación del Alcance (Scope Boundaries)

- **Dentro del Alcance (In Scope - Fase Actual):**
  - Creación de transferencias `EXTERNAL` con retención de fondos, idempotencia y respuesta 202 (o 201 FAILED por fondos insuficientes).
  - Envío al banco con reintentos ante indisponibilidad y reembolso al agotarlos o ante rechazo.
  - Resolución de resultados inciertos (UNKNOWN) consultando al banco por la referencia, con reenvío de la misma referencia si el banco no la conoce.
  - Consulta de una transferencia y del historial paginado incluyendo transferencias externas, con los estados PENDING y UNKNOWN y los motivos de falla `RAIL_REJECTED` y `RAIL_UNAVAILABLE`.
  - Recuperación tras la caída del proceso y coordinación entre varios procesos de envío.
  - Configuración de la dirección del banco (`RAIL_BASE_URL`), registros de eventos `rail.*` y `reconcile.*` y contrato OpenAPI actualizado.
  - Ejecución, pruebas y construcción en contenedores Docker.
- **Fuera del Alcance (Out of Scope / Non-Goals):**
  - Reversos de transferencias, el estado REVERSED y el objeto reverso.
  - Eventos de dominio, auditoría y su publicación.
  - Interfaz gráfica.
  - Validación local de la existencia de la cuenta externa (la valida el banco).
  - Cuentas destino externas guardadas, alta o edición de cuentas, otras monedas distintas de COP.
  - Cambios al comportamiento de las transferencias internas.

---

## Reglas de Negocio y Políticas del Dominio

- **RN-01 Credencial:** todo endpoint de negocio exige `Authorization: Bearer <JWT>` válido, con las mismas reglas que las transferencias internas. El `sub` del token es el usuario que opera.
- **RN-02 Montos:** igual que las transferencias internas: COP, string decimal `^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$`, mayor que 0 y como máximo 9999999999999999.99; en las respuestas, string con exactamente 2 decimales.
- **RN-03 Solicitud externa:** `POST /transfers` con `{type:"EXTERNAL", fromAccountId, toExternalAccount, amount}` y header `Idempotency-Key`. `toExternalAccount` cumple `^[A-Z0-9-]{6,34}$`. No se acepta `toAccountId` en una transferencia externa. La cuenta origen debe existir y pertenecer al usuario. La existencia de la cuenta externa no se valida en Pagos: la valida el banco, y un rechazo del banco es un rechazo definitivo (`RAIL_REJECTED`).
- **RN-04 Retención:** con saldo suficiente, el débito del origen y el registro de la transferencia PENDING ocurren juntos o no ocurren. Un saldo exactamente igual al monto es suficiente y deja el origen en 0.00. Los fondos permanecen retenidos mientras la transferencia está PENDING o UNKNOWN.
- **RN-05 Fondos insuficientes:** con saldo menor que el monto, la transferencia se registra FAILED con `failureReason` `INSUFFICIENT_FUNDS`, sin mover saldos, sin ser enviada al banco, y la respuesta es 201.
- **RN-06 Estados de la transferencia externa:** nace PENDING (con el origen debitado) o FAILED (`INSUFFICIENT_FUNDS`). Transiciones válidas: PENDING → COMPLETED | FAILED | UNKNOWN; UNKNOWN → COMPLETED | FAILED. COMPLETED y FAILED son terminales. FAILED siempre lleva `failureReason` (`INSUFFICIENT_FUNDS`, `RAIL_REJECTED` o `RAIL_UNAVAILABLE`); ningún otro estado lo lleva. Una transferencia interna nunca es PENDING ni UNKNOWN.
- **RN-07 Idempotencia:** la misma de las transferencias internas (operación `CREATE_TRANSFER`, ámbito usuario + operación + clave, clave de 1 a 255 caracteres ASCII 0x21 a 0x7E, comparación del payload por su huella). Misma clave y mismo payload devuelven la respuesta almacenada (mismo status y body) con `Idempotent-Replayed: true`, sin un segundo efecto, incluso en solicitudes concurrentes; misma clave con otro payload es un conflicto. Se almacenan las respuestas de solicitudes que produjeron efecto (202 y 201); los rechazos 4xx sin efecto no se almacenan.
- **RN-08 Interpretación de las respuestas del banco al envío:** el envío es `POST /rail/transfers` con `{reference, from, to, amount}`, donde `reference` es el id de la transferencia, `from` la cuenta origen, `to` la cuenta externa y `amount` el monto. El envío incluye el header `X-Request-Id` con el identificador de correlación de la solicitud que creó la transferencia y vence a los 10 s.

  | Resultado del envío | Efecto en la transferencia |
  |:---|:---|
  | 200 (aceptada) | COMPLETED |
  | 422 (rechazada) | FAILED `RAIL_REJECTED` con reembolso |
  | 503, o fallo de conexión o de resolución del banco (por ejemplo ECONNREFUSED, ENOTFOUND) | Reintento con espera; al agotar los intentos, FAILED `RAIL_UNAVAILABLE` con reembolso |
  | Timeout de 10 s, o error de comunicación después de haber enviado la solicitud | UNKNOWN con fondos retenidos |
  | Cualquier otra respuesta (por ejemplo 400, 409 `REFERENCE_CONFLICT`, 5xx distinto de 503, cuerpo no interpretable) | UNKNOWN con fondos retenidos |

- **RN-09 Reintentos por indisponibilidad:** máximo 5 intentos de envío. Entre un intento fallido y el siguiente se espera `min(2^intentos, 30)` segundos, donde `intentos` es el número de intentos ya realizados (2, 4, 8 y 16 s entre los cinco intentos). Con el quinto intento fallido por indisponibilidad la transferencia pasa a FAILED `RAIL_UNAVAILABLE` con reembolso. Entre intentos la transferencia permanece PENDING con los fondos retenidos.
- **RN-10 Conciliación de UNKNOWN:** el sistema consulta al banco `GET /rail/transfers/{reference}` con la misma referencia, con espera `min(2^intentos, 30)` segundos entre consultas y sin límite de intentos. El header `X-Request-Id` lleva el identificador de correlación de la transferencia y la consulta vence a los 10 s. 200 con `ACCEPTED` → COMPLETED. 422 (rechazada) → FAILED `RAIL_REJECTED` con reembolso. 404 (el banco no la conoce) → se reenvía la transferencia con la MISMA referencia y su resultado se trata según RN-08 y RN-09. 503, timeout, fallo de conexión o cualquier otra respuesta → permanece UNKNOWN y se reintenta la consulta.
- **RN-11 Reembolso y dinero conservado:** el reembolso devuelve el monto completo a la cuenta origen, en la misma transacción que marca la transferencia FAILED, y ocurre como máximo una vez por transferencia. Una transferencia PENDING o UNKNOWN nunca devuelve fondos. En ausencia de reversos: suma de saldos + fondos retenidos + transferencias externas COMPLETED = 1500000.00 COP.
- **RN-12 Procesamiento seguro:** el envío y la conciliación los realizan procesos del propio servicio que revisan el trabajo pendiente cada 500 ms, toman hasta 10 transferencias por revisión y reservan cada una por 30 s. Una transferencia reservada no la toma otro proceso; si la reserva vence (por ejemplo por la caída del proceso) cualquier proceso puede retomarla. La llamada al banco no retiene bloqueos sobre las cuentas.
- **RN-13 Visibilidad:** una transferencia externa es visible solo para el dueño de la cuenta origen; para cualquier otro usuario no existe. La visibilidad de las transferencias internas no cambia (origen y destino).
- **RN-14 Errores:** todo error responde `{error:{code,message}}` con mensaje en español, sin datos sensibles. Las solicitudes y respuestas rechazan campos no definidos en el contrato.

---

## Requerimientos Funcionales y Criterios EARS

### REQ-01: Creación de transferencias externas
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** transferir un monto desde una cuenta mía a una cuenta de otro banco
  - **Para:** enviar dinero fuera del sistema con certeza de que mis fondos están protegidos

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-1.1 (Flujo Principal):**
  - `CUANDO` el cliente envía `POST /transfers` con `{type:"EXTERNAL", fromAccountId, toExternalAccount, amount}` válido, una cuenta origen propia con saldo suficiente y un `Idempotency-Key` válido
  - `EL SISTEMA DEBE` debitar el origen, registrar la transferencia PENDING con `toAccountId` nulo, todo en una sola transacción atómica, y responder 202 con la transferencia (sin esperar al banco).
- **REQ-1.2 (Condicional):**
  - `CUANDO` el saldo del origen es exactamente igual al monto
  - `EL SISTEMA DEBE` debitar el monto completo, dejar el origen en 0.00 y registrar la transferencia PENDING.
- **REQ-1.3 (Excepción, fondos insuficientes):**
  - `SI` el saldo del origen es menor que el monto `CUANDO` se crea la transferencia externa
  - `EL SISTEMA DEBE` registrar la transferencia FAILED con `failureReason` `INSUFFICIENT_FUNDS`, no modificar ningún saldo, no enviarla al banco y responder 201.
- **REQ-1.4 (Excepción, destino):**
  - `SI` `toExternalAccount` falta, no es texto o no cumple `^[A-Z0-9-]{6,34}$` (por ejemplo minúsculas, 5 o 35 caracteres, espacios) `CUANDO` se crea la transferencia externa
  - `EL SISTEMA DEBE` responder 400 con código `VALIDATION_ERROR` sin registrar nada ni mover saldos.
- **REQ-1.5 (Excepción, forma y monto):**
  - `SI` el body no es un objeto, le faltan campos, trae campos adicionales (incluido `toAccountId` en una transferencia externa o `toExternalAccount` en una interna) o `type` no es `INTERNAL` ni `EXTERNAL` `CUANDO` se crea una transferencia
  - `EL SISTEMA DEBE` responder 400 con código `VALIDATION_ERROR` sin registrar nada.
  - `SI` el monto está ausente, es un número JSON o no cumple RN-02 `CUANDO` se crea la transferencia externa
  - `EL SISTEMA DEBE` responder 400 con código `INVALID_AMOUNT` sin registrar nada.
- **REQ-1.6 (Excepción, cuenta origen):**
  - `SI` la cuenta origen no existe o no pertenece al usuario `CUANDO` se crea la transferencia externa
  - `EL SISTEMA DEBE` responder 404 con código `ACCOUNT_NOT_FOUND`, idéntico en ambos casos, sin registrar nada ni mover saldos.
- **REQ-1.7 (Ubicuo, destino y referencia):**
  - `EL SISTEMA DEBE` aceptar cualquier `toExternalAccount` con formato válido sin comprobar su existencia (la valida el banco) y usar el id de la transferencia, en texto, como referencia con la que el banco la identifica, sin cambiarla nunca.
- **REQ-1.8 (Ubicuo, saldo):**
  - `EL SISTEMA DEBE` mantener en todo momento el saldo de toda cuenta mayor o igual a 0, incluso con varias transferencias simultáneas sobre la misma cuenta origen.

### REQ-02: Idempotencia de la creación externa
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** repetir una solicitud de transferencia externa sin que el dinero se retenga o envíe dos veces
  - **Para:** reintentar con seguridad ante un doble clic o una red inestable

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-2.1 (Repetición):**
  - `CUANDO` el mismo usuario repite `POST /transfers` externo con la misma clave y el mismo payload
  - `EL SISTEMA DEBE` responder con el mismo status y body de la respuesta original (incluido 202) con el header `Idempotent-Replayed: true`, sin un segundo débito ni una segunda transferencia, aunque la transferencia original ya haya cambiado de estado.
- **REQ-2.2 (Concurrencia):**
  - `CUANDO` llegan simultáneamente dos o más solicitudes con la misma clave y el mismo payload
  - `EL SISTEMA DEBE` ejecutar un único débito y una única transferencia, y devolver respuestas iguales, marcando como repetidas las que no ejecutaron el efecto.
- **REQ-2.3 (Conflicto de payload):**
  - `SI` se reutiliza una clave con un payload distinto (por ejemplo otro monto o otro `toExternalAccount`) `CUANDO` se crea una transferencia
  - `EL SISTEMA DEBE` responder 422 con código `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` sin ejecutar la operación.
- **REQ-2.4 (Excepción, clave):**
  - `SI` el header `Idempotency-Key` falta o no cumple RN-07 `CUANDO` se crea una transferencia externa
  - `EL SISTEMA DEBE` responder 400 con código `IDEMPOTENCY_KEY_REQUIRED` sin ejecutar la operación.
- **REQ-2.5 (Almacenamiento):**
  - `EL SISTEMA DEBE` guardar la respuesta de idempotencia en la misma transacción que el débito y el registro de la transferencia, almacenar las respuestas 202 y las 201 FAILED por `INSUFFICIENT_FUNDS`, y no almacenar los rechazos 4xx sin efecto, de modo que una solicitud rechazada pueda reintentarse con la misma clave una vez corregida.
- **REQ-2.6 (Operación en curso):**
  - `SI` otra solicitud con la misma clave sigue en curso y la espera supera 5 segundos `CUANDO` se crea una transferencia
  - `EL SISTEMA DEBE` responder 409 con código `IDEMPOTENCY_KEY_IN_PROGRESS` sin ejecutar la operación.

### REQ-03: Envío al banco
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** que mi transferencia pendiente sea enviada al banco automáticamente
  - **Para:** que llegue a su destino sin que yo tenga que repetir nada

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-3.1 (Ubicuo, envío automático):**
  - `EL SISTEMA DEBE` enviar al banco toda transferencia externa PENDING cuyo momento de envío haya llegado, mediante `POST /rail/transfers` con `{reference, from, to, amount}`, el header `X-Request-Id` igual al identificador de correlación de la transferencia y un vencimiento de 10 s, revisando el trabajo pendiente cada 500 ms (RN-12).
- **REQ-3.2 (Aceptación):**
  - `CUANDO` el banco responde 200 al envío
  - `EL SISTEMA DEBE` marcar la transferencia COMPLETED, registrar su fecha de finalización y no modificar saldos (los fondos retenidos pasan a ser el pago realizado).
- **REQ-3.3 (Rechazo):**
  - `CUANDO` el banco responde 422 al envío
  - `EL SISTEMA DEBE` marcar la transferencia FAILED con `failureReason` `RAIL_REJECTED` y acreditar el monto completo a la cuenta origen, en la misma transacción.
- **REQ-3.4 (Indisponibilidad):**
  - `CUANDO` el banco responde 503, o el envío falla por conexión rechazada o por imposibilidad de resolver al banco (ECONNREFUSED, ENOTFOUND)
  - `EL SISTEMA DEBE` mantener la transferencia PENDING con los fondos retenidos y reintentar el envío tras `min(2^intentos, 30)` segundos.
- **REQ-3.5 (Intentos agotados):**
  - `CUANDO` el quinto intento de envío termina por indisponibilidad
  - `EL SISTEMA DEBE` marcar la transferencia FAILED con `failureReason` `RAIL_UNAVAILABLE` y acreditar el monto completo a la cuenta origen, en la misma transacción.
- **REQ-3.6 (Resultado incierto):**
  - `CUANDO` el envío vence a los 10 s o falla por un error de comunicación después de haber enviado la solicitud
  - `EL SISTEMA DEBE` marcar la transferencia UNKNOWN, conservar los fondos retenidos y programar su conciliación.
- **REQ-3.7 (Respuesta inesperada):**
  - `CUANDO` el banco responde algo distinto de 200, 422 y 503 al envío (por ejemplo 400, 409 `REFERENCE_CONFLICT` o un cuerpo no interpretable)
  - `EL SISTEMA DEBE` marcar la transferencia UNKNOWN, conservar los fondos retenidos y programar su conciliación, sin devolver fondos ni marcarla COMPLETED.
- **REQ-3.8 (Sin bloqueo por la espera):**
  - `MIENTRAS` el banco tarda en responder a un envío
  - `EL SISTEMA DEBE` seguir atendiendo creaciones y consultas sin retener bloqueos sobre las cuentas durante la llamada al banco.

### REQ-04: Coordinación y recuperación
- **Historia de Usuario:**
  - **Como:** Operador del entorno
  - **Quiero:** que el envío sea seguro con varios procesos y ante caídas
  - **Para:** que ninguna transferencia se envíe dos veces ni quede abandonada

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-4.1 (Concurrencia):**
  - `CUANDO` varios procesos de envío revisan el trabajo pendiente al mismo tiempo
  - `EL SISTEMA DEBE` asignar cada transferencia a un solo proceso por vez (hasta 10 por revisión, reservadas por 30 s), de modo que una transferencia no se envíe ni se concilie en paralelo por dos procesos, y no se duplique ningún débito ni reembolso.
- **REQ-4.2 (Recuperación):**
  - `SI` el proceso que tenía reservada una transferencia cae antes de registrar el resultado `CUANDO` vence la reserva de 30 s
  - `EL SISTEMA DEBE` permitir que otro proceso la retome, reenviándola con la misma referencia, sin un segundo débito.
- **REQ-4.3 (Reembolso único):**
  - `EL SISTEMA DEBE` acreditar el reembolso de una transferencia como máximo una vez, en la misma transacción que la marca FAILED, y no reembolsar jamás una transferencia COMPLETED, PENDING o UNKNOWN.
- **REQ-4.4 (Transiciones):**
  - `EL SISTEMA DEBE` aplicar únicamente las transiciones de RN-06; ninguna respuesta tardía o repetida del banco cambia una transferencia que ya está en un estado terminal.

### REQ-05: Conciliación de resultados inciertos
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** que el sistema averigüe qué pasó con mi transferencia cuando el banco no respondió a tiempo
  - **Para:** no perder mi dinero ni pagar dos veces

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-5.1 (Consulta al banco):**
  - `MIENTRAS` una transferencia está UNKNOWN y llegó su momento de conciliación
  - `EL SISTEMA DEBE` consultar `GET /rail/transfers/{reference}` con la misma referencia, el header `X-Request-Id` igual al identificador de correlación de la transferencia y un vencimiento de 10 s.
- **REQ-5.2 (Aceptada):**
  - `CUANDO` el banco responde 200 `ACCEPTED` a la consulta
  - `EL SISTEMA DEBE` marcar la transferencia COMPLETED sin mover saldos ni reenviarla.
- **REQ-5.3 (Rechazada):**
  - `CUANDO` el banco responde 422 a la consulta
  - `EL SISTEMA DEBE` marcar la transferencia FAILED con `failureReason` `RAIL_REJECTED` y acreditar el monto completo a la cuenta origen, en la misma transacción.
- **REQ-5.4 (No encontrada):**
  - `CUANDO` el banco responde 404 a la consulta
  - `EL SISTEMA DEBE` reenviar la transferencia con `POST /rail/transfers` usando la MISMA referencia y tratar el resultado según RN-08 y RN-09 (200 COMPLETED; 422 FAILED `RAIL_REJECTED` con reembolso; 503 o fallo de conexión con reintento y, agotados los intentos, FAILED `RAIL_UNAVAILABLE` con reembolso; timeout o respuesta inesperada permanece UNKNOWN), sin un segundo débito.
- **REQ-5.5 (Sigue incierta):**
  - `CUANDO` la consulta termina en 503, en timeout, en fallo de conexión o en cualquier otra respuesta
  - `EL SISTEMA DEBE` mantener la transferencia UNKNOWN con los fondos retenidos y reintentar la consulta tras `min(2^intentos, 30)` segundos.
- **REQ-5.6 (Sin límite):**
  - `EL SISTEMA DEBE` reintentar la conciliación de una transferencia UNKNOWN sin límite de intentos hasta conocer el resultado del banco.

### REQ-06: Consulta de transferencias externas
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** ver el estado y el historial de mis transferencias externas
  - **Para:** saber si mi dinero llegó, está en camino o fue devuelto

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-6.1 (Detalle):**
  - `CUANDO` el dueño de la cuenta origen solicita `GET /transfers/{id}` de una transferencia externa
  - `EL SISTEMA DEBE` responder 200 con la transferencia: id, tipo `EXTERNAL`, `fromAccountId`, `toAccountId` nulo, `toExternalAccount`, monto como string de 2 decimales, moneda, estado (PENDING, COMPLETED, FAILED o UNKNOWN), `failureReason` solo si es FAILED (`INSUFFICIENT_FUNDS`, `RAIL_REJECTED` o `RAIL_UNAVAILABLE`), y fechas de creación y de finalización (nula mientras está PENDING o UNKNOWN y en FAILED por `INSUFFICIENT_FUNDS`).
- **REQ-6.2 (Visibilidad):**
  - `SI` la transferencia externa no existe, el id no es válido o el usuario no es dueño de la cuenta origen `CUANDO` se consulta
  - `EL SISTEMA DEBE` responder 404 con código `TRANSFER_NOT_FOUND`, idéntico en todos los casos.
- **REQ-6.3 (Historial):**
  - `CUANDO` el cliente solicita `GET /transfers`
  - `EL SISTEMA DEBE` incluir sus transferencias externas junto con las internas, ordenadas por fecha de creación descendente e id descendente, con paginación por cursor sin repetir ni omitir, y nunca incluir transferencias externas de terceros.
- **REQ-6.4 (Estado vigente):**
  - `CUANDO` el estado de una transferencia externa cambia
  - `EL SISTEMA DEBE` reflejarlo en la siguiente consulta sin exigir `Idempotency-Key`.
- **REQ-6.5 (Sin regresión):**
  - `EL SISTEMA DEBE` seguir atendiendo las transferencias internas, cuentas, saldos, idempotencia, consulta e historial con el mismo contrato, códigos y resultados que antes de este spec.

### REQ-07: Integridad del dinero
- **Historia de Usuario:**
  - **Como:** Cliente autenticado
  - **Quiero:** la garantía de que el dinero no se pierde ni se duplica
  - **Para:** confiar en el portal

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-7.1 (Invariante):**
  - `EL SISTEMA DEBE` mantener, en ausencia de reversos, la suma de saldos de las cuentas más los fondos retenidos (transferencias externas PENDING o UNKNOWN) más las transferencias externas COMPLETED igual a 1500000.00 COP, en todo momento y ante cualquier combinación de resultados del banco.
- **REQ-7.2 (Un débito por intención):**
  - `EL SISTEMA DEBE` realizar un único débito por transferencia externa creada, sin importar cuántos reenvíos, consultas, reintentos del cliente o procesos concurrentes intervengan.
- **REQ-7.3 (Reenvío con misma referencia):**
  - `EL SISTEMA DEBE` usar la misma referencia en todo envío, reenvío y consulta de una transferencia, de modo que el banco no pague dos veces.

### REQ-08: Configuración, operabilidad y contrato
- **Historia de Usuario:**
  - **Como:** Operador del entorno
  - **Quiero:** configurar el banco, trazar el envío y operar solo con Docker
  - **Para:** operar y diagnosticar sin exponer información sensible

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-8.1 (Configuración):**
  - `EL SISTEMA DEBE` tomar la dirección base del banco de la variable de entorno `RAIL_BASE_URL` y consumirlo únicamente por su contrato HTTP (`POST /rail/transfers`, `GET /rail/transfers/{reference}`).
  - `SI` `RAIL_BASE_URL` falta o no es una URL absoluta válida `CUANDO` el servicio arranca
  - `EL SISTEMA DEBE` terminar con un mensaje claro que nombre la variable.
- **REQ-8.2 (Registros):**
  - `EL SISTEMA DEBE` emitir logs JSON de los eventos de envío (`rail.*`) y de conciliación (`reconcile.*`): intento de envío, resultado del banco, reintento programado, paso a UNKNOWN, resolución y reembolso, con el id de la transferencia y su identificador de correlación, y nunca registrar `Authorization`, `Cookie` ni `Set-Cookie`.
- **REQ-8.3 (Contrato público):**
  - `EL SISTEMA DEBE` actualizar `services/payments/openapi.yaml` (OpenAPI 3.1) para describir `type: EXTERNAL`, `toExternalAccount`, la respuesta 202, los estados PENDING y UNKNOWN y los motivos `RAIL_REJECTED` y `RAIL_UNAVAILABLE`.
- **REQ-8.4 (Entorno contenedorizado):**
  - `EL SISTEMA DEBE` poder instalarse, probarse, construirse y ejecutarse íntegramente con Docker, sin instalar nada en el host, y su verificación de salud `/health/ready` sigue respondiendo según la base de datos.

---

## Edge Cases & Boundary Conditions
| ID | Escenario / Condición Límite | Comportamiento Esperado del Sistema |
|:---|:---|:---|
| **EC-01** | El banco responde 503 en los cinco intentos de envío | Entre intentos permanece PENDING con fondos retenidos; tras el quinto queda FAILED `RAIL_UNAVAILABLE` y el origen recupera el monto. |
| **EC-02** | Timeout de 10 s y el banco sí procesó la operación | UNKNOWN con fondos retenidos; la consulta devuelve 200 `ACCEPTED` y pasa a COMPLETED sin segundo débito. |
| **EC-03** | Timeout de 10 s y el banco no procesó la operación | UNKNOWN; la consulta devuelve 404; se reenvía con la MISMA referencia y se resuelve según RN-08. |
| **EC-04** | Conexión rechazada o banco no resoluble (ECONNREFUSED, ENOTFOUND) | Se trata como 503: reintento con espera y, agotados los intentos, FAILED `RAIL_UNAVAILABLE` con reembolso. |
| **EC-05** | Saldo exactamente igual al monto | 202, origen en 0.00 y transferencia PENDING. |
| **EC-06** | Origen con saldo 0.00 (ACC-003) | 201 con FAILED `INSUFFICIENT_FUNDS`; saldos intactos; no se envía al banco. |
| **EC-07** | Dos POST simultáneos con la misma clave y payload | Un solo débito y una sola transferencia; respuestas iguales, la repetida con `Idempotent-Replayed: true`. |
| **EC-08** | Misma clave con payload distinto | 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`. |
| **EC-09** | El banco responde 409 `REFERENCE_CONFLICT` al envío | Respuesta inesperada: UNKNOWN con fondos retenidos; se concilia. |
| **EC-10** | Varios procesos de envío activos a la vez | Cada transferencia se envía por un solo proceso por vez; no hay doble débito ni doble reembolso. |
| **EC-11** | Cae el proceso con una transferencia reservada | Al vencer la reserva de 30 s otro proceso la retoma y la reenvía con la misma referencia; un solo débito. |
| **EC-12** | El banco rechaza con 422 (por ejemplo cuenta externa inexistente) | FAILED `RAIL_REJECTED` con reembolso al origen. |
| **EC-13** | Destino con formato inválido (`abc`, minúsculas, 35 caracteres) | 400 `VALIDATION_ERROR`; sin efectos. |
| **EC-14** | Origen ajeno o inexistente | 404 `ACCOUNT_NOT_FOUND`; sin efectos. |
| **EC-15** | Transferencia externa consultada por un usuario que no es dueño del origen | 404 `TRANSFER_NOT_FOUND`. |
| **EC-16** | El banco permanece indisponible durante la conciliación de un UNKNOWN | Permanece UNKNOWN con fondos retenidos; reintenta cada `min(2^intentos, 30)` s sin límite. |
| **EC-17** | El banco tarda mucho en responder | Las creaciones y consultas siguen respondiendo; no hay bloqueo sobre las cuentas. |
| **EC-18** | Repetición de la solicitud cuando la transferencia ya cambió de estado | Se devuelve la respuesta almacenada original (202 PENDING) con `Idempotent-Replayed: true`; el estado vigente se consulta con `GET /transfers/{id}`. |
| **EC-19** | Transferencia interna después de este spec | Se comporta y responde exactamente igual que antes. |
| **EC-20** | Rechazo 4xx y reintento con la misma clave ya corregida | La respuesta rechazada no se almacenó; el reintento se ejecuta normalmente. |

---

## Restricciones Operativas y de Cumplimiento (Nivel Negocio)
- **Tiempo de Respuesta Operativo (SLA de Usuario):** crear una transferencia externa y consultar su estado debe ser perceptible como inmediato (menos de 1 segundo en condiciones normales), porque la creación no espera al banco. La resolución final depende del banco y de las esperas de RN-09 y RN-10.
- **Privacidad y Cumplimiento Normativo:** ningún token ni cabecera de autorización aparece en registros ni en errores; los registros de envío y conciliación no incluyen datos personales.
- **Continuidad de Negocio:** un reinicio o caída del servicio no altera saldos ni transferencias confirmadas, ni pierde transferencias PENDING o UNKNOWN: se retoman y se resuelven.
- **Ambiente:** todo se instala, ejecuta y prueba en contenedores Docker; no se instala nada en el host.

---

## Trazabilidad de criterios de aceptación
Cada prueba automatizada incluye su ID `[AC-TEX-NN]` en el nombre. Las pruebas de aceptación y de concurrencia usan la PostgreSQL real del Compose de desarrollo de `services/payments` y un banco de prueba que responde de forma controlada por HTTP (aceptación, rechazo, indisponibilidad, respuesta tardía, conexión rechazada, respuestas inesperadas) con tiempos simulados.

| AC | Criterio | Verificación |
|:---|:---|:---|
| AC-TEX-01 | REQ-1.1: externa con saldo suficiente debita el origen, queda PENDING y responde 202 | aceptación |
| AC-TEX-02 | REQ-1.2: saldo igual al monto deja el origen en 0.00 y PENDING | aceptación |
| AC-TEX-03 | REQ-1.3: saldo insuficiente responde 201 FAILED `INSUFFICIENT_FUNDS` sin mover saldos ni enviar | aceptación |
| AC-TEX-04 | REQ-1.4: `toExternalAccount` ausente o con formato inválido responde 400 `VALIDATION_ERROR` | unit, aceptación |
| AC-TEX-05 | REQ-1.5: forma inválida, campos adicionales o `type` desconocido responden 400 `VALIDATION_ERROR`; monto inválido responde 400 `INVALID_AMOUNT` | unit, aceptación |
| AC-TEX-06 | REQ-1.6: origen inexistente o ajeno responde 404 `ACCOUNT_NOT_FOUND` | aceptación |
| AC-TEX-07 | REQ-1.7: destino con formato válido se acepta sin comprobar existencia y la referencia es el id de la transferencia | aceptación |
| AC-TEX-08 | REQ-1.8: el saldo nunca es negativo con transferencias simultáneas sobre el mismo origen | unit, concurrencia |
| AC-TEX-09 | REQ-2.1: repetición con misma clave y payload devuelve 202 original con `Idempotent-Replayed: true` y sin segundo débito | aceptación |
| AC-TEX-10 | REQ-2.2: solicitudes simultáneas con misma clave y payload producen un único débito y una sola transferencia | concurrencia |
| AC-TEX-11 | REQ-2.3: misma clave con payload distinto responde 422 `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` | aceptación |
| AC-TEX-12 | REQ-2.4: clave ausente o inválida responde 400 `IDEMPOTENCY_KEY_REQUIRED` | aceptación |
| AC-TEX-13 | REQ-2.5: se almacenan 202 y 201 con efecto, no los 4xx sin efecto | aceptación |
| AC-TEX-14 | REQ-2.6: espera de más de 5 s por una solicitud en curso responde 409 `IDEMPOTENCY_KEY_IN_PROGRESS` | concurrencia |
| AC-TEX-15 | REQ-3.1: el envío usa `POST /rail/transfers` con referencia, cuentas, monto, `X-Request-Id` y vencimiento de 10 s | aceptación |
| AC-TEX-16 | REQ-3.2: 200 del banco pasa a COMPLETED sin mover saldos | aceptación |
| AC-TEX-17 | REQ-3.3: 422 del banco pasa a FAILED `RAIL_REJECTED` con reembolso en la misma transacción | aceptación |
| AC-TEX-18 | REQ-3.4: 503 o ECONNREFUSED/ENOTFOUND mantienen PENDING y reintentan con `min(2^intentos, 30)` s | unit, aceptación |
| AC-TEX-19 | REQ-3.5: el quinto intento indisponible pasa a FAILED `RAIL_UNAVAILABLE` con reembolso | aceptación |
| AC-TEX-20 | REQ-3.6: timeout de 10 s o error tras enviar pasa a UNKNOWN con fondos retenidos | aceptación |
| AC-TEX-21 | REQ-3.7: respuesta inesperada (400, 409, otras) pasa a UNKNOWN con fondos retenidos | aceptación |
| AC-TEX-22 | REQ-3.8: la espera del banco no bloquea creaciones, consultas ni cuentas | concurrencia |
| AC-TEX-23 | REQ-4.1: procesos concurrentes no envían ni concilian una transferencia en paralelo ni duplican débito o reembolso | concurrencia |
| AC-TEX-24 | REQ-4.2: reserva vencida permite retomar la transferencia con la misma referencia sin segundo débito | aceptación, concurrencia |
| AC-TEX-25 | REQ-4.3: reembolso como máximo una vez y nunca en COMPLETED, PENDING o UNKNOWN | unit, concurrencia |
| AC-TEX-26 | REQ-4.4: solo transiciones válidas; un estado terminal no cambia | unit |
| AC-TEX-27 | REQ-5.1: la conciliación consulta `GET /rail/transfers/{reference}` con `X-Request-Id` y vencimiento de 10 s | aceptación |
| AC-TEX-28 | REQ-5.2: consulta 200 `ACCEPTED` pasa a COMPLETED sin reenviar | aceptación |
| AC-TEX-29 | REQ-5.3: consulta 422 pasa a FAILED `RAIL_REJECTED` con reembolso | aceptación |
| AC-TEX-30 | REQ-5.4: consulta 404 reenvía con la misma referencia y aplica las reglas de envío sin segundo débito | aceptación |
| AC-TEX-31 | REQ-5.5: consulta con 503, timeout, fallo de conexión u otra respuesta mantiene UNKNOWN y reintenta | aceptación |
| AC-TEX-32 | REQ-5.6: la conciliación no tiene límite de intentos y su espera es `min(2^intentos, 30)` s | unit, aceptación |
| AC-TEX-33 | REQ-6.1: detalle de externa con campos, estados y `failureReason` correctos | aceptación |
| AC-TEX-34 | REQ-6.2: externa inexistente, id inválido o de otro usuario responde 404 `TRANSFER_NOT_FOUND` | aceptación |
| AC-TEX-35 | REQ-6.3: el historial incluye las externas del usuario, con orden y cursor correctos, sin las de terceros | aceptación |
| AC-TEX-36 | REQ-6.4: el estado vigente se refleja en la consulta siguiente sin exigir clave | aceptación |
| AC-TEX-37 | REQ-6.5: las transferencias internas, cuentas e idempotencia responden igual que antes | aceptación |
| AC-TEX-38 | REQ-7.1: suma de saldos + retenidos + externas COMPLETED = 1500000.00 ante cualquier combinación de resultados del banco | aceptación, concurrencia |
| AC-TEX-39 | REQ-7.2: un único débito por transferencia externa con reintentos, reenvíos y concurrencia | concurrencia |
| AC-TEX-40 | REQ-7.3: toda llamada al banco usa la misma referencia | aceptación |
| AC-TEX-41 | REQ-8.1: `RAIL_BASE_URL` configura el banco, se consume solo por HTTP y un valor ausente o inválido impide el arranque con mensaje claro | unit, aceptación |
| AC-TEX-42 | REQ-8.2: logs JSON `rail.*` y `reconcile.*` con id de transferencia y correlación, sin cabeceras sensibles | aceptación |
| AC-TEX-43 | REQ-8.3: `services/payments/openapi.yaml` describe EXTERNAL, 202, PENDING, UNKNOWN, `RAIL_REJECTED` y `RAIL_UNAVAILABLE` | aceptación |
| AC-TEX-44 | REQ-8.4: instalación, pruebas, construcción y ejecución solo con Docker; `/health/ready` conserva su comportamiento | aceptación |

---

> **Reglas de redacción:** este documento habla el lenguaje del negocio y del stakeholder; los códigos de error y HTTP citados son parte del contrato observable. Los nombres de sintaxis (`REQ`, `RN`, `EC`) se mantienen en inglés por estándar; todo el contenido se redacta en español.
