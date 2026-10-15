# ER-004 — riel-bancario-simulado-bank-rail

## Metadata
- **ER:** ER-004
- **Fecha de apertura:** 2026-10-15
- **Versión de MakIA en el proyecto:** v4.8.2
- **Etapa donde se disparó:** IMPLEMENT
- **Spec / Idea:** riel-bancario-simulado-bank-rail
- **Tarea:** 1.1
- **Rama:** makia/nuevo/riel-bancario-simulado-bank-rail
- **Estado:** Abierto

## Evento disparador
- **Disparador primario:** D-05 — limite de 2 correcciones en la tarea 1.1

## Causa raíz (clasificada)
- **Categoría:** CR-02 — criterio git safe.directory incompatible con worktree

## Evidencia

IMPLEMENT de `riel-bancario-simulado-bank-rail`, tarea 1.1. El Compose y el Dockerfile coinciden con `design.md` § 2.3. Node dentro del contenedor es v24.22.0. `config -q`, `node --version`, `git --version` y `down -v` salieron 0.

Falló el comando exacto del criterio, con `working_dir: /app`:

`git config --system --get-all safe.directory | grep -qx /app`

Salida: `fatal: not a git repository: (null)`, exit 1.

Con cwd `/`, el mismo `git config` imprime `/app` y sale 0. `/app/.git` es el gitfile del worktree: `gitdir: C:/repos/fluxone-payment/.git/worktrees/riel-bancario-simulado-bank-rail`.

Iteración 2: volumen anónimo `- /app/.git`. Docker no monta un directorio sobre el gitfile (`not a directory`). Compose restaurado al bloque exacto.

Los archivos `services/bank-rail/` quedaron sin commit.

## Análisis

Disparador primario D-05 (límite de 2 correcciones). Secundarios D-01, D-04 y D-09. Causa CR-02: el criterio y `working_dir: /app` no contemplan un gitfile de worktree con ruta Windows. CR-04: la tarea exige un comando que ese entorno no puede cumplir. CR-03 secundario: el contenido exacto de los archivos listados no alcanza para pasar el criterio en este worktree.

## Corrección aplicada

Ninguna en el spec. La tarea 1.1 no se marcó. No se siguió con 1.2–4.3.

## Cambio propuesto

SPEC debe ajustar el criterio de la tarea 1.1 y, si hace falta, `design.md` § 2.3, para comprobar `safe.directory` sin que `git` descubra el gitfile roto dentro de `/app`. El valor `/app` ya está en la config de sistema de la imagen.

## Transiciones de estado
| Fecha | De | A | Quién | Nota |
|---|---|---|---|---|
| 2026-10-15 | — | Abierto | Orquestador (`makia er open`) | Creación tras el evento |
