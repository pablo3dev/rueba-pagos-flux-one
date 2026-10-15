# Diseño: transferencias-externas-web

## Estado

Implementado en el código actual de la unidad.

## Comportamiento

El formulario permite el tipo externo. PENDING y UNKNOWN se muestran como confirmando con el banco.

## Límite

Los archivos de esta unidad viven dentro de su carpeta. El comando de ejecución es Docker Compose de esa unidad, o `docker compose --env-file infra/.env.example -f infra/compose.yaml up --build` para el entorno local.
