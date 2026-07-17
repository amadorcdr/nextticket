/*
  Warnings:

  - You are about to drop the `Venue` table. If the table is not empty, all the data it contains will be lost.

*/
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

-- DropTable
DROP TABLE "Venue";

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "created_by" UUID,
    "last_modified_by" UUID,
    "updated_at" TIMESTAMP(6),
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
CREATE UNIQUE INDEX "uk_seats_section_id_id" ON "seats"("section_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_seats_section_row_number" ON "seats"("section_id", "row", "number");

-- CreateIndex
CREATE INDEX "idx_ce_floor" ON "canvas_elements"("floor_id");

-- CreateIndex
CREATE INDEX "idx_ce_element_type" ON "canvas_elements"("element_type");

-- CreateIndex
CREATE INDEX "idx_ce_status" ON "canvas_elements"("status");

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
