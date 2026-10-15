# Requisitos: entorno-local-infra

## Estado

Implementado. El código de esta unidad ya cumple este spec.

## Historia

infra/compose.yaml levanta postgres, rabbitmq, auth, payments, audit, bank-rail y web. Incluye roles y esquemas, .env.example y el smoke de login más transferencia interna.

## Criterios

- [x] Dado el portal levantado, cuando se ejerce esta capacidad, el sistema cumple: infra/compose.yaml levanta postgres, rabbitmq, auth, payments, audit, bank-rail y web. Incluye roles y esquemas, .env.example y el smoke de login más transferencia interna.
