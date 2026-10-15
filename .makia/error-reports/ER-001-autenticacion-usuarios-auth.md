# ER-001 — autenticacion-usuarios-auth

## Metadata
- **ER:** ER-001
- **Fecha de apertura:** 2026-10-15
- **Versión de MakIA en el proyecto:** v4.8.2
- **Etapa donde se disparó:** SPEC
- **Spec / Idea:** autenticacion-usuarios-auth
- **Tarea:** —
- **Rama:** makia/nuevo/autenticacion-usuarios-auth
- **Estado:** Abierto

## Evento disparador
- **Disparador primario:** D-14 — el USUARIO contradice una decision que draft.md daba por cerrada

## Causa raíz (clasificada)
- **Categoría:** CR-06 — toolchain de host no alineado con la constitucion

## Evidencia

Durante SPEC de `autenticacion-usuarios-auth`, el USUARIO confirmó la directriz de `.makia/config/constitution.md` (## Global, Configuración host): ambiente 100 % Docker; todo se compila y ejecuta en contenedores; no se instala nada en el host. El spec ya commiteado (`ce07b6c`, `a79408b`) define REQ-10 y las tareas con `npm ci`, `npm run lint/test/build` y `lefthook` en el host, y pruebas de base de datos con Testcontainers. `draft.md` de IDEA había cerrado ese toolchain en el host.

## Análisis

El USUARIO contradijo, ya iniciado SPEC, una decisión de toolchain que `draft.md` daba por cerrada. Disparador primario D-14. Causas: CR-06 (decisión de arquitectura/stack no alineada con la constitución) y CR-01 (REQ-10 y criterios de tareas exigen comandos en el host).

## Corrección aplicada

Se mantiene la constitución. SPEC se reabre para que compilación, ejecución y pruebas queden solo dentro de contenedores. No se reparte la descomposición.

## Cambio propuesto

IDEA, al cerrar el toolchain, debe contrastarlo con `constitution.md` ## Global antes de fijar comandos de host. SPEC debe tratar una directriz de constitución vigente como restricción de `design.md` y `tasks.md`, no como nota posterior.

## Transiciones de estado
| Fecha | De | A | Quién | Nota |
|---|---|---|---|---|
| 2026-10-15 | — | Abierto | Orquestador (`makia er open`) | Creación tras el evento |
