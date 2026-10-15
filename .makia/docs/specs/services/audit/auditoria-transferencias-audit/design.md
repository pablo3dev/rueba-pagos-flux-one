# Diseño: auditoria-transferencias-audit

## Estado

Implementado en el código actual de la unidad.

## Comportamiento

El servicio consume audit.transfer-events de forma idempotente, persiste en audit_schema y manda a DLQ lo que no puede guardar. GET /audit/transfers/{id}/events exige JWT y filtra por visibilidad.

## Límite

Los archivos de esta unidad viven dentro de su carpeta. El comando de ejecución es Docker Compose de esa unidad, o `docker compose --env-file infra/.env.example -f infra/compose.yaml up --build` para el entorno local.
