# Diseño: entorno-local-infra

## Estado

Implementado en el código actual de la unidad.

## Comportamiento

infra/compose.yaml levanta postgres, rabbitmq, auth, payments, audit, bank-rail y web. Incluye roles y esquemas, .env.example y el smoke de login más transferencia interna.

## Límite

Los archivos de esta unidad viven dentro de su carpeta. El comando de ejecución es Docker Compose de esa unidad, o `docker compose --env-file infra/.env.example -f infra/compose.yaml up --build` para el entorno local.
