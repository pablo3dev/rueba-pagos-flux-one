# Diseño: reversos-transferencias-payments

## Estado

Implementado en el código actual de la unidad.

## Comportamiento

Un cliente autenticado reversa una sola vez una transferencia COMPLETED. La interna se revierte en una transacción. La externa se coordina con el riel y concilia UNKNOWN. Idempotency-Key guarda la respuesta.

## Límite

Los archivos de esta unidad viven dentro de su carpeta. El comando de ejecución es Docker Compose de esa unidad, o `docker compose --env-file infra/.env.example -f infra/compose.yaml up --build` para el entorno local.
