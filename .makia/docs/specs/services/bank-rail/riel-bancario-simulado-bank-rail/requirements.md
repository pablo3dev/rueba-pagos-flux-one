# Riel bancario simulado

> Este documento es el **artefacto de aprobación del USUARIO**. Es autosuficiente: todo lo necesario para aprobar el alcance, las reglas, los objetivos y los criterios de éxito del spec está aquí.

- **Spec:** `riel-bancario-simulado-bank-rail`
- **Feature:** `riel-bancario-simulado` — **Unidad de código:** `services/bank-rail`

## Resumen
Servicio que simula un banco externo poco fiable para un portal de pagos: recibe transferencias y reversos de un servicio cliente y responde de forma aleatoria y configurable (aceptación, rechazo, indisponibilidad o respuesta tardía). Es idempotente por referencia, permite consultar el estado de cualquier operación y conserva un libro de operaciones que sobrevive a los reinicios. No requiere autenticación ni base de datos. Incluye su contrato HTTP documentado, su empaquetado en contenedor y un entorno de desarrollo 100 % Docker (compilar, probar y ejecutar el servicio sin instalar nada en la máquina del desarrollador salvo Docker y Git).

## Problema
Un servicio que envía dinero a un banco externo necesita probar, sin una integración real, todos los comportamientos de un banco que no es confiable: aceptar, rechazar, no estar disponible, o tardar tanto que el cliente no sabe si la operación se procesó. También necesita poder repetir una solicitud sin riesgo de duplicarla, consultar después qué ocurrió con ella y pedir el reverso de una operación aceptada. Sin un banco simulado con estos comportamientos, esos escenarios no se pueden reproducir ni verificar de forma controlada.

## Solución
- **En qué consiste:** Un servicio HTTP, sin autenticación, que expone el registro de transferencias (`POST /rail/transfers`), su consulta (`GET /rail/transfers/{reference}`, válida también para reversos), el registro de reversos (`POST /rail/reversals`) y la salud del servicio (`GET /health`), en el puerto 3004. Cada operación nueva se resuelve sorteando uno de cuatro resultados con probabilidades configurables; las operaciones aceptadas o rechazadas quedan registradas en un libro de solo anexar (archivo JSONL) que se conserva entre reinicios. La aleatoriedad y la espera son sustituibles para que las pruebas sean deterministas.
- **Cómo resuelve el problema:** Los cuatro resultados reproducen un banco no confiable, incluido el caso en que la respuesta llega tarde y el banco sí o no procesó la operación; la referencia hace idempotentes los reintentos; la consulta permite al cliente saber qué ocurrió realmente; las reglas de reverso reproducen rechazos deterministas del banco; y el libro persistente mantiene la coherencia tras un reinicio.

## Objetivos y criterios de éxito
- **Objetivo 1:** Un servicio cliente obtiene de forma reproducible cada uno de los cuatro resultados (aceptada, rechazada, no disponible, respuesta tardía procesada o no procesada) ajustando las probabilidades por configuración.
- **Objetivo 2:** Repetir una solicitud con la misma referencia y los mismos datos nunca produce un segundo efecto ni un nuevo sorteo, ni siquiera de forma simultánea.
- **Objetivo 3:** Tras una respuesta tardía o una falla de comunicación, el cliente puede consultar por la referencia y obtener la verdad del banco: aceptada, rechazada o inexistente.
- **Objetivo 4:** Las operaciones registradas sobreviven a un reinicio del servicio y sus resultados no cambian.
- **Objetivo 5:** Los reversos se aceptan o rechazan según reglas claras (operación original inexistente, no aceptada, monto distinto o ya reversada) antes de cualquier sorteo.
- **Objetivo 6:** Se puede compilar, probar y ejecutar el servicio con solo Docker.

---

## Actores de negocio y flujo de valor
- **Servicio cliente:** Envía transferencias y reversos al banco simulado, reintenta con la misma referencia y consulta el estado de una operación cuando no sabe cómo terminó; obtiene un banco con comportamiento realista y controlable.
- **Desarrollador / evaluador:** Trabaja solo con Docker: configura las probabilidades de resultado y la espera del timeout, ejecuta las pruebas y levanta el servicio en un contenedor.
- **Operador:** Consulta la salud del servicio y traza su actividad en registros sin datos sensibles.

---

## Delimitación del Alcance (Scope Boundaries)
- **Dentro del Alcance (In Scope - Fase Actual):**
  - Registro de transferencias con resultado aleatorio ponderado: aceptada, rechazada, no disponible o respuesta tardía.
  - Idempotencia por referencia y detección de conflicto (misma referencia con datos distintos).
  - Consulta de una operación por su referencia (transferencias y reversos).
  - Registro de reversos totales con reglas deterministas de rechazo y el mismo sorteo de resultados.
  - Libro de operaciones persistente (JSONL de solo anexar), cargado al arrancar y conservado entre reinicios.
  - Configuración por variables: puerto, pesos de los resultados, espera del timeout, ruta del libro y nivel de registros.
  - Aleatoriedad, espera, reloj y libro sustituibles para pruebas deterministas.
  - Salud del servicio, formato uniforme de errores y registros de eventos sin datos sensibles.
  - Servicio sin autenticación, en el puerto 3004.
  - Contrato HTTP documentado (OpenAPI 3.1 en `services/bank-rail/openapi.yaml`).
  - Imagen de contenedor del servicio y su ejecución en Compose con un volumen persistente para el libro.
  - Entorno de desarrollo en contenedores (Compose propio de `services/bank-rail`; sin Node ni herramientas en el host).
- **Fuera del Alcance (Out of Scope / Non-Goals):**
  - Autenticación o autorización de las solicitudes.
  - Base de datos (la persistencia es solo el archivo del libro).
  - Otros modos de simulación distintos del sorteo ponderado y su timeout (por ejemplo, resultados que dependan del monto o de las cuentas).
  - Purga, rotación o compactación del libro de operaciones.
  - Interfaz de usuario.
  - Reversos parciales.

---

## Reglas de Negocio y Políticas del Dominio
- **RN-01 Referencia:** Cadena de 1 a 255 caracteres ASCII imprimibles (códigos 0x21 a 0x7E). Transferencias y reversos comparten el mismo espacio de referencias: una referencia identifica a una sola operación.
- **RN-02 Monto:** Cadena decimal `^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$` estrictamente mayor que 0 (COP). Se compara por valor (`10` y `10.00` son el mismo monto) y se registra con dos decimales. Un número JSON o un texto que no cumpla el patrón es inválido.
- **RN-03 Origen y destino:** `from` y `to` son textos de 1 a 255 caracteres; el banco no valida que las cuentas existan.
- **RN-04 Resultado aleatorio:** Una operación nueva que supera las reglas deterministas se sortea entre cuatro resultados según los pesos `RAIL_OUTCOME_WEIGHTS` (cuatro enteros no negativos, en el orden ACCEPTED, REJECTED, UNAVAILABLE, TIMEOUT, con suma mayor que 0; por defecto 25,25,25,25). Un peso 0 impide ese resultado.
- **RN-05 Registro por resultado:** ACCEPTED queda registrada como aceptada; REJECTED queda registrada como rechazada con motivo `REJECTED_BY_BANK`; UNAVAILABLE no deja ningún registro, de modo que la misma referencia puede reintentarse y sortearse de nuevo.
- **RN-06 Timeout simulado:** En TIMEOUT el banco espera `RAIL_TIMEOUT_DELAY_MS` milisegundos (por defecto 15000) antes de responder, y una segunda decisión aleatoria (50 % por defecto) determina si procesó la operación. Si la procesó, la deja registrada como aceptada antes de esperar y responde aceptada con retraso; si no la procesó, no registra nada y responde no disponible tras la espera.
- **RN-07 Idempotencia:** Repetir una referencia registrada con los mismos datos devuelve el mismo resultado guardado (mismo código y cuerpo) sin nuevo sorteo, sin espera y sin nueva entrada. Repetirla con datos distintos (o con otro tipo de operación) es un conflicto.
- **RN-08 Consulta:** Consultar una referencia es de solo lectura (nunca sortea ni registra): aceptada → 200, rechazada → 422, inexistente (o no registrada por indisponibilidad) → 404.
- **RN-09 Reglas de reverso:** Un reverso (`reference`, `originalReference`, `amount`) se evalúa en este orden: validación de datos; idempotencia por referencia; reglas deterministas, cada una registrada como rechazada con su motivo: `ORIGINAL_NOT_FOUND` (la original no existe), `ORIGINAL_NOT_ACCEPTED` (existe pero está rechazada o es otro reverso), `AMOUNT_MISMATCH` (el monto difiere del de la original) y `ALREADY_REVERSED` (ya existe un reverso aceptado sobre esa original con otra referencia); y, si las supera, el mismo sorteo de cuatro resultados que una transferencia. El reverso aceptado guarda la referencia de la original.
- **RN-10 Reverso total:** Un reverso anula la totalidad de la transferencia original. Un reverso rechazado no impide un nuevo intento con otra referencia.
- **RN-11 Libro persistente:** Cada operación registrada ocupa una línea JSON del archivo del libro (`RAIL_LEDGER_PATH`, por defecto `/data/rail-ledger.jsonl`) con `reference`, `kind`, `from`/`to` u `originalReference`, `amount`, `status`, `reason` si fue rechazada y `recordedAt`. Solo se anexa; nunca se modifica ni se borra. Se carga completo al arrancar y el servicio responde solo después de escribir la línea.
- **RN-12 Errores:** Todo error devuelve `{error:{code,message}}` con mensaje en español y sin datos sensibles.
- **RN-13 Sin autenticación:** El servicio no exige ni valida credenciales; solo es alcanzable por la red interna de Compose (el puerto 3004 del host es solo para depuración).

---

## Requerimientos Funcionales y Criterios EARS

### REQ-01: Registro de transferencias con resultado simulado
- **Historia de Usuario:**
  - **Como:** Servicio cliente
  - **Quiero:** Enviar una transferencia al banco y recibir uno de los resultados posibles de un banco poco fiable
  - **Para:** Probar el manejo de aceptación, rechazo, indisponibilidad y timeout

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-1.1 (Evento) — AC-RIE-01:**
  - `CUANDO` el cliente envía `POST /rail/transfers` válido con una referencia nueva y el sorteo resulta ACCEPTED
  - `EL SISTEMA DEBE` registrar la transferencia como aceptada y responder 200 con `{reference, status:"ACCEPTED"}`.
- **REQ-1.2 (Evento) — AC-RIE-02:**
  - `CUANDO` el cliente envía `POST /rail/transfers` válido con una referencia nueva y el sorteo resulta REJECTED
  - `EL SISTEMA DEBE` registrar la transferencia como rechazada con motivo `REJECTED_BY_BANK` y responder 422 con código `REJECTED`.
- **REQ-1.3 (Evento) — AC-RIE-03:**
  - `CUANDO` el cliente envía `POST /rail/transfers` válido con una referencia nueva y el sorteo resulta UNAVAILABLE
  - `EL SISTEMA DEBE` responder 503 con código `UNAVAILABLE` sin registrar nada, de modo que la misma referencia pueda reintentarse y sortearse de nuevo.
- **REQ-1.4 (Evento) — AC-RIE-04:**
  - `CUANDO` el sorteo resulta TIMEOUT y la segunda decisión indica que el banco procesó la operación
  - `EL SISTEMA DEBE` registrar la transferencia como aceptada antes de esperar, esperar `RAIL_TIMEOUT_DELAY_MS` y responder entonces 200 `{reference, status:"ACCEPTED"}`; una consulta posterior de esa referencia responde 200.
- **REQ-1.5 (Evento) — AC-RIE-05:**
  - `CUANDO` el sorteo resulta TIMEOUT y la segunda decisión indica que el banco no procesó la operación
  - `EL SISTEMA DEBE` esperar `RAIL_TIMEOUT_DELAY_MS`, responder 503 con código `UNAVAILABLE` sin registrar nada; una consulta posterior de esa referencia responde 404.
- **REQ-1.6 (Ubicuo) — AC-RIE-06:**
  - `EL SISTEMA DEBE` sortear el resultado de cada operación nueva con probabilidad proporcional a los pesos configurados (un peso 0 impide ese resultado y pesos `100,0,0,0` producen siempre ACCEPTED).
- **REQ-1.7 (Excepción) — AC-RIE-07:**
  - `SI` el cuerpo de `POST /rail/transfers` incumple RN-01, RN-02 o RN-03 (referencia vacía, de más de 255 caracteres o con caracteres fuera de 0x21–0x7E; monto `0`, `0.00`, negativo, con más de dos decimales o como número JSON; `from` o `to` ausentes o no textuales), tiene campos faltantes o campos adicionales, o no es JSON `CUANDO` se envía
  - `EL SISTEMA DEBE` responder 400 con código `VALIDATION_ERROR` sin sortear ni registrar nada.

### REQ-02: Idempotencia por referencia
- **Historia de Usuario:**
  - **Como:** Servicio cliente
  - **Quiero:** Repetir una solicitud con la misma referencia sin riesgo de duplicarla
  - **Para:** Reintentar con seguridad tras un error de comunicación

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-2.1 (Evento) — AC-RIE-08:**
  - `CUANDO` el cliente envía una referencia ya registrada (aceptada o rechazada) con los mismos datos
  - `EL SISTEMA DEBE` devolver el resultado guardado (mismo código y cuerpo) sin nuevo sorteo, sin espera y sin añadir una entrada al libro.
- **REQ-2.2 (Excepción) — AC-RIE-09:**
  - `SI` la referencia ya está registrada, sea cual sea su resultado, con datos distintos (`from`, `to` o monto en una transferencia; otro tipo de operación) `CUANDO` se envía
  - `EL SISTEMA DEBE` responder 409 con código `REFERENCE_CONFLICT` sin modificar el libro.
- **REQ-2.3 (Evento) — AC-RIE-10:**
  - `CUANDO` llegan dos solicitudes simultáneas con la misma referencia y los mismos datos
  - `EL SISTEMA DEBE` realizar un solo sorteo y dejar una sola línea en el libro, y ambas respuestas deben ser iguales (la segunda es el resultado guardado).

### REQ-03: Consulta de operaciones
- **Historia de Usuario:**
  - **Como:** Servicio cliente
  - **Quiero:** Consultar qué ocurrió con una referencia
  - **Para:** Resolver la incertidumbre tras un timeout o una falla de comunicación

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-3.1 (Evento) — AC-RIE-11:**
  - `CUANDO` el cliente envía `GET /rail/transfers/{reference}` de una transferencia o un reverso aceptado
  - `EL SISTEMA DEBE` responder 200 con `{reference, status:"ACCEPTED"}`.
- **REQ-3.2 (Evento) — AC-RIE-12:**
  - `CUANDO` el cliente consulta una referencia registrada como rechazada
  - `EL SISTEMA DEBE` responder 422 con código `REJECTED` y un mensaje que incluya el motivo del rechazo.
- **REQ-3.3 (Evento) — AC-RIE-13:**
  - `CUANDO` el cliente consulta una referencia sin registro (nunca enviada, indisponible, timeout no procesado o con formato inválido)
  - `EL SISTEMA DEBE` responder 404 con código `NOT_FOUND`.
- **REQ-3.4 (Ubicuo) — AC-RIE-14:**
  - `EL SISTEMA DEBE` atender toda consulta en modo de solo lectura: nunca sortea un resultado ni escribe en el libro.
- **REQ-3.5 (Excepción) — AC-RIE-15:**
  - `SI` falla la lectura interna del libro `CUANDO` se consulta una referencia
  - `EL SISTEMA DEBE` responder 503 con código `UNAVAILABLE` (nunca 503 por otro motivo en una consulta).

### REQ-04: Reversos
- **Historia de Usuario:**
  - **Como:** Servicio cliente
  - **Quiero:** Solicitar el reverso total de una transferencia aceptada
  - **Para:** Recuperar los fondos de una operación errónea

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-4.1 (Evento) — AC-RIE-16:**
  - `CUANDO` el cliente envía `POST /rail/reversals` válido sobre una transferencia aceptada con el mismo monto, sin reverso aceptado previo, y el sorteo resulta ACCEPTED
  - `EL SISTEMA DEBE` registrar el reverso como aceptado guardando la referencia de la original y responder 200 con `{reference, status:"ACCEPTED"}`.
- **REQ-4.2 (Excepción) — AC-RIE-17:**
  - `SI` la referencia original no existe `CUANDO` se solicita un reverso
  - `EL SISTEMA DEBE` registrar el reverso como rechazado con motivo `ORIGINAL_NOT_FOUND` y responder 422 con código `ORIGINAL_NOT_FOUND`, sin sortear.
- **REQ-4.3 (Excepción) — AC-RIE-18:**
  - `SI` la operación original existe pero está rechazada o es otro reverso `CUANDO` se solicita un reverso
  - `EL SISTEMA DEBE` registrar el reverso como rechazado con motivo `ORIGINAL_NOT_ACCEPTED` y responder 422 con código `ORIGINAL_NOT_ACCEPTED`, sin sortear.
- **REQ-4.4 (Excepción) — AC-RIE-19:**
  - `SI` el monto del reverso difiere del de la operación original `CUANDO` se solicita
  - `EL SISTEMA DEBE` registrar el reverso como rechazado con motivo `AMOUNT_MISMATCH` y responder 422 con código `AMOUNT_MISMATCH`, sin sortear.
- **REQ-4.5 (Excepción) — AC-RIE-20:**
  - `SI` ya existe un reverso aceptado sobre la misma original, con otra referencia `CUANDO` se solicita otro reverso
  - `EL SISTEMA DEBE` registrar el nuevo reverso como rechazado con motivo `ALREADY_REVERSED` y responder 422 con código `ALREADY_REVERSED`, sin sortear. Un reverso previo rechazado no cuenta como reverso aceptado.
- **REQ-4.6 (Ubicuo) — AC-RIE-21:**
  - `EL SISTEMA DEBE` evaluar cada reverso en este orden: validación de datos (400), idempotencia por referencia, reglas deterministas (en el orden `ORIGINAL_NOT_FOUND`, `ORIGINAL_NOT_ACCEPTED`, `AMOUNT_MISMATCH`, `ALREADY_REVERSED`) y, solo si las supera, el sorteo.
- **REQ-4.7 (Evento) — AC-RIE-22:**
  - `CUANDO` el cliente envía una referencia de reverso ya registrada
  - `EL SISTEMA DEBE` devolver el resultado guardado si los datos (`originalReference` y monto) coinciden, y responder 409 `REFERENCE_CONFLICT` si difieren o si la referencia pertenece a una transferencia.
- **REQ-4.8 (Evento) — AC-RIE-23:**
  - `CUANDO` un reverso supera las reglas deterministas
  - `EL SISTEMA DEBE` resolverlo con el mismo sorteo de cuatro resultados y la misma semántica de registro y de timeout que una transferencia (REJECTED → 422 con código `REJECTED`; UNAVAILABLE → 503 sin registrar; TIMEOUT según RN-06).

### REQ-05: Libro de operaciones persistente
- **Historia de Usuario:**
  - **Como:** Servicio cliente
  - **Quiero:** Que el banco recuerde sus operaciones aunque se reinicie
  - **Para:** Obtener siempre la misma verdad al consultar o repetir una referencia

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-5.1 (Ubicuo) — AC-RIE-24:**
  - `EL SISTEMA DEBE` registrar cada operación aceptada o rechazada como una línea JSON anexada al archivo del libro según RN-11, y responder solo después de escribir la línea.
- **REQ-5.2 (Evento) — AC-RIE-25:**
  - `CUANDO` el servicio arranca sobre un libro existente
  - `EL SISTEMA DEBE` cargarlo completo, de modo que consultas y repeticiones de referencias devuelvan los mismos resultados que antes del reinicio, sin nuevo sorteo.
- **REQ-5.3 (Evento) — AC-RIE-26:**
  - `CUANDO` el servicio arranca y el archivo del libro (o su directorio) no existe
  - `EL SISTEMA DEBE` crearlos y arrancar con el libro vacío.
- **REQ-5.4 (Excepción) — AC-RIE-27:**
  - `SI` la última línea del libro está truncada (sin salto de línea final y no es JSON válido) `CUANDO` el servicio arranca
  - `EL SISTEMA DEBE` ignorarla, descartarla del archivo, registrar una advertencia y arrancar con el resto de operaciones.
- **REQ-5.5 (Excepción) — AC-RIE-28:**
  - `SI` cualquier otra línea del libro es inválida (no es JSON, le faltan campos o repite una referencia) `CUANDO` el servicio arranca
  - `EL SISTEMA DEBE` fallar al arrancar con un mensaje claro que indique el número de línea, sin modificar el archivo.
- **REQ-5.6 (Excepción) — AC-RIE-29:**
  - `SI` falla la escritura de la línea en el libro `CUANDO` se registra una operación
  - `EL SISTEMA DEBE` responder 503 con código `UNAVAILABLE` sin dejar la operación visible (una consulta posterior no la encuentra).

### REQ-06: Configuración y testabilidad
- **Historia de Usuario:**
  - **Como:** Desarrollador / evaluador
  - **Quiero:** Ajustar el comportamiento del banco y controlarlo en pruebas
  - **Para:** Reproducir cada escenario de forma determinista

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-6.1 (Ubicuo) — AC-RIE-30:**
  - `EL SISTEMA DEBE` leer su configuración de las variables `PORT` (3004), `RAIL_OUTCOME_WEIGHTS` (25,25,25,25), `RAIL_TIMEOUT_DELAY_MS` (15000), `RAIL_LEDGER_PATH` (`/data/rail-ledger.jsonl`) y `LOG_LEVEL` (`info`), usando los valores por defecto entre paréntesis cuando no se definen.
- **REQ-6.2 (Excepción) — AC-RIE-31:**
  - `SI` `RAIL_OUTCOME_WEIGHTS` no son cuatro enteros no negativos separados por comas o su suma es 0 `CUANDO` el servicio arranca
  - `EL SISTEMA DEBE` terminar el proceso con error y un mensaje claro que nombre la variable.
- **REQ-6.3 (Excepción) — AC-RIE-32:**
  - `SI` `PORT`, `RAIL_TIMEOUT_DELAY_MS`, `RAIL_LEDGER_PATH` o `LOG_LEVEL` tienen un valor inválido (puerto fuera de 1–65535, espera no entera o negativa, ruta vacía, nivel desconocido) `CUANDO` el servicio arranca
  - `EL SISTEMA DEBE` terminar el proceso con error y un mensaje claro que nombre la variable.
- **REQ-6.4 (Ubicuo) — AC-RIE-33:**
  - `EL SISTEMA DEBE` permitir sustituir el sorteo de resultados (`OutcomePicker`), la espera y el reloj (`Delay`) y el libro (`Ledger`) al componer el servicio, de modo que las pruebas controlen cada resultado y no esperen tiempos reales.

### REQ-07: Operación del servicio
- **Historia de Usuario:**
  - **Como:** Operador
  - **Quiero:** Conocer el estado del servicio y trazar su actividad
  - **Para:** Operarlo sin exponer datos sensibles

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-7.1 (Evento) — AC-RIE-34:**
  - `CUANDO` se consulta `GET /health`
  - `EL SISTEMA DEBE` responder 200 con `{status:"ok"}`.
- **REQ-7.2 (Ubicuo) — AC-RIE-35:**
  - `EL SISTEMA DEBE` responder todo error con el formato `{error:{code,message}}`, mensaje en español y sin datos internos (rutas inexistentes: 404 `NOT_FOUND`; fallos inesperados: 500 `INTERNAL_ERROR`).
- **REQ-7.3 (Ubicuo) — AC-RIE-36:**
  - `EL SISTEMA DEBE` atender todas las rutas sin exigir autenticación ni credenciales (una cabecera `Authorization` presente no cambia el resultado).
- **REQ-7.4 (Ubicuo) — AC-RIE-37:**
  - `EL SISTEMA DEBE` registrar en logs JSON, con el identificador de la solicitud (cabecera `X-Request-Id`, generado si falta), los eventos `rail.request`, `rail.response`, `rail.outcome_chosen` (con referencia, tipo de operación y resultado sorteado) y `rail.timeout`, y nunca registrar las cabeceras `Authorization` ni `Cookie` ni datos de las cuentas o montos.
- **REQ-7.5 (Evento) — AC-RIE-38:**
  - `CUANDO` un desarrollador construye la imagen del servicio y lo levanta en Compose
  - `EL SISTEMA DEBE` producir una imagen con el servicio compilado, que ejecuta como usuario no administrador, con el libro en un volumen persistente (`rail_data` montado en `/data`) y el servicio sano (responde `/health` 200 en el puerto 3004); al recrear el contenedor sin borrar volúmenes, las operaciones registradas siguen consultables.

### REQ-08: Contrato HTTP documentado
- **Historia de Usuario:**
  - **Como:** Integrador
  - **Quiero:** Un contrato documentado del servicio
  - **Para:** Consumirlo sin leer su código

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-8.1 (Ubicuo) — AC-RIE-39:**
  - `EL SISTEMA DEBE` mantener `services/bank-rail/openapi.yaml` (OpenAPI 3.1) describiendo todos los endpoints de REQ-01 a REQ-07 con sus respuestas de éxito y de error.

### REQ-09: Entorno de desarrollo en contenedores
- **Historia de Usuario:**
  - **Como:** Desarrollador
  - **Quiero:** Compilar, probar y ejecutar el servicio solo con Docker
  - **Para:** Trabajar sin instalar nada en mi máquina

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-9.1 (Evento) — AC-RIE-40:**
  - `CUANDO` el desarrollador ejecuta `npm ci`, el lint, la verificación de tipos, el formato o las pruebas mediante `docker compose -f services/bank-rail/compose.dev.yaml run --rm dev ...`
  - `EL SISTEMA DEBE` ejecutarlos dentro de un contenedor Node 24.22.0 con el repositorio montado en `/app`, sin requerir Node, npm ni otras herramientas en el host (solo Docker y Git), y completarlos sin errores ni advertencias. Las versiones de las dependencias del servicio son exactas.

### Entorno de Compose (referencia para REQ-7.5 y REQ-9)
Archivo `services/bank-rail/compose.dev.yaml` (proyecto Compose `fluxone-bank-rail-dev`) con dos servicios: `dev` (imagen basada en `node:24.22.0-alpine`, repositorio montado en `/app`; ejecuta npm, lint, tipos y pruebas) y `bank-rail` (el servicio empaquetado, con el puerto 3004 publicado para depuración y el volumen `rail_data` montado en `/data`). No hay base de datos. Prefijo de todo comando: `docker compose -f services/bank-rail/compose.dev.yaml`. Limpieza: `down -v`.

---

## Edge Cases & Boundary Conditions
| ID | Escenario / Condición Límite | Comportamiento Esperado del Sistema |
|:---|:---|:---|
| **EC-01** | Dos solicitudes simultáneas con la misma referencia y los mismos datos | Un solo sorteo y una sola línea en el libro; ambas respuestas iguales. |
| **EC-02** | La última línea del libro está truncada (corte durante una escritura) | Se ignora y se descarta con una advertencia; el servicio arranca con las demás operaciones. |
| **EC-03** | Una línea del libro que no es la última está corrupta | El arranque falla con un mensaje claro que indica la línea. |
| **EC-04** | `RAIL_OUTCOME_WEIGHTS` inválido (`1,2,3`, `a,b,c,d`, `-1,2,3,4`, `0,0,0,0`, `25, 25,25,25`) | El proceso falla al arrancar con un mensaje claro. |
| **EC-05** | Reverso con monto distinto al de la original | 422 `AMOUNT_MISMATCH`, registrado, sin sorteo. |
| **EC-06** | Segundo reverso (otra referencia) sobre una original ya reversada | 422 `ALREADY_REVERSED`, registrado, sin sorteo. |
| **EC-07** | Reverso de una operación rechazada | 422 `ORIGINAL_NOT_ACCEPTED`, registrado, sin sorteo. |
| **EC-08** | Reverso de otro reverso aceptado | 422 `ORIGINAL_NOT_ACCEPTED`, registrado, sin sorteo. |
| **EC-09** | Reverso previo rechazado y nuevo reverso de la misma original con otra referencia | El previo no cuenta: el nuevo supera las reglas y se sortea. |
| **EC-10** | Reverso cuya referencia ya pertenece a una transferencia | 409 `REFERENCE_CONFLICT`. |
| **EC-11** | Referencia que recibió 503 (UNAVAILABLE) y se reintenta | Se sortea de nuevo: puede dar un resultado distinto. |
| **EC-12** | Timeout y el banco sí procesó | Respuesta 200 tardía; `GET` posterior 200; repetir la referencia devuelve el resultado guardado sin esperar. |
| **EC-13** | Timeout y el banco no procesó | Respuesta 503 tardía; `GET` posterior 404; reenviar la misma referencia la sortea de nuevo. |
| **EC-14** | Monto `10` en una operación y `10.00` al repetirla | Mismo monto: se devuelve el resultado guardado (no hay conflicto). |
| **EC-15** | Monto `0`, `0.00`, `-1`, `1.234`, número JSON o con más de 16 dígitos enteros | 400 `VALIDATION_ERROR`. |
| **EC-16** | Referencia de 255 caracteres (válida) y de 256 (inválida); con espacios o acentos | 255 se acepta; 256, espacios y no ASCII reciben 400. |
| **EC-17** | `GET` de una referencia con formato inválido | 404 `NOT_FOUND`. |
| **EC-18** | Reinicio del servicio | Mismas respuestas a consultas y repeticiones; el libro no cambia. |
| **EC-19** | Pesos `100,0,0,0` o `RAIL_TIMEOUT_DELAY_MS=0` | Siempre ACCEPTED; el timeout responde sin espera. |
| **EC-20** | El cliente cierra la conexión antes de la respuesta tardía de un timeout | La operación ya está registrada si el banco la procesó; el cliente puede consultar por la referencia. |
| **EC-21** | Falla la escritura en el libro | 503 `UNAVAILABLE`; la operación no queda visible. |
| **EC-22** | Ruta inexistente o método no permitido | 404 `NOT_FOUND` (formato uniforme). |

---

## Restricciones Operativas y de Cumplimiento (Nivel Negocio)
- **Tiempo de Respuesta Operativo (SLA de Usuario):** Excepto en el resultado TIMEOUT (que espera deliberadamente `RAIL_TIMEOUT_DELAY_MS`), cada respuesta debe ser perceptible como inmediata (menos de 1 segundo en condiciones normales).
- **Privacidad y Cumplimiento Normativo:** El servicio no almacena datos personales; solo guarda referencias, cuentas de origen y destino como texto y montos. Los registros de eventos no incluyen cuentas ni montos ni cabeceras sensibles.
- **Continuidad de Negocio:** Un reinicio del servicio no cambia el resultado de ninguna operación registrada.
- **Alcance de red:** El servicio no tiene autenticación; solo debe ser alcanzable por la red interna de Compose (el puerto publicado en el host es solo para depuración).
- **Instancia única:** El libro es un archivo de un solo escritor; el servicio debe ejecutarse como una única instancia.

---

## Trazabilidad de criterios de aceptación
Cada prueba automatizada incluye su ID `[AC-RIE-NN]` en el nombre. Las rutas de pruebas son relativas a `services/bank-rail/`. Los comandos se ejecutan desde la raíz del repositorio y todos usan el prefijo `docker compose -f services/bank-rail/compose.dev.yaml`. En las celdas de la tabla el carácter `|` de un comando se escribe `\|` por sintaxis de tabla. Las pruebas de aceptación componen el servicio real y lo ejercitan con inyección de solicitudes HTTP, con un sorteo determinista, una espera simulada y un archivo de libro temporal; no usan red ni base de datos.

| AC | Criterio | Verificación |
|:---|:---|:---|
| AC-RIE-01 | REQ-1.1: sorteo ACCEPTED → 200 y registro aceptado | `tests/acceptance/transfers.test.ts` |
| AC-RIE-02 | REQ-1.2: sorteo REJECTED → 422 `REJECTED` y registro rechazado `REJECTED_BY_BANK` | `tests/acceptance/transfers.test.ts` |
| AC-RIE-03 | REQ-1.3: sorteo UNAVAILABLE → 503 sin registro y reintento posible | `tests/acceptance/transfers.test.ts` |
| AC-RIE-04 | REQ-1.4: TIMEOUT procesado → registro antes de esperar, 200 tardío y `GET` 200 | `tests/acceptance/transfers.test.ts` |
| AC-RIE-05 | REQ-1.5: TIMEOUT no procesado → espera, 503, sin registro y `GET` 404 | `tests/acceptance/transfers.test.ts` |
| AC-RIE-06 | REQ-1.6: sorteo proporcional a los pesos | `tests/unit/domain/outcome.test.ts`, `tests/unit/adapters/random-outcome-picker.test.ts`, `tests/acceptance/transfers.test.ts` |
| AC-RIE-07 | REQ-1.7: cuerpo inválido → 400 `VALIDATION_ERROR` sin efecto | `tests/unit/domain/amount.test.ts`, `tests/unit/domain/reference.test.ts`, `tests/unit/domain/requests.test.ts`, `tests/acceptance/transfers.test.ts` |
| AC-RIE-08 | REQ-2.1: misma referencia y datos → resultado guardado sin sorteo ni entrada nueva | `tests/acceptance/idempotency.test.ts` |
| AC-RIE-09 | REQ-2.2: misma referencia con datos distintos → 409 `REFERENCE_CONFLICT` | `tests/unit/domain/operation.test.ts`, `tests/acceptance/idempotency.test.ts` |
| AC-RIE-10 | REQ-2.3: dos solicitudes simultáneas → un sorteo y una línea | `tests/unit/application/serial-executor.test.ts`, `tests/acceptance/idempotency.test.ts` |
| AC-RIE-11 | REQ-3.1: `GET` de aceptada (transferencia o reverso) → 200 | `tests/acceptance/lookup.test.ts` |
| AC-RIE-12 | REQ-3.2: `GET` de rechazada → 422 `REJECTED` con motivo | `tests/acceptance/lookup.test.ts` |
| AC-RIE-13 | REQ-3.3: `GET` sin registro → 404 `NOT_FOUND` | `tests/acceptance/lookup.test.ts` |
| AC-RIE-14 | REQ-3.4: consulta de solo lectura | `tests/acceptance/lookup.test.ts` |
| AC-RIE-15 | REQ-3.5: fallo de lectura del libro → 503 `UNAVAILABLE` | `tests/acceptance/lookup.test.ts` |
| AC-RIE-16 | REQ-4.1: reverso válido aceptado → 200 con `originalReference` guardada | `tests/acceptance/reversals.test.ts` |
| AC-RIE-17 | REQ-4.2: `ORIGINAL_NOT_FOUND` | `tests/unit/domain/reversal-rules.test.ts`, `tests/acceptance/reversals.test.ts` |
| AC-RIE-18 | REQ-4.3: `ORIGINAL_NOT_ACCEPTED` | `tests/unit/domain/reversal-rules.test.ts`, `tests/acceptance/reversals.test.ts` |
| AC-RIE-19 | REQ-4.4: `AMOUNT_MISMATCH` | `tests/unit/domain/reversal-rules.test.ts`, `tests/acceptance/reversals.test.ts` |
| AC-RIE-20 | REQ-4.5: `ALREADY_REVERSED` | `tests/unit/domain/reversal-rules.test.ts`, `tests/acceptance/reversals.test.ts` |
| AC-RIE-21 | REQ-4.6: orden validación, idempotencia, reglas, sorteo | `tests/unit/domain/reversal-rules.test.ts`, `tests/acceptance/reversals.test.ts` |
| AC-RIE-22 | REQ-4.7: idempotencia y conflicto en reversos | `tests/acceptance/reversals.test.ts` |
| AC-RIE-23 | REQ-4.8: mismo sorteo y semántica que transferencias | `tests/acceptance/reversals.test.ts` |
| AC-RIE-24 | REQ-5.1: una línea JSON anexada por operación registrada, respuesta tras escribir | `tests/unit/adapters/jsonl-file-ledger.test.ts`, `tests/acceptance/persistence.test.ts` |
| AC-RIE-25 | REQ-5.2: tras un reinicio, mismos resultados | `tests/unit/adapters/jsonl-file-ledger.test.ts`, `tests/acceptance/persistence.test.ts` |
| AC-RIE-26 | REQ-5.3: crea directorio y archivo si no existen | `tests/unit/adapters/jsonl-file-ledger.test.ts` |
| AC-RIE-27 | REQ-5.4: última línea truncada ignorada con advertencia | `tests/unit/adapters/jsonl-file-ledger.test.ts`, `tests/acceptance/persistence.test.ts` |
| AC-RIE-28 | REQ-5.5: otra línea corrupta hace fallar el arranque | `tests/unit/adapters/jsonl-file-ledger.test.ts`, `tests/acceptance/persistence.test.ts` |
| AC-RIE-29 | REQ-5.6: fallo de escritura → 503 sin operación visible | `tests/unit/adapters/jsonl-file-ledger.test.ts`, `tests/acceptance/persistence.test.ts` |
| AC-RIE-30 | REQ-6.1: valores por defecto y variables de configuración | `tests/unit/config.test.ts` |
| AC-RIE-31 | REQ-6.2: pesos inválidos terminan el proceso con mensaje claro | `tests/unit/domain/outcome.test.ts`, `tests/unit/config.test.ts`, y comando `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps -w /app/services/bank-rail -e RAIL_OUTCOME_WEIGHTS=0,0,0,0 dev npx tsx src/main.ts` (exit ≠ 0 con mensaje que contiene `RAIL_OUTCOME_WEIGHTS`) |
| AC-RIE-32 | REQ-6.3: otras variables inválidas terminan el proceso con mensaje claro | `tests/unit/config.test.ts` |
| AC-RIE-33 | REQ-6.4: `OutcomePicker`, `Delay` y `Ledger` sustituibles al componer | `tests/acceptance/composition.test.ts` |
| AC-RIE-34 | REQ-7.1: `GET /health` → 200 `{status:"ok"}` | `tests/acceptance/operability.test.ts` |
| AC-RIE-35 | REQ-7.2: todo error usa `{error:{code,message}}` en español sin datos internos | `tests/acceptance/operability.test.ts` |
| AC-RIE-36 | REQ-7.3: sin autenticación | `tests/acceptance/operability.test.ts` |
| AC-RIE-37 | REQ-7.4: eventos en logs JSON sin datos sensibles | `tests/acceptance/operability.test.ts` |
| AC-RIE-38 | REQ-7.5: imagen no administradora, servicio sano en Compose con volumen persistente | en orden: (1) `docker compose -f services/bank-rail/compose.dev.yaml build bank-rail` (exit 0); (2) `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps --entrypoint sh bank-rail -c "ls services/bank-rail/dist/main.js && id -un"` (lista el archivo y muestra `node`); (3) `RAIL_OUTCOME_WEIGHTS=100,0,0,0 docker compose -f services/bank-rail/compose.dev.yaml up -d --wait bank-rail` (exit 0; el healthcheck consulta `/health`; los pesos `100,0,0,0` garantizan una aceptación); (4) `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev node -e "fetch('http://bank-rail:3004/rail/transfers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reference:'PERSIST-1',from:'ACC-001',to:'EXT-0001',amount:'10.00'})}).then((r)=>process.exit(r.status===200?0:1))"` (exit 0); (5) `docker compose -f services/bank-rail/compose.dev.yaml up -d --force-recreate --wait bank-rail`; (6) `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev node -e "fetch('http://bank-rail:3004/rail/transfers/PERSIST-1').then((r)=>process.exit(r.status===200?0:1))"` (exit 0); (7) `docker compose -f services/bank-rail/compose.dev.yaml down -v` (limpieza) |
| AC-RIE-39 | REQ-8.1: `services/bank-rail/openapi.yaml` (OpenAPI 3.1) describe todos los endpoints | `tests/acceptance/openapi.test.ts` |
| AC-RIE-40 | REQ-9.1: instalación, lint, tipos, formato y pruebas dentro del contenedor, sin errores | comandos `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm ci`, `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run lint`, `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run format:check`, `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run typecheck --workspaces --if-present` y `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev npm run test -w services/bank-rail`; además `docker compose -f services/bank-rail/compose.dev.yaml config -q` (exit 0) y `docker compose -f services/bank-rail/compose.dev.yaml run --rm --no-deps dev node --version` (muestra `v24.22.0`) |
