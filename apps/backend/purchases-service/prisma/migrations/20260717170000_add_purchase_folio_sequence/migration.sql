-- Sequential folio for confirmed purchases (Purchase.folio BIGINT UNIQUE).
-- Managed outside schema.prisma: Prisma cannot model standalone sequences.
CREATE SEQUENCE IF NOT EXISTS "purchase_folio_seq" START WITH 1000;
