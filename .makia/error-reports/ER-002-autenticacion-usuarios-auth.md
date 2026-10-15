# ER-002 — autenticacion-usuarios-auth

## Metadata
- **ER:** ER-002
- **Fecha de apertura:** 2026-10-15
- **Versión de MakIA en el proyecto:** v4.8.2
- **Etapa donde se disparó:** IMPLEMENT
- **Spec / Idea:** autenticacion-usuarios-auth
- **Tarea:** 2.2
- **Rama:** makia/nuevo/autenticacion-usuarios-auth
- **Estado:** Abierto

## Evento disparador
- **Disparador primario:** D-07 — gap de learning.md en Argon2 y jose

## Causa raíz (clasificada)
- **Categoría:** CR-05 — dato faltante en learning.md

## Evidencia

IMPLEMENT, tarea 2.2 de `autenticacion-usuarios-auth`. `learning.md` §6 usa `Algorithm.Argon2id`. Con `verbatimModuleSyntax` el compilador falla con TS2748. CODE usó `algorithm: 2` con un comentario. En la tarea 3.3, `KeyLike` no existe en jose v6 y se cambió a `CryptoKey`. La puerta `makia verify --run` de esas tareas pasó. No hubo iteración de corrección.

## Análisis

Disparador D-07. Causa CR-05: `learning.md` no cubre la API real de Argon2 y de jose v6 bajo la configuración TypeScript del spec. CODE cerró el hueco en el código.

## Corrección aplicada

El código compiló y las pruebas de la tarea pasaron con `algorithm: 2` y `CryptoKey`. `learning.md` no se actualizó en este ciclo.

## Cambio propuesto

IDEA debe fijar en `learning.md` la forma importable de Argon2id con `verbatimModuleSyntax` y el tipo de llave de jose v6 (`CryptoKey`), para que CODE no tenga que descubrirlo.

## Transiciones de estado
| Fecha | De | A | Quién | Nota |
|---|---|---|---|---|
| 2026-10-15 | — | Abierto | Orquestador (`makia er open`) | Creación tras el evento |
