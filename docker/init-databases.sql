-- Crea una base por microservicio.
-- Postgres solo ejecuta este script la primera vez, cuando el volumen está
-- vacío. Si ya tienes las bases creadas, no hace nada.

CREATE DATABASE auth_db;
CREATE DATABASE venues_events_db;
CREATE DATABASE purchases_db;
CREATE DATABASE tickets_db;
