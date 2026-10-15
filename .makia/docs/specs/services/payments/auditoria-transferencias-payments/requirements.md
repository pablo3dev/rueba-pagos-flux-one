# Requisitos: auditoria-transferencias-payments

## Estado

Implementado. El código de esta unidad ya cumple este spec.

## Historia

Cada cambio de estado de transferencia escribe un evento en el outbox dentro de la misma transacción. Un relay lo publica en RabbitMQ con confirms y reintento.

## Criterios

- [x] Dado el portal levantado, cuando se ejerce esta capacidad, el sistema cumple: Cada cambio de estado de transferencia escribe un evento en el outbox dentro de la misma transacción. Un relay lo publica en RabbitMQ con confirms y reintento.
