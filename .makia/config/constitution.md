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

El Orquestador abre el Pull Request y lo mergea (`gh`) únicamente tras el aprobado explícito del USUARIO al DEPLOY. Con ese aprobado, ejecuta todo el resto (PR, merge con squash, tag/deploy según deploy.md) sin pedir más confirmaciones.

No hay push directo a `main`.

### Integración y conservación de ramas

- Cada rama de spec `makia/<tipo>/<spec-slug>` se integra en `makia/dev/<idea-slug>` por Pull Request (squash) que el Orquestador mergea directamente, sin aprobación del USUARIO. Esta excepción aplica solo a los PR de spec hacia la rama de idea; la promoción a `main` requiere el aprobado explícito del USUARIO al DEPLOY.
- No se eliminan ramas (locales ni remotas) ni worktrees de MakIA tras merge o PR; prevalece sobre los pasos de borrado de `session.md`.

> **Seguridad:** ningún token, credencial o valor sensible se escribe aquí en texto plano — siempre `${NOMBRE_VARIABLE}` resuelto desde el entorno. Este archivo vive en `.makia/config/constitution.md` de cada proyecto, se versiona, y nunca se genera con contenido inventado por MakIA.
