-- Roles y esquemas del portal. Corre una sola vez, con el directorio de datos vacío.
-- Las contraseñas salen del entorno del contenedor (psql \getenv); no se escriben aquí.
\getenv dbname POSTGRES_DB
\getenv auth_db_password AUTH_DB_PASSWORD
\getenv payment_db_password PAYMENT_DB_PASSWORD
\getenv audit_db_password AUDIT_DB_PASSWORD

REVOKE CREATE, USAGE ON SCHEMA public FROM PUBLIC;
REVOKE CONNECT ON DATABASE :"dbname" FROM PUBLIC;

CREATE ROLE auth_svc LOGIN PASSWORD :'auth_db_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE payment_svc LOGIN PASSWORD :'payment_db_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE audit_svc LOGIN PASSWORD :'audit_db_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

GRANT CONNECT ON DATABASE :"dbname" TO auth_svc;
GRANT CONNECT ON DATABASE :"dbname" TO payment_svc;
GRANT CONNECT ON DATABASE :"dbname" TO audit_svc;

CREATE SCHEMA auth_schema AUTHORIZATION auth_svc;
CREATE SCHEMA payment_schema AUTHORIZATION payment_svc;
CREATE SCHEMA audit_schema AUTHORIZATION audit_svc;

REVOKE ALL ON SCHEMA auth_schema FROM PUBLIC;
REVOKE ALL ON SCHEMA payment_schema FROM PUBLIC;
REVOKE ALL ON SCHEMA audit_schema FROM PUBLIC;

ALTER ROLE auth_svc IN DATABASE :"dbname" SET search_path = auth_schema;
ALTER ROLE payment_svc IN DATABASE :"dbname" SET search_path = payment_schema;
ALTER ROLE audit_svc IN DATABASE :"dbname" SET search_path = audit_schema;
