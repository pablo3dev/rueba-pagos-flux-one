# Constitución — FluxOne-Payment

Directrices de alto nivel del proyecto, escritas para el LLM de un agente: el "qué y por qué" (principios y decisiones) que guía todo el flujo IDEA → DEPLOY. No reemplaza `deploy.md`, `git.md` ni `test.md` (el "cómo" técnico): en su ámbito técnico estricto gana el `config/*.md` correspondiente; en negocio, arquitectura, UX, seguridad y estrategia gana este documento. Una contradicción real entre ambos se reporta al USUARIO, no se resuelve por inferencia.

Esta constitución tiene DOS ÁMBITOS pares, que pueden existir a la vez:

- `## Global`: lo que aplica a TODO el proyecto o a más de una unidad.
- `## Unidad: <ruta>`: lo que aplica SOLO a esa unidad (app, extension…). Una sección por cada unidad con directrices propias; la unidad hereda lo global y, si hay choque, prevalece la suya dentro de esa unidad.

Ubicación: ante cada directriz, decide su ámbito. Si aplica a una sola unidad, va en su `## Unidad`, no en Global. Si no es claro, pregunta al USUARIO. Un proyecto de una sola unidad puede tener solo Global; uno multi-unidad suele tener ambos. Cada agente lee solo `## Global` y la sección de su unidad. Los encabezados `## Global` y `## Unidad: <ruta>` son literales: no se renombran.

Los `###` de abajo son ejemplos de títulos, no una lista cerrada ni obligatoria: adáptalos al proyecto o unidad (renombra, agrega, quita, divide). Cada directriz va bajo un título específico de su tema; si ninguno encaja, crea uno nuevo. No existe sección "otros/varios".

Rellena SOLO lo que aplica y BORRA el resto. Nada se inventa para completar una sección. Si el archivo no existe, MakIA procede sin él.

## Global

Ámbito: todo el proyecto o más de una unidad.

### Configuración host

El ambiente del proyecto debe ser **100 % Docker** para que sea portable.

- Todo se compila dentro de contenedores.
- Todo se ejecuta dentro de contenedores.
- No se instala nada en el dispositivo host.

### Documentación

En la raíz del repositorio existe `docs/` como enlace simbólico que apunta a `.makia/docs/`.

### Promoción a main

El DEPLOY es un Pull Request hacia `main`.

Ese Pull Request debe estar aprobado.

No hay push directo a `main`.

### Arquitectura

- Arquitectura hexagonal en todo servicio.
- El dominio no depende de framework, DB, broker ni HTTP.

### Stack y versiones

- Node 24.22.0 + TypeScript 6.0.3, ESM, con npm workspaces.
- Versiones exactas (sin `^` ni `~`), fijadas en la sección de stack de cada `design.md` y en las matrices de cada spec.
- `.npmrc` raíz con `ignore-scripts=true`: las instalaciones npm no ejecutan scripts de ciclo de vida.

### Dinero

- Moneda: COP.
- DB: `numeric(18,2)`. Dominio: `bigint` de centavos. JSON: `string`. Nunca `float`.

### Idempotencia

- Toda operación monetaria con efecto exige `Idempotency-Key`, con ámbito (usuario, operación), evaluada en la misma transacción.

### Datos y eventos

- Cada servicio usa solo su propio esquema y su propio rol de DB; sin FK entre esquemas.
- Cada cambio de estado publica un evento vía Transactional Outbox.
- Los consumidores son idempotentes por `eventId`.

### Logs

- Logs en JSON con `correlationId`.
- Nunca se registran secretos, tokens ni contraseñas.

### Exclusiones y formato de archivos

- `.makia/`, `.claude/`, `.cursor/` y `.agents/` quedan fuera de ESLint, Prettier y Docker.
- Saltos de línea LF en todo el repositorio.

## Unidad: services/auth

Ámbito: solo `services/auth`.

### Ejecución en contenedores

- Todo comando de compilación, prueba y ejecución corre en contenedores con `docker compose -f services/auth/compose.dev.yaml` (servicio `dev`).
- La DB de pruebas es el servicio `postgres` de ese Compose.

### Modelo de dominio

- El modelo de dominio de esta unidad vive en `.makia/docs/specs/services/auth/domain-model.md` (Contexto Delimitado de Identidad).

> **Seguridad:** ningún token, credencial o valor sensible se escribe aquí en texto plano — siempre `${NOMBRE_VARIABLE}` resuelto desde el entorno. Este archivo vive en `.makia/config/constitution.md` de cada proyecto, se versiona, y nunca se genera con contenido inventado por MakIA.
