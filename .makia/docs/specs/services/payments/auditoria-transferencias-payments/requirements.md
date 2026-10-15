# Publicación de cada cambio de estado

> Este documento es el **artefacto de aprobación del USUARIO**. Es autosuficiente: todo lo necesario para aprobar el alcance, las reglas, los objetivos y los criterios de éxito del spec está aquí.

- **Spec:** `auditoria-transferencias-payments`
- **Feature:** `auditoria-transferencias` — **Unidad de código:** `services/payments`

## Resumen
Cada cambio de estado de una transferencia deja un evento en la misma transacción del dinero. Un relevo lo publica en RabbitMQ. Si el mensajero falla, la transferencia no se deshace y el evento se reintenta.

## Problema
Sin esta capacidad el cliente no puede completar el flujo de valor del portal de pagos en COP: o pierde visibilidad del dinero, o no puede corregir una transferencia ya hecha, o el operador no puede levantar el producto para comprobarlo.

## Solución
- **En qué consiste:** Cada cambio de estado de una transferencia deja un evento en la misma transacción del dinero. Un relevo lo publica en RabbitMQ. Si el mensajero falla, la transferencia no se deshace y el evento se reintenta.
- **Cómo resuelve el problema:** La capacidad queda cerrada en esta unidad, con reglas explícitas, rechazo claro cuando no se cumplen y sin perder ni duplicar dinero.

## Objetivos y criterios de éxito
- **Objetivo 1:** El actor obtiene el resultado de negocio descrito en el resumen, en español claro.
- **Objetivo 2:** Un reintento o un fallo externo no duplica el efecto ni deja el dinero en un estado inexplicable.
- **Objetivo 3:** Lo que no corresponde al actor se responde como inexistente, sin filtrar datos ajenos.

---

## Actores de negocio y flujo de valor
- **Cliente autenticado:** Opera su dinero y consulta solo lo que le es visible.
- **Banco simulado:** Resuelve transferencias y reversos externos de forma no confiable.
- **Operador:** Levanta el portal y comprueba el flujo.

---

## Delimitación del Alcance (Scope Boundaries)
- **Dentro del Alcance (In Scope - Fase Actual):**
  - Escribir el evento de auditoría en la misma transacción del cambio de estado.
  - Publicar transfer.created, transfer.completed, transfer.failed, transfer.unknown, transfer.reversal_requested, transfer.reversed y transfer.reversal_rejected.
  - Reintentar la publicación sin bloquear al cliente.
- **Fuera del Alcance (Out of Scope / Non-Goals):**
  - Reversos parciales.
  - Payment Links.
  - Multimoneda, alta de cuentas, recuperación de contraseña, MFA y roles de administrador.
  - SSE, WebSockets y despliegue en la nube.

---

## Reglas de Negocio y Políticas del Dominio
- **RN-01 Idempotencia:** Toda operación de dinero exige `Idempotency-Key`. La misma clave y el mismo pedido devuelven la misma respuesta. La misma clave con otro pedido se rechaza.
- **RN-02 Dinero:** COP, monto en texto decimal mayor que cero, persistido como numeric(18,2). Nunca un número de punto flotante.
- **RN-03 Visibilidad:** Solo ven la transferencia el dueño de la cuenta origen y, si es interna, el dueño de la cuenta destino. El resto recibe que no existe.
- **RN-04 Efecto único:** Un doble envío no mueve el dinero dos veces.

---

## Requerimientos Funcionales y Criterios EARS

### REQ-01: Outbox
- **Historia de Usuario:**
  - **Como:** operador
  - **Quiero:** un rastro por cada cambio de estado
  - **Para:** auditar sin perder eventos si el mensajero cae

#### Criterios de Aceptación y Comportamiento del Sistema (Sintaxis EARS)
- **REQ-1.1 (Comportamiento Siempre Activo / Ubicuo):**
  - `EL SISTEMA DEBE` escribir un solo evento por cambio de estado, en la misma transacción del dinero
- **REQ-1.2 (Flujo Principal / Basado en Eventos):**
  - `CUANDO` el estado de una transferencia cambia
  - `EL SISTEMA DEBE` encolar el evento y responder al cliente sin esperar al mensajero
- **REQ-1.3 (Comportamiento Condicional / Basado en Estado):**
  - `MIENTRAS` el mensajero no confirma `CUANDO` el relevo intenta publicar
  - `EL SISTEMA DEBE` reintentar con el mismo identificador de evento
- **REQ-1.4 (Excepción o Manejo de Invalidez):**
  - `SI` el evento ya se publicó `CUANDO` el relevo vuelve a tomarlo
  - `EL SISTEMA DEBE` no duplicar el efecto de negocio


---

## Edge Cases & Boundary Conditions
| ID | Escenario / Condición Límite | Comportamiento Esperado del Sistema |
|:---|:---|:---|
| **EC-01** | La misma clave de idempotencia se reenvía con el mismo pedido | Se devuelve la respuesta guardada y no hay un segundo efecto. |
| **EC-02** | La misma clave llega con un pedido distinto | Se rechaza y el estado anterior se conserva. |
| **EC-03** | El actor no es dueño de la cuenta origen | La operación se responde como inexistente. |

---

## Restricciones Operativas y de Cumplimiento (Nivel Negocio)
- **Tiempo de Respuesta Operativo (SLA de Usuario):** Crear una transferencia o un reverso confirma de inmediato. El banco externo se concilia después, sin bloquear al cliente.
- **Privacidad y Cumplimiento Normativo:** No se muestran saldos, cuentas ni eventos de otro cliente.
- **Continuidad de Negocio:** Si el banco o el mensajero fallan, el dinero queda retenido o reembolsado según la regla, nunca perdido.
