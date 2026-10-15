# Git — FluxOne-Payment

Este archivo no redefine la mecánica interna de sesión de MakIA (`session.md`). Documenta cómo la promoción a la rama principal se adapta a este repositorio.

## Integración de la promoción a la rama principal

- **Modo**: pull request.
- El DEPLOY abre un Pull Request desde `makia/dev/<idea-slug>` hacia `main`.
- El Pull Request debe estar aprobado antes de continuar la promoción.
- No hay push directo a `main` ni merge forzado.
- **Estrategia de merge del PR**: squash.

> **Seguridad:** ningún token, credencial o valor sensible se escribe aquí en texto plano — siempre `${NOMBRE_VARIABLE}` resuelto desde el entorno. Este archivo vive en `.makia/config/git.md` de cada proyecto — es específico del proyecto, nunca generado con contenido inventado por MakIA; el usuario lo crea/edita.
