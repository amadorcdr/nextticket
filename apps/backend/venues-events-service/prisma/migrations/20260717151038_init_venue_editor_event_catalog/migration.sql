-- CreateEnum
CREATE TYPE "venue_status_enum" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'REMOVED');

-- CreateEnum
CREATE TYPE "section_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "seat_type_enum" AS ENUM ('STANDARD', 'VIP', 'PREMIUM', 'ACCESSIBLE');

-- CreateEnum
CREATE TYPE "seat_status_enum" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'OUT_OF_SERVICE', 'REMOVED');

-- CreateEnum
CREATE TYPE "canvas_element_type_enum" AS ENUM ('STAGE', 'SCREEN', 'SPEAKER', 'ENTRANCE', 'EXIT', 'CORRIDOR', 'BATHROOM', 'BAR', 'TEXT', 'SHAPE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELED', 'SOLD_OUT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('RESERVED', 'GENERAL');

-- CreateEnum
CREATE TYPE "EventZoneStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "PriceTierStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXHAUSTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EventSeatStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'DISABLED');

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "last_modified_by" UUID,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100),
    "country" VARCHAR(100) NOT NULL DEFAULT 'Mexico',
    "total_capacity" INTEGER NOT NULL,
    "description" VARCHAR(500),
    "status" "venue_status_enum" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "level_index" INTEGER NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "capacity" INTEGER NOT NULL,
    "status" "section_status_enum" NOT NULL DEFAULT 'ACTIVE',
    "color" VARCHAR(7),
    "prefix" VARCHAR(20),
    "coordinate_x" INTEGER,
    "coordinate_y" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "rotation_degrees" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "is_ellipse" BOOLEAN NOT NULL DEFAULT false,
    "geometry_points" JSONB,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "row" VARCHAR(10) NOT NULL,
    "number" VARCHAR(10) NOT NULL,
    "type" "seat_type_enum" NOT NULL DEFAULT 'STANDARD',
    "coordinate_x" INTEGER,
    "coordinate_y" INTEGER,
    "status" "seat_status_enum" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_elements" (
    "id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "element_type" "canvas_element_type_enum" NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(7),
    "coordinate_x" INTEGER NOT NULL,
    "coordinate_y" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "rotation_degrees" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "is_ellipse" BOOLEAN NOT NULL DEFAULT false,
    "geometry_points" JSONB,
    "border_radius" INTEGER,

    CONSTRAINT "canvas_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "last_modified_by" UUID,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "venue_id" UUID NOT NULL,
    "organizer_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "starts_at" TIMESTAMP(6) NOT NULL,
    "ends_at" TIMESTAMP(6) NOT NULL,
    "image_url" VARCHAR(500),
    "description" VARCHAR(1000),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_zones" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "last_modified_by" UUID,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "event_id" UUID NOT NULL,
    "public_name" VARCHAR(100) NOT NULL,
    "admission_type" "AdmissionType" NOT NULL DEFAULT 'RESERVED',
    "event_price" DECIMAL(11,2) NOT NULL,
    "available_capacity" INTEGER NOT NULL,
    "map_color" VARCHAR(7),
    "max_tickets_per_purchase" INTEGER NOT NULL DEFAULT 10,
    "status" "EventZoneStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "event_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_zone_price_tiers" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "last_modified_by" UUID,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "event_zone_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price" DECIMAL(11,2) NOT NULL,
    "initial_capacity" INTEGER,
    "available_capacity" INTEGER,
    "starts_at" TIMESTAMP(6),
    "ends_at" TIMESTAMP(6),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "PriceTierStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "event_zone_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_zone_sections" (
    "id" UUID NOT NULL,
    "event_zone_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,

    CONSTRAINT "event_zone_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_seats" (
    "id" UUID NOT NULL,
    "event_zone_id" UUID NOT NULL,
    "seat_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "locked_until" TIMESTAMP(6),
    "status" "EventSeatStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "event_seats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_venues_status" ON "venues"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uk_venues_name_city" ON "venues"("name", "city");

-- CreateIndex
CREATE INDEX "idx_floors_venue" ON "floors"("venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_floors_venue_level" ON "floors"("venue_id", "level_index");

-- CreateIndex
CREATE INDEX "idx_sections_venue" ON "sections"("venue_id");

-- CreateIndex
CREATE INDEX "idx_sections_floor" ON "sections"("floor_id");

-- CreateIndex
CREATE INDEX "idx_sections_status" ON "sections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uk_sections_venue_name" ON "sections"("venue_id", "name");

-- CreateIndex
CREATE INDEX "idx_seats_status" ON "seats"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uk_seats_section_row_number" ON "seats"("section_id", "row", "number");

-- CreateIndex
CREATE UNIQUE INDEX "uk_seats_section_id_id" ON "seats"("section_id", "id");

-- CreateIndex
CREATE INDEX "idx_ce_floor" ON "canvas_elements"("floor_id");

-- CreateIndex
CREATE INDEX "idx_ce_element_type" ON "canvas_elements"("element_type");

-- CreateIndex
CREATE INDEX "idx_ce_status" ON "canvas_elements"("status");

-- CreateIndex
CREATE INDEX "idx_events_venue" ON "events"("venue_id");

-- CreateIndex
CREATE INDEX "idx_events_organizer" ON "events"("organizer_id");

-- CreateIndex
CREATE INDEX "idx_events_status" ON "events"("status");

-- CreateIndex
CREATE INDEX "idx_events_starts_at" ON "events"("starts_at");

-- CreateIndex
CREATE INDEX "idx_event_zones_event" ON "event_zones"("event_id");

-- CreateIndex
CREATE INDEX "idx_event_zones_admission_type" ON "event_zones"("admission_type");

-- CreateIndex
CREATE INDEX "idx_event_zones_status" ON "event_zones"("status");

-- CreateIndex
CREATE INDEX "idx_price_tiers_zone" ON "event_zone_price_tiers"("event_zone_id");

-- CreateIndex
CREATE INDEX "idx_price_tiers_status" ON "event_zone_price_tiers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uk_price_tiers_zone_order" ON "event_zone_price_tiers"("event_zone_id", "sort_order");

-- CreateIndex
CREATE INDEX "idx_ezs_event_zone" ON "event_zone_sections"("event_zone_id");

-- CreateIndex
CREATE INDEX "idx_ezs_section" ON "event_zone_sections"("section_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ezs_zone_section" ON "event_zone_sections"("event_zone_id", "section_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_ezs_event_section" ON "event_zone_sections"("event_id", "section_id");

-- CreateIndex
CREATE INDEX "idx_event_seats_event_zone" ON "event_seats"("event_zone_id");

-- CreateIndex
CREATE INDEX "idx_event_seats_section" ON "event_seats"("section_id");

-- CreateIndex
CREATE INDEX "idx_event_seats_status" ON "event_seats"("status");

-- CreateIndex
CREATE INDEX "idx_event_seats_locked_until" ON "event_seats"("locked_until");

-- CreateIndex
CREATE UNIQUE INDEX "uk_event_seats_zone_seat" ON "event_seats"("event_zone_id", "seat_id");

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_elements" ADD CONSTRAINT "canvas_elements_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_zones" ADD CONSTRAINT "event_zones_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_zone_price_tiers" ADD CONSTRAINT "event_zone_price_tiers_event_zone_id_fkey" FOREIGN KEY ("event_zone_id") REFERENCES "event_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_zone_sections" ADD CONSTRAINT "event_zone_sections_event_zone_id_fkey" FOREIGN KEY ("event_zone_id") REFERENCES "event_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_zone_sections" ADD CONSTRAINT "event_zone_sections_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_zone_sections" ADD CONSTRAINT "event_zone_sections_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_event_zone_id_fkey" FOREIGN KEY ("event_zone_id") REFERENCES "event_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_event_zone_id_section_id_fkey" FOREIGN KEY ("event_zone_id", "section_id") REFERENCES "event_zone_sections"("event_zone_id", "section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_section_id_seat_id_fkey" FOREIGN KEY ("section_id", "seat_id") REFERENCES "seats"("section_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
