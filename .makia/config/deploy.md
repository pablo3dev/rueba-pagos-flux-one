# Deploy — FluxOne-Payment

## Promoción a main

El DEPLOY es un Pull Request a `main` aprobado.

- El Pull Request sale de `makia/dev/<idea-slug>` hacia `main`.
- No hay push directo a `main`.
- El Pull Request debe estar aprobado. No se fuerza el merge.

> **Seguridad:** usar siempre variables de entorno para tokens, keys, passwords, etc. — nunca valores en texto plano dentro de este archivo. Ningún valor real de secreto se escribe aquí: siempre `${NOMBRE_VARIABLE}` resuelto desde el entorno donde corre DEPLOY. Este archivo vive en `.makia/config/deploy.md` de cada proyecto — es específico del proyecto, nunca generado con contenido inventado por MakIA; el usuario lo crea/edita.
