# ER-004 — autenticacion-usuarios-auth

## Metadata
- **ER:** ER-004
- **Fecha de apertura:** 2026-10-15
- **Versión de MakIA en el proyecto:** v4.8.2
- **Etapa donde se disparó:** IMPLEMENT
- **Spec / Idea:** autenticacion-usuarios-auth
- **Tarea:** —
- **Rama:** makia/dev/mini-portal-pagos
- **Estado:** Abierto

## Evento disparador
- **Disparador primario:** D-14 — el USUARIO contradice archivos de unidad en la raíz

## Causa raíz (clasificada)
- **Categoría:** CR-06 — tooling de raíz cerrado en draft.md

## Evidencia

El USUARIO, durante IMPLEMENT de `riel-bancario-simulado-bank-rail`, dijo que no se respetó la regla: se crearon archivos de las unidades de código fuera de su carpeta. El requisito es levantar todo con un comando de Docker, y ese comando y sus archivos también están dentro de la unidad. Nada por fuera.

`draft.md` había cerrado lo contrario: `autenticacion-usuarios-auth` incluye el tooling de la raíz (`package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitattributes`, `lefthook.yml`, y además quedaron `.npmrc`, `.dockerignore`, `.githooks/` y `package-lock.json`). El riel, en la tarea 1.2 (`c47181c`), modificó `package-lock.json` de la raíz.

## Análisis

Disparador D-14. Causas CR-06 y CR-10: la decisión de monorepo con archivos de la unidad en la raíz quedó cerrada en `draft.md` y el USUARIO la contradijo. Causa secundaria CR-02: `design.md` de auth y del riel declaran esos archivos fuera de la carpeta de la unidad.

## Corrección aplicada

Directriz `### Límite de la unidad` en `constitution.md` ## Global. IMPLEMENT del riel quedó detenido después de la tarea 2.1, antes de seguir tocando la raíz.

## Cambio propuesto

SPEC debe reubicar dentro de la carpeta de cada unidad todo archivo de esa unidad, incluido el Compose y el Dockerfile, y el comando de Docker se ejecuta ahí. El riel no vuelve a modificar `package-lock.json` de la raíz.

## Transiciones de estado
| Fecha | De | A | Quién | Nota |
|---|---|---|---|---|
| 2026-10-15 | — | Abierto | Orquestador (`makia er open`) | Creación tras el evento |
