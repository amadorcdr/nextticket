-- CreateIndex
-- Un PurchaseDetail nunca puede tener más de un Ticket emitido (protección
-- anti-doble-emisión / doble-compra). Postgres permite múltiples NULL en un
-- índice único, así que los tickets COMPLIMENTARY/STAFF (purchaseDetailId
-- NULL) no se ven afectados.
CREATE UNIQUE INDEX "Ticket_purchaseDetailId_key" ON "Ticket"("purchaseDetailId");
