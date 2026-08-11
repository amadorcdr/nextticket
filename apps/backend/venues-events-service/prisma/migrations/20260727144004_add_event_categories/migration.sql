-- CreateEnum
CREATE TYPE "event_category_status_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED');

-- CreateTable
CREATE TABLE "event_categories" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(255),
    "status" "event_category_status_enum" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_category_assignments" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "event_category_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_event_categories_status" ON "event_categories"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uk_event_categories_name" ON "event_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uk_event_categories_slug" ON "event_categories"("slug");

-- CreateIndex
CREATE INDEX "idx_eca_event" ON "event_category_assignments"("event_id");

-- CreateIndex
CREATE INDEX "idx_eca_category" ON "event_category_assignments"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_event_category_assignment" ON "event_category_assignments"("event_id", "category_id");

-- AddForeignKey
ALTER TABLE "event_category_assignments" ADD CONSTRAINT "event_category_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_category_assignments" ADD CONSTRAINT "event_category_assignments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "event_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
