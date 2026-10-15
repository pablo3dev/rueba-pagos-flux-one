# Requisitos: auditoria-transferencias-audit

## Estado

Implementado. El código de esta unidad ya cumple este spec.

## Historia

El servicio consume audit.transfer-events de forma idempotente, persiste en audit_schema y manda a DLQ lo que no puede guardar. GET /audit/transfers/{id}/events exige JWT y filtra por visibilidad.

## Criterios

- [x] Dado el portal levantado, cuando se ejerce esta capacidad, el sistema cumple: El servicio consume audit.transfer-events de forma idempotente, persiste en audit_schema y manda a DLQ lo que no puede guardar. GET /audit/transfers/{id}/events exige JWT y filtra por visibilidad.
