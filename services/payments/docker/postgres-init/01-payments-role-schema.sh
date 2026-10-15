#!/bin/sh
# Rol y esquema de payments para desarrollo y pruebas en Compose (solo este servicio).
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
REVOKE CREATE, USAGE ON SCHEMA public FROM PUBLIC;
REVOKE CONNECT ON DATABASE ${POSTGRES_DB} FROM PUBLIC;
CREATE ROLE payment_svc LOGIN PASSWORD '${PAYMENT_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO payment_svc;
CREATE SCHEMA payment_schema AUTHORIZATION payment_svc;
ALTER ROLE payment_svc IN DATABASE ${POSTGRES_DB} SET search_path = payment_schema;
EOSQL
