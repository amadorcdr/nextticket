-- ============================================================
-- Schema: nextticket  (v12 — CANVAS + GEOMETRY + FISCAL + TRANSFERS)
-- Sistema de Eventos y Boletos — SQL Forward Engineering
-- ============================================================
--
-- BASE: v11 (heredado completo)
-- CAMBIOS v12:
--
-- ── MÓDULO CANVAS (NUEVO) ────────────────────────────────────
--
-- [C1] floors — pisos del recinto para renderizado multicapa
--      El editor necesita saber en qué capa Z está cada elemento.
--      Un recinto puede tener Planta Baja (level_index=0),
--      Balcón (level_index=1), Palco Superior (level_index=2), etc.
--      UNIQUE (venue_id, level_index): no puede haber dos pisos
--      en el mismo nivel dentro del mismo recinto.
--
-- [C2] sections — columnas de geometría añadidas
--      El JSON del editor incluye posición, dimensiones, rotación,
--      color, prefijo visual y forma (elipse vs polígono).
--      Se añade floor_id para anclar la sección a su capa de renderizado.
--      Regla de negocio: section.floor.venue_id = section.venue_id.
--      No enforzable con FK en MySQL; validado en backend.
--
-- [C3] section_geometry_points — puntos del polígono de cada sección
--      El JSON incluye points[] (vértices) y curveControlPoints[]
--      (puntos de control Bézier para curvas) por sección.
--      En lugar de JSON (que rompe 1NF y no es indexable), cada punto
--      es una fila con su índice de orden, coordenadas y control opcional.
--      UNIQUE (section_id, point_index): el orden de los vértices importa.
--
-- [C4] canvas_elements — obstáculos y referencias visuales del piso
--      Escenarios, bocinas, entradas, baños, texto, etc.
--      Son entidades puramente visuales: sin precio, sin estado de reserva.
--      Campos añadidos sobre la propuesta de Gemini:
--        name          → el label del JSON del editor
--        color         → color de relleno en el canvas
--        is_ellipse    → BIT(1): figura circular vs polígono
--        border_radius → INT UNSIGNED NULL: radio de esquinas en píxeles
--                        (solo para obstáculos/referencias, no para sections)
--      Se descarta render_config JSON per requerimiento explícito.
--
-- [C5] canvas_element_geometry_points — puntos del polígono de cada obstáculo
--      Misma lógica que section_geometry_points.
--      Los obstáculos custom del JSON tienen points[] y curveControlPoints[].
--
-- ── MÓDULO FISCAL (MODIFICACIÓN) ─────────────────────────────
--
-- [F1] purchase_details — tax_amount por renglón (Gemini: CORRECTO)
--      El Anexo 20 del SAT (CFDI 4.0) calcula IVA por Concepto,
--      no a nivel de cabecera. Sin tax_amount por línea, el backend
--      tiene que reconstruir la distribución del impuesto al armar el XML,
--      generando discrepancias de redondeo de 1-2 centavos que el PAC rechaza.
--      Se añade tax_amount DECIMAL(11,2) NOT NULL DEFAULT 0.00.
--      CHECK tax_amount >= 0.
--      La ecuación de la cabecera purchases.tax_amount = SUM(pd.tax_amount)
--      se verifica en backend al construir la compra.
--
-- ── MÓDULO TRANSFERS (MODIFICACIÓN) ─────────────────────────
--
-- [T1] ticket_transfers — issued_ticket_id (Gemini: CORRECTO)
--      Una transferencia debe invalidar el QR original y emitir uno nuevo.
--      Carlos tiene captura de su QR → si solo se actualiza current_holder_id
--      en tickets, Carlos puede entrar antes que Ana y uk_tv_single_entry
--      bloqueará a Ana legítima en la puerta.
--      Flujo correcto del backend:
--        UPDATE tickets SET status='CANCELED' WHERE id = original_ticket_id
--        INSERT INTO tickets (..., origin_type='TRANSFER') → nuevo QR para Ana
--        UPDATE ticket_transfers SET issued_ticket_id = nuevo_ticket_id
--      issued_ticket_id NULL hasta que se complete la transferencia.
--      NULL en una transferencia PENDING/REJECTED/CANCELED es semánticamente correcto.
--
-- ─────────────────────────────────────────────────────────────
-- TABLAS SIN CAMBIOS vs v11
-- ─────────────────────────────────────────────────────────────
-- roles, permissions, role_permissions, users
-- venues
-- seats (solo se añade floor_id a sections, seats no cambia)
-- events, event_zones, event_zone_price_tiers,
-- event_zone_sections, event_seats
-- promo_codes, promo_code_usages
-- temporary_blocks, purchases, payments
-- tickets, ticket_validations
-- refunds
-- ============================================================

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS,           UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS,  FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE,
    SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE SCHEMA IF NOT EXISTS `nextticket`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE `nextticket`;


-- ═══════════════════════════════════════════════════════════
-- MODULE: SECURITY  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `nextticket`.`roles` (
  `id`               BINARY(16)   NOT NULL,
  `created_at`       DATETIME(6)  NOT NULL,
  `created_by`       BINARY(16)   NULL DEFAULT NULL,
  `last_modified_by` BINARY(16)   NULL DEFAULT NULL,
  `status`           BIT(1)       NOT NULL DEFAULT b'1',
  `updated_at`       DATETIME(6)  NULL DEFAULT NULL,
  `name`             VARCHAR(50)  NOT NULL,
  `description`      VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_roles_name` (`name` ASC) VISIBLE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `nextticket`.`permissions` (
  `id`               BINARY(16)   NOT NULL,
  `created_at`       DATETIME(6)  NOT NULL,
  `created_by`       BINARY(16)   NULL DEFAULT NULL,
  `last_modified_by` BINARY(16)   NULL DEFAULT NULL,
  `status`           BIT(1)       NOT NULL DEFAULT b'1',
  `updated_at`       DATETIME(6)  NULL DEFAULT NULL,
  `name`             VARCHAR(60)  NOT NULL,
  `resource`         VARCHAR(40)  NOT NULL,
  `description`      VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_permissions_name` (`name` ASC)      VISIBLE,
  INDEX `idx_permissions_resource`   (`resource` ASC)  VISIBLE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `nextticket`.`role_permissions` (
  `id`            BINARY(16) NOT NULL,
  `role_id`       BINARY(16) NOT NULL,
  `permission_id` BINARY(16) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_role_permissions` (`role_id` ASC, `permission_id` ASC) VISIBLE,
  INDEX `idx_rp_role`       (`role_id` ASC)       VISIBLE,
  INDEX `idx_rp_permission` (`permission_id` ASC) VISIBLE,
  CONSTRAINT `fk_rp_role`
    FOREIGN KEY (`role_id`)       REFERENCES `nextticket`.`roles` (`id`),
  CONSTRAINT `fk_rp_permission`
    FOREIGN KEY (`permission_id`) REFERENCES `nextticket`.`permissions` (`id`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `nextticket`.`users` (
  `id`               BINARY(16)   NOT NULL,
  `created_at`       DATETIME(6)  NOT NULL,
  `created_by`       BINARY(16)   NULL DEFAULT NULL,
  `last_modified_by` BINARY(16)   NULL DEFAULT NULL,
  `status`           BIT(1)       NOT NULL DEFAULT b'1',
  `updated_at`       DATETIME(6)  NULL DEFAULT NULL,
  `name`             VARCHAR(100) NOT NULL,
  `email`            VARCHAR(255) NOT NULL,
  `password`         VARCHAR(255) NOT NULL,
  `role_id`          BINARY(16)   NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_users_email`  (`email` ASC)   VISIBLE,
  INDEX `idx_users_status`       (`status` ASC)  VISIBLE,
  INDEX `idx_users_role`         (`role_id` ASC) VISIBLE,
  CONSTRAINT `fk_users_role`
    FOREIGN KEY (`role_id`) REFERENCES `nextticket`.`roles` (`id`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- ═══════════════════════════════════════════════════════════
-- MODULE: CONFIGURATION + CANVAS
-- ═══════════════════════════════════════════════════════════

-- -----------------------------------------------------
-- Table `nextticket`.`venues`  (sin cambios vs v11)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nextticket`.`venues` (
  `id`               BINARY(16)    NOT NULL,
  `created_at`       DATETIME(6)   NOT NULL,
  `created_by`       BINARY(16)    NULL DEFAULT NULL,
  `last_modified_by` BINARY(16)    NULL DEFAULT NULL,
  `updated_at`       DATETIME(6)   NULL DEFAULT NULL,
  `name`             VARCHAR(150)  NOT NULL,
  `address`          VARCHAR(255)  NOT NULL,
  `city`             VARCHAR(100)  NOT NULL,
  `state`            VARCHAR(100)  NULL DEFAULT NULL,
  `country`          VARCHAR(100)  NOT NULL DEFAULT 'Mexico',
  `total_capacity`   INT UNSIGNED  NOT NULL,
  `description`      VARCHAR(500)  NULL DEFAULT NULL,
`status`            ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'REMOVED') NOT NULL DEFAULT 'DRAFT',  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_venues_name_city`  (`name` ASC, `city` ASC) VISIBLE,
  INDEX `idx_venues_status`            (`status` ASC)             VISIBLE,
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `nextticket`.`floors`  [C1] NUEVA
-- Representa las capas de renderizado del recinto:
-- "Planta Baja" (level_index=0), "Balcón" (level_index=1), etc.
-- level_index es el z-order para el editor de mapa.
-- UNIQUE (venue_id, level_index): sin pisos duplicados por recinto.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nextticket`.`floors` (
  `id`               BINARY(16)    NOT NULL,
  `venue_id`         BINARY(16)    NOT NULL,
  `name`             VARCHAR(100)  NOT NULL,             -- "Planta Baja", "Balcón Superior"
  `level_index`      INT           NOT NULL,             -- z-order del canvas: 0, 1, 2...
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_floors_venue_level`  (`venue_id` ASC, `level_index` ASC) VISIBLE,
  INDEX `idx_floors_venue`              (`venue_id` ASC)                     VISIBLE,
  CONSTRAINT `fk_floors_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `nextticket`.`venues` (`id`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `nextticket`.`sections`  [C2] MODIFICADA
-- Añade geometría de renderizado del editor:
--   floor_id        → piso al que pertenece (para renderizado en capa correcta)
--   color           → color de relleno en el canvas (#RRGGBB)
--   prefix          → código visual del editor ("ZON-01", "SEC-A")
--   coordinate_x/y  → posición del centroide en el canvas
--   width / height  → dimensiones del bounding box
--   rotation_degrees → rotación en grados
--   is_ellipse      → BIT(1): TRUE = figura circular/elíptica, FALSE = polígono
--                     Los vértices del polígono viven en section_geometry_points.
--
-- Regla de negocio: section.floor.venue_id = section.venue_id
-- No enforzable con FK en MySQL; validado en backend al crear la sección.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nextticket`.`sections` (
  `id`               BINARY(16)     NOT NULL,
  `venue_id`         BINARY(16)     NOT NULL,
  `floor_id`         BINARY(16)     NOT NULL,            -- [C2] piso de renderizado
  `name`             VARCHAR(100)   NOT NULL,
  `description`      VARCHAR(255)   NULL DEFAULT NULL,
  `capacity`         INT UNSIGNED   NOT NULL,
  `status`            ENUM('ACTIVE', 'INACTIVE', 'REMOVED') NOT NULL DEFAULT 'ACTIVE',
  -- Geometría del editor [C2]
  `color`            VARCHAR(7)     NULL DEFAULT NULL,   -- p.ej. '#0485F7'
  `prefix`           VARCHAR(20)    NULL DEFAULT NULL,   -- p.ej. 'ZON-01'
  `coordinate_x`     INT            NULL DEFAULT NULL,   -- posición X en el canvas
  `coordinate_y`     INT            NULL DEFAULT NULL,   -- posición Y en el canvas
  `width`            INT            NULL DEFAULT NULL,   -- ancho del bounding box
  `height`           INT            NULL DEFAULT NULL,   -- alto del bounding box
  `rotation_degrees` DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
  `is_ellipse`       BIT(1)         NOT NULL DEFAULT b'0', -- 0=polígono, 1=elipse/círculo
  `geometry_points`  JSON           NULL DEFAULT NULL,     -- array de {x,y,control_x,control_y}; NULL si is_ellipse=1
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_sections_venue_name`  (`venue_id` ASC, `name` ASC) VISIBLE,
  INDEX `idx_sections_venue`             (`venue_id` ASC)              VISIBLE,
  INDEX `idx_sections_floor`             (`floor_id` ASC)              VISIBLE,
  INDEX `idx_sections_status`             (`status` ASC)                 VISIBLE,
  CONSTRAINT `fk_sections_venue`
    FOREIGN KEY (`venue_id`) REFERENCES `nextticket`.`venues` (`id`),
  CONSTRAINT `fk_sections_floor`
    FOREIGN KEY (`floor_id`) REFERENCES `nextticket`.`floors` (`id`),
  CONSTRAINT `chk_sections_geometry_points_is_array`
    CHECK (`geometry_points` IS NULL OR JSON_TYPE(`geometry_points`) = 'ARRAY')
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `nextticket`.`section_geometry_points`  [C3] NUEVA
-- Almacena los vértices del polígono de cada sección, en orden.
-- Una fila por punto. Reemplaza el array points[] del JSON del editor.
--
-- point_index: orden del vértice en el polígono (0, 1, 2, ...).
--   El editor conecta los puntos en este orden al renderizar.
--
-- control_x / control_y: punto de control de la curva Bézier para
--   la arista que sale de este vértice. NULL = arista recta.
--   Mapea curveControlPoints[i] del JSON.
--
-- UNIQUE (section_id, point_index): orden único por sección.
-- Solo aplica cuando is_ellipse = 0; si is_ellipse = 1, no hay puntos.
-- Validado en backend.
-- -----------------------------------------------------


-- -----------------------------------------------------
-- Table `nextticket`.`seats`  (sin cambios vs v11)
-- Los asientos siguen vinculados a section_id (agrupación lógica).
-- El piso de renderizado se obtiene por section → floor.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nextticket`.`seats` (
  `id`               BINARY(16)  NOT NULL,
  `section_id`       BINARY(16)  NOT NULL,
  `row`              VARCHAR(10) NOT NULL,
  `number`           VARCHAR(10) NOT NULL,
  `type`             ENUM('STANDARD', 'VIP', 'PREMIUM', 'ACCESSIBLE') NOT NULL DEFAULT 'STANDARD',
  `coordinate_x`     INT         NULL DEFAULT NULL,
  `coordinate_y`     INT         NULL DEFAULT NULL,
  `status`            ENUM('AVAILABLE', 'UNAVAILABLE', 'OUT_OF_SERVICE', 'REMOVED') NOT NULL DEFAULT 'AVAILABLE',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_seats_section_row_number`  (`section_id` ASC, `row` ASC, `number` ASC) VISIBLE,
  UNIQUE INDEX `uk_seats_section_id_id`       (`section_id` ASC, `id` ASC)                VISIBLE,
  INDEX `idx_seats_status`                     (`status` ASC)                                VISIBLE,
  CONSTRAINT `fk_seats_section`
    FOREIGN KEY (`section_id`) REFERENCES `nextticket`.`sections` (`id`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `nextticket`.`canvas_elements`  [C4] NUEVA
-- Obstáculos y referencias visuales del canvas del editor.
-- Escenarios, bocinas, entradas, salidas, baños, textos, formas, etc.
-- Son entidades puramente visuales: sin precio, sin capacidad,
-- sin estado de reserva. No participan en el flujo de venta.
--
-- element_type: tipo predefinido del editor.
--   CUSTOM cubre el caso "type": "custom" del JSON.
--
-- name: el label del JSON del editor ("Elemento 1", "Escenario Principal").
-- color: color de relleno en el canvas (#RRGGBB).
-- is_ellipse: BIT(1) — misma semántica que en sections.
-- border_radius: INT UNSIGNED NULL — radio de esquinas en píxeles para
--   el renderizado CSS/canvas. NULL = sin radio (esquinas rectas).
--   Solo obstáculos/referencias tienen este campo; sections no.
--
-- Se descarta render_config JSON: los campos estructurados cubren
-- todo lo que el editor necesita, son indexables y no rompen 1NF.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nextticket`.`canvas_elements` (
  `id`               BINARY(16)    NOT NULL,
  `floor_id`         BINARY(16)    NOT NULL,
  `element_type`     ENUM(
                       'STAGE', 'SCREEN', 'SPEAKER',
                       'ENTRANCE', 'EXIT', 'CORRIDOR',
                       'BATHROOM', 'BAR', 'TEXT',
                       'SHAPE', 'CUSTOM'
                     ) NOT NULL,
  `name`             VARCHAR(150)  NOT NULL,             -- label del editor
  `status`           BIT(1)        NOT NULL DEFAULT b'1', -- 0=INACTIVE, 1=ACTIVE
  `color`            VARCHAR(7)    NULL DEFAULT NULL,    -- color de relleno '#3a3a3a'
  `coordinate_x`     INT           NOT NULL,
  `coordinate_y`     INT           NOT NULL,
  `width`            INT           NULL DEFAULT NULL,
  `height`           INT           NULL DEFAULT NULL,
  `rotation_degrees` DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  `is_ellipse`       BIT(1)        NOT NULL DEFAULT b'0', -- 0=polígono, 1=elipse
  `geometry_points`  JSON          NULL DEFAULT NULL,    -- array de {x,y,control_x,control_y}; misma semántica que en sections
  `border_radius`    INT UNSIGNED  NULL DEFAULT NULL,    -- radio de esquinas en px; NULL=sin radio
  PRIMARY KEY (`id`),
  INDEX `idx_ce_floor`        (`floor_id` ASC)        VISIBLE,
  INDEX `idx_ce_element_type` (`element_type` ASC)    VISIBLE,
  INDEX `idx_ce_status`        (`status` ASC)           VISIBLE,
  CONSTRAINT `fk_ce_floor`
    FOREIGN KEY (`floor_id`) REFERENCES `nextticket`.`floors` (`id`),
  CONSTRAINT `chk_ce_positive_dimensions`
    CHECK (
      (`width`  IS NULL OR `width`  > 0) AND
      (`height` IS NULL OR `height` > 0)
    ),
  CONSTRAINT `chk_ce_geometry_points_is_array`
    CHECK (`geometry_points` IS NULL OR JSON_TYPE(`geometry_points`) = 'ARRAY')
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `nextticket`.`canvas_element_geometry_points`  [C5] NUEVA
-- Vértices del polígono de cada obstáculo/referencia.
-- Misma estructura que section_geometry_points.
-- Solo aplica cuando canvas_elements.is_ellipse = 0.
-- El tipo CUSTOM del JSON tiene points[] y curveControlPoints[];
-- esta tabla los almacena de forma relacional.
-- -----------------------------------------------------

-- ═══════════════════════════════════════════════════════════
-- MODULE: OPERATION  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `nextticket`.`events` (
  `id`               BINARY(16)    NOT NULL,
  `created_at`       DATETIME(6)   NOT NULL,
  `created_by`       BINARY(16)    NULL DEFAULT NULL,
  `last_modified_by` BINARY(16)    NULL DEFAULT NULL,
  `updated_at`       DATETIME(6)   NULL DEFAULT NULL,
  `venue_id`         BINARY(16)    NOT NULL,
  `organizer_id`     BINARY(16)    NOT NULL,
  `name`             VARCHAR(200)  NOT NULL,
  `starts_at`        DATETIME(6)   NOT NULL,             -- antes event_datetime
  `ends_at`          DATETIME(6)   NOT NULL,
  `image_url`        VARCHAR(500)  NULL DEFAULT NULL,
  `description`      VARCHAR(1000) NULL DEFAULT NULL,
  `status`            ENUM('DRAFT', 'PUBLISHED', 'CANCELED', 'SOLD_OUT', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
  PRIMARY KEY (`id`),
  INDEX `idx_events_venue`      (`venue_id` ASC)       VISIBLE,
  INDEX `idx_events_organizer`  (`organizer_id` ASC)   VISIBLE,
  INDEX `idx_events_status`      (`status` ASC)          VISIBLE,
  INDEX `idx_events_starts_at` (`starts_at` ASC) VISIBLE, -- antes idx_events_datetime

  CONSTRAINT `fk_events_venue`
    FOREIGN KEY (`venue_id`)     REFERENCES `nextticket`.`venues` (`id`),
      CONSTRAINT `chk_events_valid_window`
    CHECK (`ends_at` IS NULL OR `starts_at` < `ends_at`)
  CONSTRAINT `fk_events_organizer`
    FOREIGN KEY (`organizer_id`) REFERENCES `nextticket`.`users` (`id`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `nextticket`.`event_zones` (
  `id`                       BINARY(16)    NOT NULL,
  `created_at`               DATETIME(6)   NOT NULL,
  `created_by`               BINARY(16)    NULL DEFAULT NULL,
  `last_modified_by`         BINARY(16)    NULL DEFAULT NULL,
  `updated_at`               DATETIME(6)   NULL DEFAULT NULL,
  `event_id`                 BINARY(16)    NOT NULL,
  `public_name`              VARCHAR(100)  NOT NULL,
  `admission_type`           ENUM('RESERVED', 'GENERAL') NOT NULL DEFAULT 'RESERVED',
  `event_price`              DECIMAL(11,2) NOT NULL,
  `available_capacity`       INT UNSIGNED  NOT NULL,
  `map_color`                VARCHAR(7)    NULL DEFAULT NULL,
  `max_tickets_per_purchase` TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `status`                    ENUM('ACTIVE', 'INACTIVE', 'SOLD_OUT') NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (`id`),
  INDEX `idx_event_zones_event`           (`event_id` ASC)       VISIBLE,
  INDEX `idx_event_zones_admission_type`  (`admission_type` ASC) VISIBLE,
  INDEX `idx_event_zones_status`           (`status` ASC)          VISIBLE,
  CONSTRAINT `fk_event_zones_event`
    FOREIGN KEY (`event_id`) REFERENCES `nextticket`.`events` (`id`),
  CONSTRAINT `chk_event_zone_positive_price`
    CHECK (`event_price` >= 0)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `nextticket`.`event_zone_price_tiers` (
  `id`                  BINARY(16)    NOT NULL,
  `created_at`          DATETIME(6)   NOT NULL,
  `created_by`          BINARY(16)    NULL DEFAULT NULL,
  `last_modified_by`    BINARY(16)    NULL DEFAULT NULL,
  `updated_at`          DATETIME(6)   NULL DEFAULT NULL,
  `event_zone_id`       BINARY(16)    NOT NULL,
  `name`                VARCHAR(100)  NOT NULL,
  `price`               DECIMAL(11,2) NOT NULL,
  `initial_capacity`    INT UNSIGNED  NULL DEFAULT NULL,
  `available_capacity`  INT UNSIGNED  NULL DEFAULT NULL,
  `starts_at`           DATETIME(6)   NULL DEFAULT NULL,
  `ends_at`             DATETIME(6)   NULL DEFAULT NULL,
  `sort_order`          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `status`               ENUM('PENDING', 'ACTIVE', 'EXHAUSTED', 'CLOSED') NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_price_tiers_zone_order`  (`event_zone_id` ASC, `sort_order` ASC) VISIBLE,
  INDEX `idx_price_tiers_zone`              (`event_zone_id` ASC)                    VISIBLE,
  INDEX `idx_price_tiers_status`             (`status` ASC)                            VISIBLE,
  CONSTRAINT `fk_price_tiers_event_zone`
    FOREIGN KEY (`event_zone_id`) REFERENCES `nextticket`.`event_zones` (`id`),
  CONSTRAINT `chk_price_tier_positive`
    CHECK (`price` >= 0),
  CONSTRAINT `chk_price_tier_dates`
    CHECK (`starts_at` IS NULL OR `ends_at` IS NULL OR `starts_at` < `ends_at`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `nextticket`.`event_zone_sections` (
  `id`             BINARY(16) NOT NULL,
  `event_zone_id`  BINARY(16) NOT NULL,
  `event_id`       BINARY(16) NOT NULL,
  `section_id`     BINARY(16) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_ezs_zone_section`   (`event_zone_id` ASC, `section_id` ASC) VISIBLE,
  UNIQUE INDEX `uk_ezs_event_section`  (`event_id` ASC, `section_id` ASC)      VISIBLE,
  INDEX `idx_ezs_event_zone`           (`event_zone_id` ASC)                   VISIBLE,
  INDEX `idx_ezs_section`              (`section_id` ASC)                      VISIBLE,
  CONSTRAINT `fk_ezs_event_zone`
    FOREIGN KEY (`event_zone_id`) REFERENCES `nextticket`.`event_zones` (`id`),
  CONSTRAINT `fk_ezs_event`
    FOREIGN KEY (`event_id`)      REFERENCES `nextticket`.`events` (`id`),
  CONSTRAINT `fk_ezs_section`
    FOREIGN KEY (`section_id`)    REFERENCES `nextticket`.`sections` (`id`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `nextticket`.`event_seats` (
  `id`               BINARY(16)   NOT NULL,
  `event_zone_id`    BINARY(16)   NOT NULL,
  `seat_id`          BINARY(16)   NOT NULL,
  `section_id`       BINARY(16)   NOT NULL,
  `locked_until`     DATETIME(6)  NULL DEFAULT NULL,
  `status`            ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'DISABLED') NOT NULL DEFAULT 'AVAILABLE',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_event_seats_zone_seat`  (`event_zone_id` ASC, `seat_id` ASC) VISIBLE,
  INDEX `idx_event_seats_event_zone`       (`event_zone_id` ASC)                 VISIBLE,
  INDEX `idx_event_seats_section`          (`section_id` ASC)                    VISIBLE,
  INDEX `idx_event_seats_status`            (`status` ASC)                         VISIBLE,
  INDEX `idx_event_seats_locked_until`     (`locked_until` ASC)                  VISIBLE,
  CONSTRAINT `fk_event_seats_zone_section`
    FOREIGN KEY (`event_zone_id`, `section_id`)
    REFERENCES `nextticket`.`event_zone_sections` (`event_zone_id`, `section_id`),
  CONSTRAINT `fk_event_seats_seat_section`
    FOREIGN KEY (`section_id`, `seat_id`)
    REFERENCES `nextticket`.`seats` (`section_id`, `id`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- ═══════════════════════════════════════════════════════════
-- MODULE: PROMOTIONS  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `nextticket`.`promo_codes` (
  `id`                  BINARY(16)    NOT NULL,
  `created_at`          DATETIME(6)   NOT NULL,
  `created_by`          BINARY(16)    NULL DEFAULT NULL,
  `last_modified_by`    BINARY(16)    NULL DEFAULT NULL,
  `updated_at`          DATETIME(6)   NULL DEFAULT NULL,
  `event_id`            BINARY(16)    NOT NULL,
  `applicable_zone_id`  BINARY(16)    NULL DEFAULT NULL,
  `code`                VARCHAR(30)   NOT NULL,
  `discount_type`       ENUM('PERCENTAGE', 'FIXED') NOT NULL,
  `discount_value`      DECIMAL(11,2) NOT NULL,
  `max_uses_total`      INT UNSIGNED  NULL DEFAULT NULL,
  `max_uses_per_user`   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `min_purchase_total`  DECIMAL(11,2) NOT NULL DEFAULT 0.00,
  `starts_at`           DATETIME(6)   NULL DEFAULT NULL,
  `ends_at`             DATETIME(6)   NULL DEFAULT NULL,
  `status`               ENUM('ACTIVE', 'INACTIVE', 'EXHAUSTED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_promo_codes_event_code`  (`event_id` ASC, `code` ASC) VISIBLE,
  INDEX `idx_promo_codes_event`             (`event_id` ASC)              VISIBLE,
  INDEX `idx_promo_codes_zone`              (`applicable_zone_id` ASC)    VISIBLE,
  INDEX `idx_promo_codes_status`             (`status` ASC)                 VISIBLE,
  CONSTRAINT `fk_promo_codes_event`
    FOREIGN KEY (`event_id`)           REFERENCES `nextticket`.`events` (`id`),
  CONSTRAINT `fk_promo_codes_zone`
    FOREIGN KEY (`applicable_zone_id`) REFERENCES `nextticket`.`event_zones` (`id`),
  CONSTRAINT `chk_promo_discount_value`
    CHECK (`discount_value` > 0),
  CONSTRAINT `chk_promo_percentage_max`
    CHECK (`discount_type` <> 'PERCENTAGE' OR `discount_value` <= 100),
  CONSTRAINT `chk_promo_dates`
    CHECK (`starts_at` IS NULL OR `ends_at` IS NULL OR `starts_at` < `ends_at`),
  CONSTRAINT `chk_promo_min_purchase`
    CHECK (`min_purchase_total` >= 0)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `nextticket`.`promo_code_usages` (
  `id`            BINARY(16) NOT NULL,
  `created_at`    DATETIME(6) NOT NULL,
  `promo_code_id` BINARY(16) NOT NULL,
  `user_id`       BINARY(16) NOT NULL,
  `purchase_id`   BINARY(16) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_pcu_purchase_promo`  (`purchase_id` ASC, `promo_code_id` ASC) VISIBLE,
  INDEX `idx_pcu_promo_code`            (`promo_code_id` ASC) VISIBLE,
  INDEX `idx_pcu_user`                  (`user_id` ASC)       VISIBLE,
  INDEX `idx_pcu_purchase`              (`purchase_id` ASC)   VISIBLE,
  CONSTRAINT `fk_pcu_promo_code`
    FOREIGN KEY (`promo_code_id`) REFERENCES `nextticket`.`promo_codes` (`id`),
  CONSTRAINT `fk_pcu_user`
    FOREIGN KEY (`user_id`)       REFERENCES `nextticket`.`users` (`id`),
  CONSTRAINT `fk_pcu_purchase`
    FOREIGN KEY (`purchase_id`)   REFERENCES `nextticket`.`purchases` (`id`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- ═══════════════════════════════════════════════════════════
-- MODULE: PURCHASE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `nextticket`.`temporary_blocks` (
  `id`               BINARY(16)    NOT NULL,
  `created_at`       DATETIME(6)   NOT NULL,
  `created_by`       BINARY(16)    NULL DEFAULT NULL,
  `last_modified_by` BINARY(16)    NULL DEFAULT NULL,
  `updated_at`       DATETIME(6)   NULL DEFAULT NULL,
  `user_id`          BINARY(16)    NOT NULL,
  `event_zone_id`    BINARY(16)    NOT NULL,
  `event_seat_id`    BINARY(16)    NULL DEFAULT NULL,
  `quantity`         INT UNSIGNED  NOT NULL DEFAULT 1,
  `started_at`       DATETIME(6)   NOT NULL,
  `expires_at`       DATETIME(6)   NOT NULL,
  `status`            ENUM('ACTIVE', 'EXPIRED', 'RELEASED') NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (`id`),
  INDEX `idx_tb_user`          (`user_id` ASC)                  VISIBLE,
  INDEX `idx_tb_event_zone`    (`event_zone_id` ASC)            VISIBLE,
  INDEX `idx_tb_event_seat`    (`event_seat_id` ASC)            VISIBLE,
  INDEX `idx_tb_status_expires` (`status` ASC, `expires_at` ASC)  VISIBLE,
  CONSTRAINT `fk_tb_user`
    FOREIGN KEY (`user_id`)       REFERENCES `nextticket`.`users` (`id`),
  CONSTRAINT `fk_tb_event_zone`
    FOREIGN KEY (`event_zone_id`) REFERENCES `nextticket`.`event_zones` (`id`),
  CONSTRAINT `fk_tb_event_seat`
    FOREIGN KEY (`event_seat_id`) REFERENCES `nextticket`.`event_seats` (`id`),
  CONSTRAINT `chk_tb_positive_quantity`
    CHECK (`quantity` > 0),
  CONSTRAINT `chk_tb_reserved_quantity`
    CHECK (`event_seat_id` IS NULL OR `quantity` = 1),
  CONSTRAINT `chk_tb_valid_window`
    CHECK (`expires_at` > `started_at`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `nextticket`.`purchases` (
  `id`               BINARY(16)    NOT NULL,
  `created_at`       DATETIME(6)   NOT NULL,
  `created_by`       BINARY(16)    NULL DEFAULT NULL,
  `last_modified_by` BINARY(16)    NULL DEFAULT NULL,
  `updated_at`       DATETIME(6)   NULL DEFAULT NULL,
  `user_id`          BINARY(16)    NOT NULL,
  `event_id`         BINARY(16)    NOT NULL,
  `folio`            BIGINT        NULL DEFAULT NULL,
  `gross_subtotal`   DECIMAL(11,2) NOT NULL,
  `discount_amount`  DECIMAL(11,2) NOT NULL DEFAULT 0.00,
  `net_subtotal`     DECIMAL(11,2) NOT NULL,
  `tax_amount`       DECIMAL(11,2) NOT NULL DEFAULT 0.00,
  `total`            DECIMAL(11,2) NOT NULL,
  `status`            ENUM('PENDING', 'CONFIRMED', 'CANCELED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_purchases_folio`   (`folio` ASC)       VISIBLE,
  INDEX `idx_purchases_user`          (`user_id` ASC)     VISIBLE,
  INDEX `idx_purchases_event`         (`event_id` ASC)    VISIBLE,
  INDEX `idx_purchases_status`         (`status` ASC)       VISIBLE,
  INDEX `idx_purchases_created_at`    (`created_at` ASC)  VISIBLE,
  CONSTRAINT `fk_purchases_user`
    FOREIGN KEY (`user_id`)  REFERENCES `nextticket`.`users` (`id`),
  CONSTRAINT `fk_purchases_event`
    FOREIGN KEY (`event_id`) REFERENCES `nextticket`.`events` (`id`),
  CONSTRAINT `chk_purchases_non_negative`
    CHECK (
      `gross_subtotal`  >= 0 AND
      `discount_amount` >= 0 AND
      `net_subtotal`    >= 0 AND
      `tax_amount`      >= 0 AND
      `total`           >= 0
    ),
  CONSTRAINT `chk_purchases_sat_compliance`
    CHECK (`net_subtotal` = `gross_subtotal` - `discount_amount`),
  CONSTRAINT `chk_purchases_financial_equation`
    CHECK (`total` = `net_subtotal` + `tax_amount`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `nextticket`.`purchase_details`
-- [F1] Se añade tax_amount DECIMAL(11,2) NOT NULL DEFAULT 0.00
--   El SAT (CFDI 4.0 Anexo 20) calcula IVA por Concepto, no por cabecera.
--   Sin este campo el backend debe reconstruir la distribución del impuesto
--   al generar el XML, produciendo errores de redondeo de 1-2 centavos
--   que el PAC rechaza en producción.
--   El backend calcula: purchases.tax_amount = SUM(purchase_details.tax_amount)
--
--   El CHECK que propuso Gemini era una tautología:
--     subtotal + tax = final_price * quantity + tax  → siempre verdadero.
--   El constraint correcto es simplemente tax_amount >= 0,
--   ya cubierto por chk_pd_positive_prices extendido.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nextticket`.`purchase_details` (
  `id`                   BINARY(16)    NOT NULL,
  `purchase_id`          BINARY(16)    NOT NULL,
  `event_zone_id`        BINARY(16)    NOT NULL,
  `event_seat_id`        BINARY(16)    NULL DEFAULT NULL,
  `price_tier_id`        BINARY(16)    NULL DEFAULT NULL,
  `promo_code_usage_id`  BINARY(16)    NULL DEFAULT NULL,
  `unit_price`           DECIMAL(11,2) NOT NULL,
  `discount_amount`      DECIMAL(11,2) NOT NULL DEFAULT 0.00,
  `final_price`          DECIMAL(11,2) NOT NULL,
  `tax_amount`           DECIMAL(11,2) NOT NULL DEFAULT 0.00,  -- [F1] IVA por renglón SAT
  `quantity`             INT UNSIGNED  NOT NULL DEFAULT 1,
  `subtotal`             DECIMAL(11,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_pd_purchase_seat`  (`purchase_id` ASC, `event_seat_id` ASC) VISIBLE,
  INDEX `idx_pd_purchase`             (`purchase_id` ASC)          VISIBLE,
  INDEX `idx_pd_event_zone`           (`event_zone_id` ASC)        VISIBLE,
  INDEX `idx_pd_event_seat`           (`event_seat_id` ASC)        VISIBLE,
  INDEX `idx_pd_price_tier`           (`price_tier_id` ASC)        VISIBLE,
  INDEX `idx_pd_promo_usage`          (`promo_code_usage_id` ASC)  VISIBLE,
  CONSTRAINT `chk_pd_quantity_one`
    CHECK (`quantity` = 1),
  CONSTRAINT `fk_pd_purchase`
    FOREIGN KEY (`purchase_id`)         REFERENCES `nextticket`.`purchases` (`id`),
  CONSTRAINT `fk_pd_event_zone`
    FOREIGN KEY (`event_zone_id`)       REFERENCES `nextticket`.`event_zones` (`id`),
  CONSTRAINT `fk_pd_event_seat`
    FOREIGN KEY (`event_seat_id`)       REFERENCES `nextticket`.`event_seats` (`id`),
  CONSTRAINT `fk_pd_price_tier`
    FOREIGN KEY (`price_tier_id`)       REFERENCES `nextticket`.`event_zone_price_tiers` (`id`),
  CONSTRAINT `fk_pd_promo_usage`
    FOREIGN KEY (`promo_code_usage_id`) REFERENCES `nextticket`.`promo_code_usages` (`id`),
  CONSTRAINT `chk_pd_positive_prices`
    CHECK (
      `unit_price`      >= 0 AND
      `discount_amount` >= 0 AND
      `final_price`     >= 0 AND
      `tax_amount`      >= 0 AND  -- [F1]
      `subtotal`        >= 0
    ),
  CONSTRAINT `chk_pd_financial_math`
    CHECK (`final_price` = `unit_price` - `discount_amount`),
  CONSTRAINT `chk_pd_subtotal_math`
    CHECK (`subtotal` = `final_price` * `quantity`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `nextticket`.`payments` (
  `id`                 BINARY(16)    NOT NULL,
  `created_at`         DATETIME(6)   NOT NULL,
  `created_by`         BINARY(16)    NULL DEFAULT NULL,
  `last_modified_by`   BINARY(16)    NULL DEFAULT NULL,
  `updated_at`         DATETIME(6)   NULL DEFAULT NULL,
  `purchase_id`        BINARY(16)    NULL DEFAULT NULL,
  `transfer_id`        BINARY(16)    NULL DEFAULT NULL,
  `amount`             DECIMAL(11,2) NOT NULL,
  `payment_method`     ENUM('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'DIGITAL_WALLET') NOT NULL,
  `external_reference` VARCHAR(100)  NULL DEFAULT NULL,
  `status`              ENUM('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (`id`),
  INDEX `idx_payments_purchase`     (`purchase_id` ASC)    VISIBLE,
  INDEX `idx_payments_transfer`     (`transfer_id` ASC)    VISIBLE,
  INDEX `idx_payments_method`       (`payment_method` ASC) VISIBLE,
  INDEX `idx_payments_status`        (`status` ASC)          VISIBLE,
  CONSTRAINT `fk_payments_purchase`
    FOREIGN KEY (`purchase_id`) REFERENCES `nextticket`.`purchases` (`id`),
  CONSTRAINT `fk_payments_transfer`
    FOREIGN KEY (`transfer_id`) REFERENCES `nextticket`.`ticket_transfers` (`id`),
  CONSTRAINT `chk_payments_single_origin`
    CHECK ((`purchase_id` IS NOT NULL) <> (`transfer_id` IS NOT NULL)),
  CONSTRAINT `chk_payments_positive_amount`
    CHECK (`amount` > 0)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- ═══════════════════════════════════════════════════════════
-- MODULE: TICKETS  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `nextticket`.`tickets` (
  `id`                  BINARY(16)   NOT NULL,
  `created_at`          DATETIME(6)  NOT NULL,
  `created_by`          BINARY(16)   NULL DEFAULT NULL,
  `last_modified_by`    BINARY(16)   NULL DEFAULT NULL,
  `updated_at`          DATETIME(6)  NULL DEFAULT NULL,
  `purchase_id`         BINARY(16)   NULL DEFAULT NULL,
  `purchase_detail_id`  BINARY(16)   NULL DEFAULT NULL,
  `event_seat_id`       BINARY(16)   NULL DEFAULT NULL,
  `event_zone_id`       BINARY(16)   NOT NULL,
  `current_holder_id`   BINARY(16)   NOT NULL,
  `origin_type`         ENUM('PURCHASE', 'COMPLIMENTARY', 'STAFF', 'TRANSFER') NOT NULL DEFAULT 'PURCHASE',
  `folio`               VARCHAR(20)  NOT NULL,
  `qr_code`             VARCHAR(255) NOT NULL,
  `issued_at`           DATETIME(6)  NOT NULL,
  `status`               ENUM('ISSUED', 'USED', 'CANCELED', 'EXPIRED') NOT NULL DEFAULT 'ISSUED',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_tickets_active_purchase_detail`
    ((IF(`status` IN ('ISSUED', 'USED'), `purchase_detail_id`, NULL))) VISIBLE,
  UNIQUE INDEX `uk_tickets_issued_seat`
    ((IF(`status` = 'ISSUED', `event_seat_id`, NULL)))                 VISIBLE,
  UNIQUE INDEX `uk_tickets_folio`            (`folio` ASC)              VISIBLE,
  UNIQUE INDEX `uk_tickets_qr_code`          (`qr_code` ASC)            VISIBLE,
  INDEX `idx_tickets_purchase`               (`purchase_id` ASC)        VISIBLE,
  INDEX `idx_tickets_event_zone`             (`event_zone_id` ASC)      VISIBLE,
  INDEX `idx_tickets_event_seat`             (`event_seat_id` ASC)      VISIBLE,
  INDEX `idx_tickets_current_holder`         (`current_holder_id` ASC)  VISIBLE,
  INDEX `idx_tickets_origin_type`            (`origin_type` ASC)        VISIBLE,
  INDEX `idx_tickets_status`                  (`status` ASC)              VISIBLE,
  INDEX `idx_tickets_issued_at`              (`issued_at` ASC)          VISIBLE,
  CONSTRAINT `fk_tickets_purchase`
    FOREIGN KEY (`purchase_id`)        REFERENCES `nextticket`.`purchases` (`id`),
  CONSTRAINT `fk_tickets_purchase_detail`
    FOREIGN KEY (`purchase_detail_id`) REFERENCES `nextticket`.`purchase_details` (`id`),
  CONSTRAINT `fk_tickets_event_seat`
    FOREIGN KEY (`event_seat_id`)      REFERENCES `nextticket`.`event_seats` (`id`),
  CONSTRAINT `fk_tickets_event_zone`
    FOREIGN KEY (`event_zone_id`)      REFERENCES `nextticket`.`event_zones` (`id`),
  CONSTRAINT `fk_tickets_current_holder`
    FOREIGN KEY (`current_holder_id`)  REFERENCES `nextticket`.`users` (`id`),
  CONSTRAINT `chk_tickets_purchase_detail_required`
    CHECK (`origin_type` <> 'PURCHASE' OR `purchase_detail_id` IS NOT NULL)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- ═══════════════════════════════════════════════════════════
-- MODULE: TRANSFERS
-- [T1] issued_ticket_id añadido
-- ═══════════════════════════════════════════════════════════

-- -----------------------------------------------------
-- Table `nextticket`.`ticket_transfers`
-- [T1] issued_ticket_id BINARY(16) NULL:
--   Rastrea el nuevo QR emitido para el receptor de la transferencia.
--   El backend al completar una transferencia:
--     1. UPDATE tickets SET status='CANCELED' WHERE id = ticket_id (QR original)
--     2. INSERT INTO tickets (origin_type='TRANSFER', ...) → nuevo QR
--     3. UPDATE ticket_transfers SET
--          issued_ticket_id = nuevo_ticket_id,
--          status = 'COMPLETED',
--          completed_at = NOW(6)
--   Así la auditoría puede responder: "¿Cuál fue el nuevo QR de Ana?"
--   con una sola lectura sin joins adicionales.
--   NULL hasta que la transferencia se complete (PENDING/REJECTED/CANCELED).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nextticket`.`ticket_transfers` (
  `id`                BINARY(16)    NOT NULL,
  `created_at`        DATETIME(6)   NOT NULL,
  `created_by`        BINARY(16)    NULL DEFAULT NULL,
  `last_modified_by`  BINARY(16)    NULL DEFAULT NULL,
  `updated_at`        DATETIME(6)   NULL DEFAULT NULL,
  `ticket_id`         BINARY(16)    NOT NULL,             -- QR original (Carlos)
  `issued_ticket_id`  BINARY(16)    NULL DEFAULT NULL,    -- [T1] nuevo QR (Ana); NULL hasta COMPLETED
  `from_user_id`      BINARY(16)    NOT NULL,
  `to_user_id`        BINARY(16)    NOT NULL,
  `transfer_fee`      DECIMAL(11,2) NOT NULL DEFAULT 0.00,
  `completed_at`      DATETIME(6)   NULL DEFAULT NULL,
  `status`             ENUM('PENDING', 'COMPLETED', 'REJECTED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_tt_pending_ticket`
    ((IF(`status` = 'PENDING', `ticket_id`, NULL))) VISIBLE,
  INDEX `idx_tt_ticket`         (`ticket_id` ASC)         VISIBLE,
  INDEX `idx_tt_issued_ticket`  (`issued_ticket_id` ASC)  VISIBLE,  -- [T1]
  INDEX `idx_tt_from_user`      (`from_user_id` ASC)      VISIBLE,
  INDEX `idx_tt_to_user`        (`to_user_id` ASC)        VISIBLE,
  INDEX `idx_tt_status`          (`status` ASC)              VISIBLE,
  CONSTRAINT `fk_tt_ticket`
    FOREIGN KEY (`ticket_id`)        REFERENCES `nextticket`.`tickets` (`id`),
  CONSTRAINT `fk_tt_issued_ticket`                                   -- [T1]
    FOREIGN KEY (`issued_ticket_id`) REFERENCES `nextticket`.`tickets` (`id`),
  CONSTRAINT `fk_tt_from_user`
    FOREIGN KEY (`from_user_id`) REFERENCES `nextticket`.`users` (`id`),
  CONSTRAINT `fk_tt_to_user`
    FOREIGN KEY (`to_user_id`)   REFERENCES `nextticket`.`users` (`id`),
  CONSTRAINT `chk_tt_different_users`
    CHECK (`from_user_id` <> `to_user_id`),
  CONSTRAINT `chk_tt_non_negative_fee`
    CHECK (`transfer_fee` >= 0)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- ═══════════════════════════════════════════════════════════
-- MODULE: REFUNDS  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `nextticket`.`refunds` (
  `id`                 BINARY(16)    NOT NULL,
  `created_at`         DATETIME(6)   NOT NULL,
  `created_by`         BINARY(16)    NULL DEFAULT NULL,
  `last_modified_by`   BINARY(16)    NULL DEFAULT NULL,
  `updated_at`         DATETIME(6)   NULL DEFAULT NULL,
  `ticket_id`          BINARY(16)    NOT NULL,
  `payment_id`         BINARY(16)    NOT NULL,
  `amount`             DECIMAL(11,2) NOT NULL,
  `external_reference` VARCHAR(100)  NULL DEFAULT NULL,
  `reason`             ENUM('CUSTOMER_REQUEST', 'EVENT_CANCELED', 'DUPLICATE_PURCHASE', 'FRAUD') NOT NULL,
  `notes`              VARCHAR(500)  NULL DEFAULT NULL,
  `status`              ENUM('PENDING', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_refunds_pending_ticket`
    ((IF(`status` = 'PENDING', `ticket_id`, NULL))) VISIBLE,
  INDEX `idx_refunds_ticket`  (`ticket_id` ASC)   VISIBLE,
  INDEX `idx_refunds_payment` (`payment_id` ASC)  VISIBLE,
  INDEX `idx_refunds_status`   (`status` ASC)        VISIBLE,
  INDEX `idx_refunds_reason`  (`reason` ASC)       VISIBLE,
  CONSTRAINT `fk_refunds_ticket`
    FOREIGN KEY (`ticket_id`)  REFERENCES `nextticket`.`tickets` (`id`),
  CONSTRAINT `fk_refunds_payment`
    FOREIGN KEY (`payment_id`) REFERENCES `nextticket`.`payments` (`id`),
  CONSTRAINT `chk_refunds_positive_amount`
    CHECK (`amount` > 0)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;


-- ═══════════════════════════════════════════════════════════
-- MODULE: TICKET VALIDATION  (sin cambios vs v11)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `nextticket`.`ticket_validations` (
  `id`               BINARY(16)   NOT NULL,
  `created_at`       DATETIME(6)  NOT NULL,
  `ticket_id`        BINARY(16)   NOT NULL,
  `validator_id`     BINARY(16)   NOT NULL,
  `validated_at`     DATETIME(6)  NOT NULL,
  `result`           TINYINT   	  NOT NULL,
  `rejection_reason` VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_tv_single_entry`
    ((IF(`result` = 1, `ticket_id`, NULL))) VISIBLE,
  INDEX `idx_tv_ticket`       (`ticket_id` ASC)    VISIBLE,
  INDEX `idx_tv_validator`    (`validator_id` ASC)  VISIBLE,
  INDEX `idx_tv_validated_at` (`validated_at` ASC) VISIBLE,
  INDEX `idx_tv_result`       (`result` ASC)        VISIBLE,
  CONSTRAINT `fk_tv_ticket`
    FOREIGN KEY (`ticket_id`)    REFERENCES `nextticket`.`tickets` (`id`),
  CONSTRAINT `fk_tv_validator`
    FOREIGN KEY (`validator_id`) REFERENCES `nextticket`.`users` (`id`),
  CONSTRAINT `chk_tv_rejection_requires_reason`
    CHECK (`result` = 1 OR `rejection_reason` IS NOT NULL),
  CONSTRAINT `chk_tv_success_no_reason`
    CHECK (`result` = 0 OR `rejection_reason` IS NULL)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;