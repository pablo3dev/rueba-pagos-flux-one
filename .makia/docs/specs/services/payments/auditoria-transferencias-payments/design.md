# Diseño: auditoria-transferencias-payments

## Estado

Implementado en el código actual de la unidad.

## Comportamiento

Cada cambio de estado de transferencia escribe un evento en el outbox dentro de la misma transacción. Un relay lo publica en RabbitMQ con confirms y reintento.

## Límite

Los archivos de esta unidad viven dentro de su carpeta. El comando de ejecución es Docker Compose de esa unidad, o `docker compose --env-file infra/.env.example -f infra/compose.yaml up --build` para el entorno local.
