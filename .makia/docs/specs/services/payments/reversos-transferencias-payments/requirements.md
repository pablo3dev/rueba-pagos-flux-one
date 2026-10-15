# Requisitos: reversos-transferencias-payments

## Estado

Implementado. El código de esta unidad ya cumple este spec.

## Historia

Un cliente autenticado reversa una sola vez una transferencia COMPLETED. La interna se revierte en una transacción. La externa se coordina con el riel y concilia UNKNOWN. Idempotency-Key guarda la respuesta.

## Criterios

- [x] Dado el portal levantado, cuando se ejerce esta capacidad, el sistema cumple: Un cliente autenticado reversa una sola vez una transferencia COMPLETED. La interna se revierte en una transacción. La externa se coordina con el riel y concilia UNKNOWN. Idempotency-Key guarda la respuesta.
