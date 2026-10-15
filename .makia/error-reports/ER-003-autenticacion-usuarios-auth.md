# ER-003 — autenticacion-usuarios-auth

## Metadata
- **ER:** ER-003
- **Fecha de apertura:** 2026-10-15
- **Versión de MakIA en el proyecto:** v4.8.2
- **Etapa donde se disparó:** IMPLEMENT
- **Spec / Idea:** autenticacion-usuarios-auth
- **Tarea:** 3.3
- **Rama:** makia/nuevo/autenticacion-usuarios-auth
- **Estado:** Abierto

## Evento disparador
- **Disparador primario:** D-09 — archivos no listados en tasks.md

## Causa raíz (clasificada)
- **Categoría:** CR-03 — tabla de archivos incompleta

## Evidencia

IMPLEMENT, tarea 3.3 de `autenticacion-usuarios-auth`. `app.ts` no está en la lista de archivos de esa tarea y CODE lo modificó (3 líneas) para cablear `refreshSession`, `logoutSession` y `getProfile`. En la tarea 3.2 se tocó `error-handler.ts`, que tampoco figura en esa tarea. La puerta de verificación pasó.

En la tarea 3.2, las opciones por defecto de Ajv en Fastify eliminaban campos extra y coaccionaban tipos, en contra del 400 de AC-AUT-04 y AC-AUT-10. CODE añadió `ajv.customOptions` con `removeAdditional: false` y `coerceTypes: false`. `design.md` no lo declara.

## Análisis

Disparador primario D-09, causa CR-03: la tabla de archivos de `design.md` / `tasks.md` no incluye `app.ts` ni `error-handler.ts` donde el código tuvo que cambiar. Causa secundaria CR-02: el contrato de validación HTTP (Ajv) quedó implícito.

## Corrección aplicada

El cableado y las opciones de Ajv quedaron en el código y las pruebas de aceptación pasaron. El spec no se actualizó.

## Cambio propuesto

SPEC debe listar en la tabla de archivos de la tarea que compone las rutas cada módulo que esa composición modifica, y debe declarar en `design.md` las opciones de Ajv que el contrato HTTP exige.

## Transiciones de estado
| Fecha | De | A | Quién | Nota |
|---|---|---|---|---|
| 2026-10-15 | — | Abierto | Orquestador (`makia er open`) | Creación tras el evento |
