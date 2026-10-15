# Viabilidad — Mini portal de pagos (mini-portal-pagos)

## Veredicto

**SÍ viable.**

## Justificación

1. **Alcance y stack:** Tres microservicios Node.js hexagonales (Auth, Pagos, Auditoría), riel bancario simulado como servicio Docker propio, frontend React, PostgreSQL con esquema por servicio, mensajería asíncrona sin pérdida y arranque con `docker compose up`. Matriz de versiones verificada por peers/engines en npm; tecnologías estables y compatibles entre sí a oct-2026.

2. **Reglas críticas en PROD:** Idempotencia concurrente con `INSERT ... ON CONFLICT DO NOTHING` sobre PK `(user, operación, clave)` en la misma transacción de negocio (la transacción concurrente espera el commit de la primera y luego ve el registro). Saldo nunca negativo: `UPDATE ... WHERE balance >= $1`, `CHECK (balance >= 0)` y bloqueo ordenado por id contra deadlocks. Dinero COP exacto: `NUMERIC(18,2)` en BD (ISO 4217 COP, minor unit 2), `bigint` de centavos en dominio, montos como string en JSON.

3. **Auditoría sin pérdida:** Transactional Outbox en `payment_schema`, relay por polling `FOR UPDATE SKIP LOCKED`, RabbitMQ con publisher confirms y quorum queues, consumidor idempotente por `event_id`. Si el broker cae, los eventos permanecen en outbox y se publican al volver.

4. **Riel no confiable:** Cuatro respuestas — 200 ACCEPTED, 422 REJECTED, 503 no procesado, sin respuesta en 10 s = desconocido — con estados explícitos (PENDING, COMPLETED, FAILED, UNKNOWN), fondos retenidos (débito al crear), reembolso en rechazo, reintento seguro de 503 y conciliación de UNKNOWN vía `GET /rail/transfers/{reference}` con reenvío idempotente por `reference`. El sistema siempre conoce el estado de cada transferencia.

5. **Plazo (prueba 3 h):** Mitigado por 13 unit-specs pequeños con orden y dependencias cerradas; Payment Links fuera de alcance.

## Evidencia

- **Node.js 24.22.0 LTS** — nodejs.org/en/blog/release. **TypeScript 6.0.3** obligatorio: typescript-eslint 8.71.2 exige peer `typescript >=4.8.4 <6.1.0` (registry.npmjs.org/typescript-eslint/latest); TS 7.0.2 (nativo Go) no expone `lib/typescript.js`.
- **Backend npm:** Fastify 5.12.7, pg 8.23.1, node-pg-migrate 9.0.0 (peer `pg >=4.3.0 <9.0.0`), jose 6.2.12, @node-rs/argon2 2.2.2 (prebuilt musl, OWASP m=19456 t=2 p=1), amqplib 2.2.0 (tipos nativos) — registry.npmjs.org.
- **Frontend npm:** React 19.3.1, Vite 8.3.4, @vitejs/plugin-react 6.1.2 (peer vite ^8), react-router 8.4.0, @tanstack/react-query 5.104.3, Vitest 5.0.5 (peer vite ^6.4||^7||^8, node ^24) — registry.npmjs.org.
- **Docker Hub:** `node:24.22.0-alpine`, `postgres:18.6-alpine` (PG18: volumen en `/var/lib/postgresql`), `rabbitmq:4.3.6-management-alpine`, `nginx:1.30.6-alpine`.
- **RabbitMQ vs Kafka:** RabbitMQ ~150–250 MB RAM, UI integrada, publisher confirms, quorum queues (Raft), DLX y `x-delivery-limit`; Kafka JVM ~0.5–1 GB, `kafkajs` abandonado (último 2.2.4, feb-2023), `@confluentinc/kafka-javascript` depende de librdkafka nativo — rabbitmq.com/docs/quorum-queues, rabbitmq.com/docs/dlx, docs.confluent.io.
- **Transactional Outbox:** microservices.io/patterns/data/transactional-outbox.html; Debezium CDC descartado (Kafka Connect); LISTEN/NOTIFY descartado (efímero).
- **Idempotency-Key:** draft-ietf-httpapi-idempotency-key-header-07 (400 sin clave, 409 en curso, 422 payload distinto); brandur.org/idempotency-keys; stripe.com/blog/idempotency; postgresql.org/docs/current/sql-insert.html.
- **Aislamiento por esquema:** rol por servicio con `CREATE SCHEMA ... AUTHORIZATION`, `REVOKE ... ON SCHEMA public FROM PUBLIC`; acceso ajeno falla SQLSTATE 42501 — postgresql.org/docs/current/ddl-schemas.html.
- **Estado del proyecto:** repo nuevo (sin package.json ni código), MakIA v4.8.2 instalado, constitución sin directrices; sin conflictos.
