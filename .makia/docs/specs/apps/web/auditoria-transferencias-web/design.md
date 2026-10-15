# Diseño: auditoria-transferencias-web

## Estado

Implementado en el código actual de la unidad.

## Comportamiento

La pantalla de la transferencia muestra la línea de tiempo de auditoría por polling. Nginx reenvía /api/audit/.

## Límite

Los archivos de esta unidad viven dentro de su carpeta. El comando de ejecución es Docker Compose de esa unidad, o `docker compose --env-file infra/.env.example -f infra/compose.yaml up --build` para el entorno local.
