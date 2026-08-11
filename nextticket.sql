-- ============================================================
-- Schema: nextticket  (v12 — CANVAS + GEOMETRY + FISCAL + TRANSFERS)
-- Sistema de Eventos y Boletos — PostgreSQL Forward Engineering
-- Adaptado desde el original MySQL 8.0, sin alterar lógica ni modelo de datos.
-- ============================================================
--
-- NOTAS DE ADAPTACIÓN MySQL → PostgreSQL (léase antes de ejecutar):
--
--  • BINARY(16)               → UUID. Los IDs se siguen generando en el backend
--                                (no se agrega DEFAULT gen_random_uuid()), exactamente
--                                igual que en el original: ninguna columna id tenía DEFAULT.
--  • DATETIME(6)               → TIMESTAMP(6) SIN zona horaria (no TIMESTAMPTZ), porque
--                                DATETIME en MySQL tampoco hace conversión de zona horaria.
--  • BIT(1)                    → BOOLEAN (semántica idéntica: b'0'/b'1' ya eran flags booleanos).
--  • ENUM(...) inline           → un tipo ENUM nombrado por columna (CREATE TYPE ... AS ENUM),
--                                para no acoplar columnas que en MySQL eran independientes
--                                aunque compartieran los mismos valores.
--  • INT UNSIGNED               → INTEGER + CHECK (col >= 0).
--  • TINYINT UNSIGNED           → SMALLINT + CHECK (col BETWEEN 0 AND 255), preservando el
--                                rango real 0-255 de TINYINT UNSIGNED (no solo el signo).
--  • JSON                       → JSONB (equivalente funcional, indexable, forma recomendada
--                                en Postgres).
--  • JSON_TYPE(x) = 'ARRAY'     → jsonb_typeof(x) = 'array'.
--  • INDEX / UNIQUE INDEX
--    inline en CREATE TABLE     → CREATE INDEX / CREATE UNIQUE INDEX separados justo después
--                                de cada tabla (Postgres no soporta INDEX inline en CREATE TABLE).
--  • Índices únicos condicionales
--    vía IF(...) de MySQL       → índices ÚNICOS PARCIALES (CREATE UNIQUE INDEX ... WHERE ...).
--                                Es la forma idiomática y EXACTA de expresar "único solo entre
--                                las filas que cumplen la condición" en Postgres; el resultado
--                                de la restricción es idéntico al truco IF(...,col,NULL) de MySQL.
--  • Dos excepciones: `uk_ezs_zone_section` (event_zone_sections) y `uk_seats_section_id_id`
--    (seats) se definieron como CONSTRAINT UNIQUE de tabla (no solo índice), porque Postgres
--    exige que el destino de una FOREIGN KEY sea una UNIQUE/PRIMARY KEY *constraint*, no un
--    índice único cualquiera — y ambas son el destino de una FK compuesta (event_seats).
--  • ENGINE=InnoDB, CHARACTER SET,
--    COLLATE                    → eliminados (no aplican; el encoding de Postgres se fija a
--                                nivel de base de datos, normalmente UTF8 por defecto).
--  • SET FOREIGN_KEY_CHECKS=0   → Postgres NO permite crear una FK hacia una tabla que aún no
--    (el original lo usaba       existe, ni siquiera dentro de una transacción. El script
--    para 2 referencias          original dependía de esto para 2 referencias hacia adelante:
--    hacia adelante)               1) promo_code_usages.fk_pcu_purchase → purchases (definida después)
--                                   2) payments.fk_payments_transfer    → ticket_transfers (definida después)
--                                Ambas FKs se agregan aquí con ALTER TABLE justo después de que
--                                la tabla referenciada ya exista. El orden de las tablas y el
--                                resto de la lógica permanece idéntico al original.
--
-- Dos errores de SINTAXIS del script MySQL original fueron corregidos (no son cambios de
-- modelo, el original no habría podido ejecutarse tal cual):
--   1) Tabla `events`: faltaba una coma entre el CHECK `chk_events_valid_window` y el
--      CONSTRAINT `fk_events_organizer` que le seguía.
--   2) Tabla `venues`: había una coma sobrante después del último INDEX, justo antes del
--      paréntesis de cierre. (Este problema desaparece de forma natural aquí, porque todos
--      los INDEX se movieron fuera del CREATE TABLE, como se explica arriba.)
--
-- ⚠ Nota sobre el MODELO (no corregida, solo señalada — ver mensaje aparte):
--   Los comentarios del módulo CANVAS ([C3] y [C5]) describen `section_geometry_points` y
--   `canvas_element_geometry_points` como tablas relacionales que reemplazan el JSON de
--   puntos ("en lugar de JSON, que rompe 1NF..."), pero el script original NUNCA contiene el
--   CREATE TABLE de esas dos tablas — solo el bloque de comentario. Mientras tanto,
--   `sections.geometry_points` y `canvas_elements.geometry_points` sí quedaron como columnas
--   JSON. Se preserva EXACTAMENTE así (no se inventan las tablas faltantes) para no alterar
--   el modelo; queda documentado para que lo resuelvas tú.
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS nextticket;


-- ═══════════════════════════════════════════════════════════
-- MODULE: SECURITY  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nextticket.roles (
  id               UUID         NOT NULL,
  created_at       TIMESTAMP(6) NOT NULL,
  created_by       UUID         NULL DEFAULT NULL,
  last_modified_by UUID         NULL DEFAULT NULL,
  status           BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMP(6) NULL DEFAULT NULL,
  name             VARCHAR(50)  NOT NULL,
  description      VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX uk_roles_name ON nextticket.roles (name);

CREATE TABLE IF NOT EXISTS nextticket.permissions (
  id               UUID         NOT NULL,
  created_at       TIMESTAMP(6) NOT NULL,
  created_by       UUID         NULL DEFAULT NULL,
  last_modified_by UUID         NULL DEFAULT NULL,
  status           BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMP(6) NULL DEFAULT NULL,
  name             VARCHAR(60)  NOT NULL,
  resource         VARCHAR(40)  NOT NULL,
  description      VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE UNIQUE INDEX uk_permissions_name  ON nextticket.permissions (name);
CREATE INDEX        idx_permissions_resource ON nextticket.permissions (resource);

CREATE TABLE IF NOT EXISTS nextticket.role_permissions (
  id            UUID NOT NULL,
  role_id       UUID NOT NULL,
  permission_id UUID NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_rp_role
    FOREIGN KEY (role_id)       REFERENCES nextticket.roles (id),
  CONSTRAINT fk_rp_permission
    FOREIGN KEY (permission_id) REFERENCES nextticket.permissions (id)
);

CREATE UNIQUE INDEX uk_role_permissions ON nextticket.role_permissions (role_id, permission_id);
CREATE INDEX        idx_rp_role         ON nextticket.role_permissions (role_id);
CREATE INDEX        idx_rp_permission   ON nextticket.role_permissions (permission_id);

CREATE TABLE IF NOT EXISTS nextticket.users (
  id               UUID         NOT NULL,
  created_at       TIMESTAMP(6) NOT NULL,
  created_by       UUID         NULL DEFAULT NULL,
  last_modified_by UUID         NULL DEFAULT NULL,
  status           BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMP(6) NULL DEFAULT NULL,
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  password         VARCHAR(255) NOT NULL,
  role_id          UUID         NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES nextticket.roles (id)
);

CREATE UNIQUE INDEX uk_users_email  ON nextticket.users (email);
CREATE INDEX        idx_users_status ON nextticket.users (status);
CREATE INDEX        idx_users_role   ON nextticket.users (role_id);


-- ═══════════════════════════════════════════════════════════
-- MODULE: CONFIGURATION + CANVAS
-- ═══════════════════════════════════════════════════════════

-- -----------------------------------------------------
-- Table nextticket.venues  (sin cambios vs v11)
-- -----------------------------------------------------
CREATE TYPE nextticket.venue_status_enum AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'REMOVED');

CREATE TABLE IF NOT EXISTS nextticket.venues (
  id               UUID          NOT NULL,
  created_at       TIMESTAMP(6)  NOT NULL,
  created_by       UUID          NULL DEFAULT NULL,
  last_modified_by UUID          NULL DEFAULT NULL,
  updated_at       TIMESTAMP(6)  NULL DEFAULT NULL,
  name             VARCHAR(150)  NOT NULL,
  address          VARCHAR(255)  NOT NULL,
  city             VARCHAR(100)  NOT NULL,
  state            VARCHAR(100)  NULL DEFAULT NULL,
  country          VARCHAR(100)  NOT NULL DEFAULT 'Mexico',
  total_capacity   INTEGER       NOT NULL,
  description      VARCHAR(500)  NULL DEFAULT NULL,
  status           nextticket.venue_status_enum NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (id),
  CONSTRAINT chk_venues_total_capacity_unsigned CHECK (total_capacity >= 0)
);

CREATE UNIQUE INDEX uk_venues_name_city ON nextticket.venues (name, city);
CREATE INDEX        idx_venues_status   ON nextticket.venues (status);


-- -----------------------------------------------------
-- Table nextticket.floors  [C1] NUEVA
-- Representa las capas de renderizado del recinto:
-- "Planta Baja" (level_index=0), "Balcón" (level_index=1), etc.
-- level_index es el z-order para el editor de mapa.
-- UNIQUE (venue_id, level_index): sin pisos duplicados por recinto.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS nextticket.floors (
  id          UUID         NOT NULL,
  venue_id    UUID         NOT NULL,
  name        VARCHAR(100) NOT NULL,             -- "Planta Baja", "Balcón Superior"
  level_index INTEGER      NOT NULL,             -- z-order del canvas: 0, 1, 2...
  PRIMARY KEY (id),
  CONSTRAINT fk_floors_venue
    FOREIGN KEY (venue_id) REFERENCES nextticket.venues (id)
);

CREATE UNIQUE INDEX uk_floors_venue_level ON nextticket.floors (venue_id, level_index);
CREATE INDEX        idx_floors_venue      ON nextticket.floors (venue_id);


-- -----------------------------------------------------
-- Table nextticket.sections  [C2] MODIFICADA
-- Añade geometría de renderizado del editor:
--   floor_id         → piso al que pertenece (para renderizado en capa correcta)
--   color            → color de relleno en el canvas (#RRGGBB)
--   prefix           → código visual del editor ("ZON-01", "SEC-A")
--   coordinate_x/y   → posición del centroide en el canvas
--   width / height   → dimensiones del bounding box
--   rotation_degrees → rotación en grados
--   is_ellipse       → TRUE = figura circular/elíptica, FALSE = polígono
--
-- Regla de negocio: section.floor.venue_id = section.venue_id
-- No enforzable con FK (ni en MySQL ni en Postgres); validado en backend al crear la sección.
-- -----------------------------------------------------
CREATE TYPE nextticket.section_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED');

CREATE TABLE IF NOT EXISTS nextticket.sections (
  id                UUID          NOT NULL,
  venue_id          UUID          NOT NULL,
  floor_id          UUID          NOT NULL,            -- [C2] piso de renderizado
  name              VARCHAR(100)  NOT NULL,
  description       VARCHAR(255)  NULL DEFAULT NULL,
  capacity          INTEGER       NOT NULL,
  status            nextticket.section_status_enum NOT NULL DEFAULT 'ACTIVE',
  -- Geometría del editor [C2]
  color             VARCHAR(7)    NULL DEFAULT NULL,   -- p.ej. '#0485F7'
  prefix            VARCHAR(20)   NULL DEFAULT NULL,   -- p.ej. 'ZON-01'
  coordinate_x      INTEGER       NULL DEFAULT NULL,   -- posición X en el canvas
  coordinate_y      INTEGER       NULL DEFAULT NULL,   -- posición Y en el canvas
  width             INTEGER       NULL DEFAULT NULL,   -- ancho del bounding box
  height            INTEGER       NULL DEFAULT NULL,   -- alto del bounding box
  rotation_degrees  DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  is_ellipse        BOOLEAN       NOT NULL DEFAULT FALSE, -- false=polígono, true=elipse/círculo
  geometry_points   JSONB         NULL DEFAULT NULL,     -- array de {x,y,control_x,control_y}; NULL si is_ellipse=true
  PRIMARY KEY (id),
  CONSTRAINT fk_sections_venue
    FOREIGN KEY (venue_id) REFERENCES nextticket.venues (id),
  CONSTRAINT fk_sections_floor
    FOREIGN KEY (floor_id) REFERENCES nextticket.floors (id),
  CONSTRAINT chk_sections_capacity_unsigned
    CHECK (capacity >= 0),
  CONSTRAINT chk_sections_geometry_points_is_array
    CHECK (geometry_points IS NULL OR jsonb_typeof(geometry_points) = 'array')
);

CREATE UNIQUE INDEX uk_sections_venue_name ON nextticket.sections (venue_id, name);
CREATE INDEX        idx_sections_venue     ON nextticket.sections (venue_id);
CREATE INDEX        idx_sections_floor     ON nextticket.sections (floor_id);
CREATE INDEX        idx_sections_status    ON nextticket.sections (status);


-- -----------------------------------------------------
-- Table nextticket.section_geometry_points  [C3] NUEVA (comentada en el original)
-- El script MySQL original solo documenta esta tabla en comentario, nunca la crea con
-- CREATE TABLE. Se preserva tal cual: no se agrega aquí. Ver nota sobre el MODELO arriba.
-- -----------------------------------------------------


-- -----------------------------------------------------
-- Table nextticket.seats  (sin cambios vs v11)
-- Los asientos siguen vinculados a section_id (agrupación lógica).
-- El piso de renderizado se obtiene por section → floor.
-- -----------------------------------------------------
CREATE TYPE nextticket.seat_type_enum   AS ENUM ('STANDARD', 'VIP', 'PREMIUM', 'ACCESSIBLE');
CREATE TYPE nextticket.seat_status_enum AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'OUT_OF_SERVICE', 'REMOVED');

CREATE TABLE IF NOT EXISTS nextticket.seats (
  id           UUID        NOT NULL,
  section_id   UUID        NOT NULL,
  "row"        VARCHAR(10) NOT NULL,
  number       VARCHAR(10) NOT NULL,
  type         nextticket.seat_type_enum   NOT NULL DEFAULT 'STANDARD',
  coordinate_x INTEGER     NULL DEFAULT NULL,
  coordinate_y INTEGER     NULL DEFAULT NULL,
  status       nextticket.seat_status_enum NOT NULL DEFAULT 'AVAILABLE',
  PRIMARY KEY (id),
  -- CONSTRAINT (no solo índice): event_seats la referencia con una FK compuesta,
  -- y Postgres exige que el destino de una FK sea una UNIQUE/PK constraint.
  CONSTRAINT uk_seats_section_id_id UNIQUE (section_id, id),
  CONSTRAINT fk_seats_section
    FOREIGN KEY (section_id) REFERENCES nextticket.sections (id)
);

CREATE UNIQUE INDEX uk_seats_section_row_number ON nextticket.seats (section_id, "row", number);
CREATE INDEX        idx_seats_status            ON nextticket.seats (status);


-- -----------------------------------------------------
-- Table nextticket.canvas_elements  [C4] NUEVA
-- Obstáculos y referencias visuales del canvas del editor.
-- Escenarios, bocinas, entradas, salidas, baños, textos, formas, etc.
-- Son entidades puramente visuales: sin precio, sin capacidad, sin estado de reserva.
--
-- name: el label del JSON del editor ("Elemento 1", "Escenario Principal").
-- color: color de relleno en el canvas (#RRGGBB).
-- is_ellipse: misma semántica que en sections.
--
-- Se descarta render_config JSON: los campos estructurados cubren todo lo que el editor
-- necesita, son indexables y no rompen 1NF.
-- -----------------------------------------------------
CREATE TYPE nextticket.canvas_element_type_enum AS ENUM (
  'STAGE', 'SCREEN', 'SPEAKER',
  'ENTRANCE', 'EXIT', 'CORRIDOR',
  'BATHROOM', 'BAR', 'TEXT',
  'SHAPE', 'CUSTOM'
);

CREATE TABLE IF NOT EXISTS nextticket.canvas_elements (
  id               UUID          NOT NULL,
  floor_id         UUID          NOT NULL,
  element_type     nextticket.canvas_element_type_enum NOT NULL,
  name             VARCHAR(150)  NOT NULL,             -- label del editor
  status           BOOLEAN       NOT NULL DEFAULT TRUE, -- false=INACTIVE, true=ACTIVE
  color            VARCHAR(7)    NULL DEFAULT NULL,    -- color de relleno '#3a3a3a'
  coordinate_x     INTEGER       NOT NULL,
  coordinate_y     INTEGER       NOT NULL,
  width            INTEGER       NULL DEFAULT NULL,
  height           INTEGER       NULL DEFAULT NULL,
  rotation_degrees DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  is_ellipse       BOOLEAN       NOT NULL DEFAULT FALSE, -- false=polígono, true=elipse
  geometry_points  JSONB         NULL DEFAULT NULL,    -- array de {x,y,control_x,control_y}; misma semántica que en sections

  PRIMARY KEY (id),
  CONSTRAINT fk_ce_floor
    FOREIGN KEY (floor_id) REFERENCES nextticket.floors (id),
  CONSTRAINT chk_ce_positive_dimensions
    CHECK (
      (width  IS NULL OR width  > 0) AND
      (height IS NULL OR height > 0)
    ),
  CONSTRAINT chk_ce_geometry_points_is_array
    CHECK (geometry_points IS NULL OR jsonb_typeof(geometry_points) = 'array')
);

CREATE INDEX idx_ce_floor        ON nextticket.canvas_elements (floor_id);
CREATE INDEX idx_ce_element_type ON nextticket.canvas_elements (element_type);
CREATE INDEX idx_ce_status       ON nextticket.canvas_elements (status);


-- -----------------------------------------------------
-- Table nextticket.canvas_element_geometry_points  [C5] NUEVA (comentada en el original)
-- Igual que section_geometry_points: solo existe como bloque de comentario en el script
-- MySQL original, nunca se emite el CREATE TABLE. Se preserva tal cual.
-- -----------------------------------------------------


-- ═══════════════════════════════════════════════════════════
-- MODULE: OPERATION  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TYPE nextticket.event_status_enum AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELED', 'SOLD_OUT', 'COMPLETED');

CREATE TABLE IF NOT EXISTS nextticket.events (
  id               UUID          NOT NULL,
  created_at       TIMESTAMP(6)  NOT NULL,
  created_by       UUID          NULL DEFAULT NULL,
  last_modified_by UUID          NULL DEFAULT NULL,
  updated_at       TIMESTAMP(6)  NULL DEFAULT NULL,
  venue_id         UUID          NOT NULL,
  organizer_id     UUID          NOT NULL,
  name             VARCHAR(200)  NOT NULL,
  starts_at        TIMESTAMP(6)  NOT NULL,             -- antes event_datetime
  ends_at          TIMESTAMP(6)  NOT NULL,
  image_url        VARCHAR(500)  NULL DEFAULT NULL,
  description      VARCHAR(1000) NULL DEFAULT NULL,
  status           nextticket.event_status_enum NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (id),
  CONSTRAINT fk_events_venue
    FOREIGN KEY (venue_id)     REFERENCES nextticket.venues (id),
  CONSTRAINT fk_events_organizer
    FOREIGN KEY (organizer_id) REFERENCES nextticket.users (id),
  CONSTRAINT chk_events_valid_window
    CHECK (ends_at IS NULL OR starts_at < ends_at)
);

CREATE INDEX idx_events_venue     ON nextticket.events (venue_id);
CREATE INDEX idx_events_organizer ON nextticket.events (organizer_id);
CREATE INDEX idx_events_status    ON nextticket.events (status);
CREATE INDEX idx_events_starts_at ON nextticket.events (starts_at); -- antes idx_events_datetime

CREATE TYPE nextticket.event_zone_admission_type_enum AS ENUM ('RESERVED', 'GENERAL');
CREATE TYPE nextticket.event_zone_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD_OUT');

CREATE TABLE IF NOT EXISTS nextticket.event_zones (
  id                       UUID          NOT NULL,
  created_at               TIMESTAMP(6)  NOT NULL,
  created_by               UUID          NULL DEFAULT NULL,
  last_modified_by         UUID          NULL DEFAULT NULL,
  updated_at               TIMESTAMP(6)  NULL DEFAULT NULL,
  event_id                 UUID          NOT NULL,
  public_name              VARCHAR(100)  NOT NULL,
  admission_type           nextticket.event_zone_admission_type_enum NOT NULL DEFAULT 'RESERVED',
  event_price              DECIMAL(11,2) NOT NULL,
  available_capacity       INTEGER       NOT NULL,
  map_color                VARCHAR(7)    NULL DEFAULT NULL,
  max_tickets_per_purchase SMALLINT      NOT NULL DEFAULT 10,
  status                   nextticket.event_zone_status_enum NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (id),
  CONSTRAINT fk_event_zones_event
    FOREIGN KEY (event_id) REFERENCES nextticket.events (id),
  CONSTRAINT chk_event_zone_positive_price
    CHECK (event_price >= 0),
  CONSTRAINT chk_event_zones_available_capacity_unsigned
    CHECK (available_capacity >= 0),
  CONSTRAINT chk_event_zones_max_tickets_tinyint_unsigned
    CHECK (max_tickets_per_purchase BETWEEN 0 AND 255)
);

CREATE INDEX idx_event_zones_event          ON nextticket.event_zones (event_id);
CREATE INDEX idx_event_zones_admission_type ON nextticket.event_zones (admission_type);
CREATE INDEX idx_event_zones_status         ON nextticket.event_zones (status);

CREATE TYPE nextticket.price_tier_status_enum AS ENUM ('PENDING', 'ACTIVE', 'EXHAUSTED', 'CLOSED');

CREATE TABLE IF NOT EXISTS nextticket.event_zone_price_tiers (
  id                  UUID          NOT NULL,
  created_at          TIMESTAMP(6)  NOT NULL,
  created_by          UUID          NULL DEFAULT NULL,
  last_modified_by    UUID          NULL DEFAULT NULL,
  updated_at          TIMESTAMP(6)  NULL DEFAULT NULL,
  event_zone_id       UUID          NOT NULL,
  name                VARCHAR(100)  NOT NULL,
  price               DECIMAL(11,2) NOT NULL,
  initial_capacity    INTEGER       NULL DEFAULT NULL,
  available_capacity  INTEGER       NULL DEFAULT NULL,
  starts_at           TIMESTAMP(6)  NULL DEFAULT NULL,
  ends_at             TIMESTAMP(6)  NULL DEFAULT NULL,
  sort_order          SMALLINT      NOT NULL DEFAULT 0,
  status              nextticket.price_tier_status_enum NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (id),
  CONSTRAINT fk_price_tiers_event_zone
    FOREIGN KEY (event_zone_id) REFERENCES nextticket.event_zones (id),
  CONSTRAINT chk_price_tier_positive
    CHECK (price >= 0),
  CONSTRAINT chk_price_tier_dates
    CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at),
  CONSTRAINT chk_price_tiers_initial_capacity_unsigned
    CHECK (initial_capacity IS NULL OR initial_capacity >= 0),
  CONSTRAINT chk_price_tiers_available_capacity_unsigned
    CHECK (available_capacity IS NULL OR available_capacity >= 0),
  CONSTRAINT chk_price_tiers_sort_order_tinyint_unsigned
    CHECK (sort_order BETWEEN 0 AND 255)
);

CREATE UNIQUE INDEX uk_price_tiers_zone_order ON nextticket.event_zone_price_tiers (event_zone_id, sort_order);
CREATE INDEX        idx_price_tiers_zone      ON nextticket.event_zone_price_tiers (event_zone_id);
CREATE INDEX        idx_price_tiers_status    ON nextticket.event_zone_price_tiers (status);

CREATE TABLE IF NOT EXISTS nextticket.event_zone_sections (
  id            UUID NOT NULL,
  event_zone_id UUID NOT NULL,
  event_id      UUID NOT NULL,
  section_id    UUID NOT NULL,
  PRIMARY KEY (id),
  -- CONSTRAINT (no solo índice): event_seats la referencia con una FK compuesta,
  -- y Postgres exige que el destino de una FK sea una UNIQUE/PK constraint.
  CONSTRAINT uk_ezs_zone_section UNIQUE (event_zone_id, section_id),
  CONSTRAINT fk_ezs_event_zone
    FOREIGN KEY (event_zone_id) REFERENCES nextticket.event_zones (id),
  CONSTRAINT fk_ezs_event
    FOREIGN KEY (event_id)      REFERENCES nextticket.events (id),
  CONSTRAINT fk_ezs_section
    FOREIGN KEY (section_id)    REFERENCES nextticket.sections (id)
);

CREATE UNIQUE INDEX uk_ezs_event_section ON nextticket.event_zone_sections (event_id, section_id);
CREATE INDEX        idx_ezs_event_zone   ON nextticket.event_zone_sections (event_zone_id);
CREATE INDEX        idx_ezs_section      ON nextticket.event_zone_sections (section_id);

CREATE TYPE nextticket.event_seat_status_enum AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'DISABLED');

CREATE TABLE IF NOT EXISTS nextticket.event_seats (
  id            UUID         NOT NULL,
  event_zone_id UUID         NOT NULL,
  seat_id       UUID         NOT NULL,
  section_id    UUID         NOT NULL,
  locked_until  TIMESTAMP(6) NULL DEFAULT NULL,
  status        nextticket.event_seat_status_enum NOT NULL DEFAULT 'AVAILABLE',
  PRIMARY KEY (id),
  CONSTRAINT fk_event_seats_zone_section
    FOREIGN KEY (event_zone_id, section_id)
    REFERENCES nextticket.event_zone_sections (event_zone_id, section_id),
  CONSTRAINT fk_event_seats_seat_section
    FOREIGN KEY (section_id, seat_id)
    REFERENCES nextticket.seats (section_id, id)
);

CREATE UNIQUE INDEX uk_event_seats_zone_seat  ON nextticket.event_seats (event_zone_id, seat_id);
CREATE INDEX        idx_event_seats_event_zone   ON nextticket.event_seats (event_zone_id);
CREATE INDEX        idx_event_seats_section       ON nextticket.event_seats (section_id);
CREATE INDEX        idx_event_seats_status        ON nextticket.event_seats (status);
CREATE INDEX        idx_event_seats_locked_until  ON nextticket.event_seats (locked_until);

-- -----------------------------------------------------
-- Table `nextticket`.`event_categories`
-- Catálogo reutilizable de categorías comerciales.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nextticket`.`event_categories` (
  `id`          BINARY(16)    NOT NULL,
  `created_at`  DATETIME(6)   NOT NULL,
  `updated_at`  DATETIME(6)   NULL DEFAULT NULL,
  `name`        VARCHAR(100)  NOT NULL,
  `slug`        VARCHAR(120)  NOT NULL,
  `description` VARCHAR(255)  NULL DEFAULT NULL,
  `status`      ENUM('ACTIVE', 'INACTIVE', 'REMOVED')
                NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_event_categories_name` (`name` ASC) VISIBLE,
  UNIQUE INDEX `uk_event_categories_slug` (`slug` ASC) VISIBLE,
  INDEX `idx_event_categories_status` (`status` ASC) VISIBLE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `nextticket`.`event_category_assignments`
-- Relación muchos a muchos entre eventos y categorías.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nextticket`.`event_category_assignments` (
  `id`          BINARY(16) NOT NULL,
  `event_id`    BINARY(16) NOT NULL,
  `category_id` BINARY(16) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_event_category_assignment`
    (`event_id` ASC, `category_id` ASC) VISIBLE,
  INDEX `idx_eca_event` (`event_id` ASC) VISIBLE,
  INDEX `idx_eca_category` (`category_id` ASC) VISIBLE,
  CONSTRAINT `fk_eca_event`
    FOREIGN KEY (`event_id`)
    REFERENCES `nextticket`.`events` (`id`),
  CONSTRAINT `fk_eca_category`
    FOREIGN KEY (`category_id`)
    REFERENCES `nextticket`.`event_categories` (`id`)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;


-- ═══════════════════════════════════════════════════════════
-- MODULE: PROMOTIONS  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TYPE nextticket.promo_discount_type_enum AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE nextticket.promo_code_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'EXHAUSTED', 'EXPIRED');

CREATE TABLE IF NOT EXISTS nextticket.promo_codes (
  id                  UUID          NOT NULL,
  created_at          TIMESTAMP(6)  NOT NULL,
  created_by          UUID          NULL DEFAULT NULL,
  last_modified_by    UUID          NULL DEFAULT NULL,
  updated_at          TIMESTAMP(6)  NULL DEFAULT NULL,
  event_id            UUID          NOT NULL,
  applicable_zone_id  UUID          NULL DEFAULT NULL,
  code                VARCHAR(30)   NOT NULL,
  discount_type       nextticket.promo_discount_type_enum NOT NULL,
  discount_value      DECIMAL(11,2) NOT NULL,
  max_uses_total      INTEGER       NULL DEFAULT NULL,
  max_uses_per_user   SMALLINT      NOT NULL DEFAULT 1,
  min_purchase_total  DECIMAL(11,2) NOT NULL DEFAULT 0.00,
  starts_at           TIMESTAMP(6)  NULL DEFAULT NULL,
  ends_at             TIMESTAMP(6)  NULL DEFAULT NULL,
  status              nextticket.promo_code_status_enum NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (id),
  CONSTRAINT fk_promo_codes_event
    FOREIGN KEY (event_id)           REFERENCES nextticket.events (id),
  CONSTRAINT fk_promo_codes_zone
    FOREIGN KEY (applicable_zone_id) REFERENCES nextticket.event_zones (id),
  CONSTRAINT chk_promo_discount_value
    CHECK (discount_value > 0),
  CONSTRAINT chk_promo_percentage_max
    CHECK (discount_type <> 'PERCENTAGE' OR discount_value <= 100),
  CONSTRAINT chk_promo_dates
    CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at),
  CONSTRAINT chk_promo_min_purchase
    CHECK (min_purchase_total >= 0),
  CONSTRAINT chk_promo_max_uses_total_unsigned
    CHECK (max_uses_total IS NULL OR max_uses_total >= 0),
  CONSTRAINT chk_promo_max_uses_per_user_tinyint_unsigned
    CHECK (max_uses_per_user BETWEEN 0 AND 255)
);

CREATE UNIQUE INDEX uk_promo_codes_event_code ON nextticket.promo_codes (event_id, code);
CREATE INDEX        idx_promo_codes_event     ON nextticket.promo_codes (event_id);
CREATE INDEX        idx_promo_codes_zone      ON nextticket.promo_codes (applicable_zone_id);
CREATE INDEX        idx_promo_codes_status    ON nextticket.promo_codes (status);

CREATE TABLE IF NOT EXISTS nextticket.promo_code_usages (
  id            UUID         NOT NULL,
  created_at    TIMESTAMP(6) NOT NULL,
  promo_code_id UUID         NOT NULL,
  user_id       UUID         NOT NULL,
  purchase_id   UUID         NOT NULL,   -- FK agregada con ALTER TABLE tras crear purchases (ver nota inicial)
  PRIMARY KEY (id),
  CONSTRAINT fk_pcu_promo_code
    FOREIGN KEY (promo_code_id) REFERENCES nextticket.promo_codes (id),
  CONSTRAINT fk_pcu_user
    FOREIGN KEY (user_id)       REFERENCES nextticket.users (id)
);

CREATE UNIQUE INDEX uk_pcu_purchase_promo ON nextticket.promo_code_usages (purchase_id, promo_code_id);
CREATE INDEX        idx_pcu_promo_code    ON nextticket.promo_code_usages (promo_code_id);
CREATE INDEX        idx_pcu_user          ON nextticket.promo_code_usages (user_id);
CREATE INDEX        idx_pcu_purchase      ON nextticket.promo_code_usages (purchase_id);


-- ═══════════════════════════════════════════════════════════
-- MODULE: PURCHASE
-- ═══════════════════════════════════════════════════════════

CREATE TYPE nextticket.temporary_block_status_enum AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED');

CREATE TABLE IF NOT EXISTS nextticket.temporary_blocks (
  id               UUID         NOT NULL,
  created_at       TIMESTAMP(6) NOT NULL,
  created_by       UUID         NULL DEFAULT NULL,
  last_modified_by UUID         NULL DEFAULT NULL,
  updated_at       TIMESTAMP(6) NULL DEFAULT NULL,
  user_id          UUID         NOT NULL,
  event_zone_id    UUID         NOT NULL,
  event_seat_id    UUID         NULL DEFAULT NULL,
  quantity         INTEGER      NOT NULL DEFAULT 1,
  started_at       TIMESTAMP(6) NOT NULL,
  expires_at       TIMESTAMP(6) NOT NULL,
  status           nextticket.temporary_block_status_enum NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (id),
  CONSTRAINT fk_tb_user
    FOREIGN KEY (user_id)       REFERENCES nextticket.users (id),
  CONSTRAINT fk_tb_event_zone
    FOREIGN KEY (event_zone_id) REFERENCES nextticket.event_zones (id),
  CONSTRAINT fk_tb_event_seat
    FOREIGN KEY (event_seat_id) REFERENCES nextticket.event_seats (id),
  CONSTRAINT chk_tb_positive_quantity
    CHECK (quantity > 0),
  CONSTRAINT chk_tb_reserved_quantity
    CHECK (event_seat_id IS NULL OR quantity = 1),
  CONSTRAINT chk_tb_valid_window
    CHECK (expires_at > started_at)
);

CREATE INDEX idx_tb_user           ON nextticket.temporary_blocks (user_id);
CREATE INDEX idx_tb_event_zone     ON nextticket.temporary_blocks (event_zone_id);
CREATE INDEX idx_tb_event_seat     ON nextticket.temporary_blocks (event_seat_id);
CREATE INDEX idx_tb_status_expires ON nextticket.temporary_blocks (status, expires_at);

CREATE TYPE nextticket.purchase_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'REFUNDED');

CREATE TABLE IF NOT EXISTS nextticket.purchases (
  id               UUID          NOT NULL,
  created_at       TIMESTAMP(6)  NOT NULL,
  created_by       UUID          NULL DEFAULT NULL,
  last_modified_by UUID          NULL DEFAULT NULL,
  updated_at       TIMESTAMP(6)  NULL DEFAULT NULL,
  user_id          UUID          NOT NULL,
  event_id         UUID          NOT NULL,
  folio            BIGINT        NULL DEFAULT NULL,
  gross_subtotal   DECIMAL(11,2) NOT NULL,
  discount_amount  DECIMAL(11,2) NOT NULL DEFAULT 0.00,
  net_subtotal     DECIMAL(11,2) NOT NULL,
  tax_amount       DECIMAL(11,2) NOT NULL DEFAULT 0.00,
  total            DECIMAL(11,2) NOT NULL,
  status           nextticket.purchase_status_enum NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (id),
  CONSTRAINT fk_purchases_user
    FOREIGN KEY (user_id)  REFERENCES nextticket.users (id),
  CONSTRAINT fk_purchases_event
    FOREIGN KEY (event_id) REFERENCES nextticket.events (id),
  CONSTRAINT chk_purchases_non_negative
    CHECK (
      gross_subtotal  >= 0 AND
      discount_amount >= 0 AND
      net_subtotal    >= 0 AND
      tax_amount      >= 0 AND
      total           >= 0
    ),
  CONSTRAINT chk_purchases_sat_compliance
    CHECK (net_subtotal = gross_subtotal - discount_amount),
  CONSTRAINT chk_purchases_financial_equation
    CHECK (total = net_subtotal + tax_amount)
);

CREATE UNIQUE INDEX uk_purchases_folio    ON nextticket.purchases (folio);
CREATE INDEX        idx_purchases_user       ON nextticket.purchases (user_id);
CREATE INDEX        idx_purchases_event      ON nextticket.purchases (event_id);
CREATE INDEX        idx_purchases_status     ON nextticket.purchases (status);
CREATE INDEX        idx_purchases_created_at ON nextticket.purchases (created_at);

-- Referencia adelantada resuelta ahora que purchases ya existe (ver nota inicial)
ALTER TABLE nextticket.promo_code_usages
  ADD CONSTRAINT fk_pcu_purchase
  FOREIGN KEY (purchase_id) REFERENCES nextticket.purchases (id);


-- -----------------------------------------------------
-- Table nextticket.purchase_details
-- [F1] Se añade tax_amount DECIMAL(11,2) NOT NULL DEFAULT 0.00
--   El SAT (CFDI 4.0 Anexo 20) calcula IVA por Concepto, no por cabecera.
--   Sin este campo el backend debe reconstruir la distribución del impuesto al generar el
--   XML, produciendo errores de redondeo de 1-2 centavos que el PAC rechaza en producción.
--   El backend calcula: purchases.tax_amount = SUM(purchase_details.tax_amount)
--
--   El CHECK que propuso Gemini era una tautología:
--     subtotal + tax = final_price * quantity + tax  → siempre verdadero.
--   El constraint correcto es simplemente tax_amount >= 0, ya cubierto por
--   chk_pd_positive_prices extendido.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS nextticket.purchase_details (
  id                   UUID          NOT NULL,
  purchase_id          UUID          NOT NULL,
  event_zone_id        UUID          NOT NULL,
  event_seat_id        UUID          NULL DEFAULT NULL,
  price_tier_id        UUID          NULL DEFAULT NULL,
  promo_code_usage_id  UUID          NULL DEFAULT NULL,
  unit_price           DECIMAL(11,2) NOT NULL,
  discount_amount      DECIMAL(11,2) NOT NULL DEFAULT 0.00,
  final_price          DECIMAL(11,2) NOT NULL,
  tax_amount           DECIMAL(11,2) NOT NULL DEFAULT 0.00,  -- [F1] IVA por renglón SAT
  quantity              INTEGER      NOT NULL DEFAULT 1,
  subtotal             DECIMAL(11,2) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_pd_quantity_one
    CHECK (quantity = 1),
  CONSTRAINT fk_pd_purchase
    FOREIGN KEY (purchase_id)         REFERENCES nextticket.purchases (id),
  CONSTRAINT fk_pd_event_zone
    FOREIGN KEY (event_zone_id)       REFERENCES nextticket.event_zones (id),
  CONSTRAINT fk_pd_event_seat
    FOREIGN KEY (event_seat_id)       REFERENCES nextticket.event_seats (id),
  CONSTRAINT fk_pd_price_tier
    FOREIGN KEY (price_tier_id)       REFERENCES nextticket.event_zone_price_tiers (id),
  CONSTRAINT fk_pd_promo_usage
    FOREIGN KEY (promo_code_usage_id) REFERENCES nextticket.promo_code_usages (id),
  CONSTRAINT chk_pd_positive_prices
    CHECK (
      unit_price      >= 0 AND
      discount_amount >= 0 AND
      final_price     >= 0 AND
      tax_amount      >= 0 AND  -- [F1]
      subtotal        >= 0
    ),
  CONSTRAINT chk_pd_financial_math
    CHECK (final_price = unit_price - discount_amount),
  CONSTRAINT chk_pd_subtotal_math
    CHECK (subtotal = final_price * quantity)
);

CREATE UNIQUE INDEX uk_pd_purchase_seat ON nextticket.purchase_details (purchase_id, event_seat_id);
CREATE INDEX        idx_pd_purchase    ON nextticket.purchase_details (purchase_id);
CREATE INDEX        idx_pd_event_zone  ON nextticket.purchase_details (event_zone_id);
CREATE INDEX        idx_pd_event_seat  ON nextticket.purchase_details (event_seat_id);
CREATE INDEX        idx_pd_price_tier  ON nextticket.purchase_details (price_tier_id);
CREATE INDEX        idx_pd_promo_usage ON nextticket.purchase_details (promo_code_usage_id);

CREATE TYPE nextticket.payment_method_enum AS ENUM ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'DIGITAL_WALLET');
CREATE TYPE nextticket.payment_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');

CREATE TABLE IF NOT EXISTS nextticket.payments (
  id                 UUID          NOT NULL,
  created_at         TIMESTAMP(6)  NOT NULL,
  created_by         UUID          NULL DEFAULT NULL,
  last_modified_by   UUID          NULL DEFAULT NULL,
  updated_at         TIMESTAMP(6)  NULL DEFAULT NULL,
  purchase_id        UUID          NULL DEFAULT NULL,
  transfer_id        UUID          NULL DEFAULT NULL,  -- FK agregada con ALTER TABLE tras crear ticket_transfers (ver nota inicial)
  amount             DECIMAL(11,2) NOT NULL,
  payment_method     nextticket.payment_method_enum NOT NULL,
  external_reference VARCHAR(100)  NULL DEFAULT NULL,
  status             nextticket.payment_status_enum NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (id),
  CONSTRAINT fk_payments_purchase
    FOREIGN KEY (purchase_id) REFERENCES nextticket.purchases (id),
  CONSTRAINT chk_payments_single_origin
    CHECK ((purchase_id IS NOT NULL) <> (transfer_id IS NOT NULL)),
  CONSTRAINT chk_payments_positive_amount
    CHECK (amount > 0)
);

CREATE INDEX idx_payments_purchase ON nextticket.payments (purchase_id);
CREATE INDEX idx_payments_transfer ON nextticket.payments (transfer_id);
CREATE INDEX idx_payments_method   ON nextticket.payments (payment_method);
CREATE INDEX idx_payments_status   ON nextticket.payments (status);


-- ═══════════════════════════════════════════════════════════
-- MODULE: TICKETS  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TYPE nextticket.ticket_origin_type_enum AS ENUM ('PURCHASE', 'COMPLIMENTARY', 'STAFF', 'TRANSFER');
CREATE TYPE nextticket.ticket_status_enum AS ENUM ('ISSUED', 'USED', 'CANCELED', 'EXPIRED');

CREATE TABLE IF NOT EXISTS nextticket.tickets (
  id                  UUID         NOT NULL,
  created_at          TIMESTAMP(6) NOT NULL,
  created_by          UUID         NULL DEFAULT NULL,
  last_modified_by    UUID         NULL DEFAULT NULL,
  updated_at          TIMESTAMP(6) NULL DEFAULT NULL,
  purchase_id         UUID         NULL DEFAULT NULL,
  purchase_detail_id  UUID         NULL DEFAULT NULL,
  event_seat_id       UUID         NULL DEFAULT NULL,
  event_zone_id       UUID         NOT NULL,
  current_holder_id   UUID         NOT NULL,
  origin_type         nextticket.ticket_origin_type_enum NOT NULL DEFAULT 'PURCHASE',
  folio               VARCHAR(20)  NOT NULL,
  qr_code             VARCHAR(255) NOT NULL,
  issued_at           TIMESTAMP(6) NOT NULL,
  status              nextticket.ticket_status_enum NOT NULL DEFAULT 'ISSUED',
  PRIMARY KEY (id),
  CONSTRAINT fk_tickets_purchase
    FOREIGN KEY (purchase_id)        REFERENCES nextticket.purchases (id),
  CONSTRAINT fk_tickets_purchase_detail
    FOREIGN KEY (purchase_detail_id) REFERENCES nextticket.purchase_details (id),
  CONSTRAINT fk_tickets_event_seat
    FOREIGN KEY (event_seat_id)      REFERENCES nextticket.event_seats (id),
  CONSTRAINT fk_tickets_event_zone
    FOREIGN KEY (event_zone_id)      REFERENCES nextticket.event_zones (id),
  CONSTRAINT fk_tickets_current_holder
    FOREIGN KEY (current_holder_id)  REFERENCES nextticket.users (id),
  CONSTRAINT chk_tickets_purchase_detail_required
    CHECK (origin_type <> 'PURCHASE' OR purchase_detail_id IS NOT NULL)
);

-- Índices únicos parciales: equivalentes exactos a los índices funcionales con IF(...) de MySQL
CREATE UNIQUE INDEX uk_tickets_active_purchase_detail
  ON nextticket.tickets (purchase_detail_id)
  WHERE status IN ('ISSUED', 'USED');

CREATE UNIQUE INDEX uk_tickets_issued_seat
  ON nextticket.tickets (event_seat_id)
  WHERE status = 'ISSUED';

CREATE UNIQUE INDEX uk_tickets_folio   ON nextticket.tickets (folio);
CREATE UNIQUE INDEX uk_tickets_qr_code ON nextticket.tickets (qr_code);
CREATE INDEX        idx_tickets_purchase       ON nextticket.tickets (purchase_id);
CREATE INDEX        idx_tickets_event_zone     ON nextticket.tickets (event_zone_id);
CREATE INDEX        idx_tickets_event_seat     ON nextticket.tickets (event_seat_id);
CREATE INDEX        idx_tickets_current_holder ON nextticket.tickets (current_holder_id);
CREATE INDEX        idx_tickets_origin_type    ON nextticket.tickets (origin_type);
CREATE INDEX        idx_tickets_status         ON nextticket.tickets (status);
CREATE INDEX        idx_tickets_issued_at      ON nextticket.tickets (issued_at);


-- ═══════════════════════════════════════════════════════════
-- MODULE: TRANSFERS
-- [T1] issued_ticket_id añadido
-- ═══════════════════════════════════════════════════════════

-- -----------------------------------------------------
-- Table nextticket.ticket_transfers
-- [T1] issued_ticket_id UUID NULL:
--   Rastrea el nuevo QR emitido para el receptor de la transferencia.
--   El backend al completar una transferencia:
--     1. UPDATE tickets SET status='CANCELED' WHERE id = ticket_id (QR original)
--     2. INSERT INTO tickets (origin_type='TRANSFER', ...) → nuevo QR
--     3. UPDATE ticket_transfers SET
--          issued_ticket_id = nuevo_ticket_id,
--          status = 'COMPLETED',
--          completed_at = NOW()
--   Así la auditoría puede responder: "¿Cuál fue el nuevo QR de Ana?" con una sola lectura
--   sin joins adicionales.
--   NULL hasta que la transferencia se complete (PENDING/REJECTED/CANCELED).
-- -----------------------------------------------------
CREATE TYPE nextticket.ticket_transfer_status_enum AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'CANCELED');

CREATE TABLE IF NOT EXISTS nextticket.ticket_transfers (
  id               UUID          NOT NULL,
  created_at       TIMESTAMP(6)  NOT NULL,
  created_by       UUID          NULL DEFAULT NULL,
  last_modified_by UUID          NULL DEFAULT NULL,
  updated_at       TIMESTAMP(6)  NULL DEFAULT NULL,
  ticket_id        UUID          NOT NULL,             -- QR original (Carlos)
  issued_ticket_id UUID          NULL DEFAULT NULL,    -- [T1] nuevo QR (Ana); NULL hasta COMPLETED
  from_user_id     UUID          NOT NULL,
  to_user_id       UUID          NOT NULL,
  transfer_fee     DECIMAL(11,2) NOT NULL DEFAULT 0.00,
  completed_at     TIMESTAMP(6)  NULL DEFAULT NULL,
  status           nextticket.ticket_transfer_status_enum NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (id),
  CONSTRAINT fk_tt_ticket
    FOREIGN KEY (ticket_id)        REFERENCES nextticket.tickets (id),
  CONSTRAINT fk_tt_issued_ticket                                   -- [T1]
    FOREIGN KEY (issued_ticket_id) REFERENCES nextticket.tickets (id),
  CONSTRAINT fk_tt_from_user
    FOREIGN KEY (from_user_id) REFERENCES nextticket.users (id),
  CONSTRAINT fk_tt_to_user
    FOREIGN KEY (to_user_id)   REFERENCES nextticket.users (id),
  CONSTRAINT chk_tt_different_users
    CHECK (from_user_id <> to_user_id),
  CONSTRAINT chk_tt_non_negative_fee
    CHECK (transfer_fee >= 0)
);

CREATE UNIQUE INDEX uk_tt_pending_ticket
  ON nextticket.ticket_transfers (ticket_id)
  WHERE status = 'PENDING';

CREATE INDEX idx_tt_ticket        ON nextticket.ticket_transfers (ticket_id);
CREATE INDEX idx_tt_issued_ticket ON nextticket.ticket_transfers (issued_ticket_id); -- [T1]
CREATE INDEX idx_tt_from_user     ON nextticket.ticket_transfers (from_user_id);
CREATE INDEX idx_tt_to_user       ON nextticket.ticket_transfers (to_user_id);
CREATE INDEX idx_tt_status        ON nextticket.ticket_transfers (status);

-- Referencia adelantada resuelta ahora que ticket_transfers ya existe (ver nota inicial)
ALTER TABLE nextticket.payments
  ADD CONSTRAINT fk_payments_transfer
  FOREIGN KEY (transfer_id) REFERENCES nextticket.ticket_transfers (id);


-- ═══════════════════════════════════════════════════════════
-- MODULE: REFUNDS  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TYPE nextticket.refund_reason_enum AS ENUM ('CUSTOMER_REQUEST', 'EVENT_CANCELED', 'DUPLICATE_PURCHASE', 'FRAUD');
CREATE TYPE nextticket.refund_status_enum AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

CREATE TABLE IF NOT EXISTS nextticket.refunds (
  id                 UUID          NOT NULL,
  created_at         TIMESTAMP(6)  NOT NULL,
  created_by         UUID          NULL DEFAULT NULL,
  last_modified_by   UUID          NULL DEFAULT NULL,
  updated_at         TIMESTAMP(6)  NULL DEFAULT NULL,
  ticket_id          UUID          NOT NULL,
  payment_id         UUID          NOT NULL,
  amount             DECIMAL(11,2) NOT NULL,
  external_reference VARCHAR(100)  NULL DEFAULT NULL,
  reason             nextticket.refund_reason_enum NOT NULL,
  notes              VARCHAR(500)  NULL DEFAULT NULL,
  status             nextticket.refund_status_enum NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (id),
  CONSTRAINT fk_refunds_ticket
    FOREIGN KEY (ticket_id)  REFERENCES nextticket.tickets (id),
  CONSTRAINT fk_refunds_payment
    FOREIGN KEY (payment_id) REFERENCES nextticket.payments (id),
  CONSTRAINT chk_refunds_positive_amount
    CHECK (amount > 0)
);

CREATE UNIQUE INDEX uk_refunds_pending_ticket
  ON nextticket.refunds (ticket_id)
  WHERE status = 'PENDING';

CREATE INDEX idx_refunds_ticket  ON nextticket.refunds (ticket_id);
CREATE INDEX idx_refunds_payment ON nextticket.refunds (payment_id);
CREATE INDEX idx_refunds_status  ON nextticket.refunds (status);
CREATE INDEX idx_refunds_reason  ON nextticket.refunds (reason);


-- ═══════════════════════════════════════════════════════════
-- MODULE: TICKET VALIDATION  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nextticket.ticket_validations (
  id               UUID         NOT NULL,
  created_at       TIMESTAMP(6) NOT NULL,
  ticket_id        UUID         NOT NULL,
  validator_id     UUID         NOT NULL,
  validated_at     TIMESTAMP(6) NOT NULL,
  result           SMALLINT     NOT NULL,
  rejection_reason VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_tv_ticket
    FOREIGN KEY (ticket_id)    REFERENCES nextticket.tickets (id),
  CONSTRAINT fk_tv_validator
    FOREIGN KEY (validator_id) REFERENCES nextticket.users (id),
  CONSTRAINT chk_tv_rejection_requires_reason
    CHECK (result = 1 OR rejection_reason IS NOT NULL),
  CONSTRAINT chk_tv_success_no_reason
    CHECK (result = 0 OR rejection_reason IS NULL)
);

CREATE UNIQUE INDEX uk_tv_single_entry
  ON nextticket.ticket_validations (ticket_id)
  WHERE result = 1;

CREATE INDEX idx_tv_ticket       ON nextticket.ticket_validations (ticket_id);
CREATE INDEX idx_tv_validator    ON nextticket.ticket_validations (validator_id);
CREATE INDEX idx_tv_validated_at ON nextticket.ticket_validations (validated_at);
CREATE INDEX idx_tv_result       ON nextticket.ticket_validations (result);

COMMIT;