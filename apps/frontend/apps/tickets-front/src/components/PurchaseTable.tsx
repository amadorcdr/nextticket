import { Table } from "@nextticket-frontend/commons";
import type { Purchase, PurchaseStatus } from "../types/adminTickets";

const STATUS_CLASSNAME: Record<PurchaseStatus, string> = {
    completada: "text-success bg-success/10",
    pendiente: "text-warning bg-warning/10",
    cancelada: "text-danger bg-danger/10",
};

const STATUS_LABEL: Record<PurchaseStatus, string> = {
    completada: "Completada",
    pendiente: "Pendiente",
    cancelada: "Cancelada",
};

export function PurchaseTable({ purchases }: { purchases: Purchase[] }) {
    if (purchases.length === 0) {
        return <p className="text-muted text-xs py-4 text-center">Sin compras registradas para este evento.</p>;
    }

    return (
        <Table>
            <Table.ScrollContainer>
                <Table.Content aria-label="Compras recientes" className="min-w-140 text-xs">
                    <Table.Header>
                        <Table.Column isRowHeader id="folio" minWidth={120} className="text-center">
                            Folio
                        </Table.Column>
                        <Table.Column id="buyer" minWidth={160} className="text-center">
                            Comprador
                        </Table.Column>
                        <Table.Column id="quantity" minWidth={90} className="text-center">
                            Cantidad
                        </Table.Column>
                        <Table.Column id="total" minWidth={100} className="text-center">
                            Total
                        </Table.Column>
                        <Table.Column id="purchaseDate" minWidth={110} className="text-center">
                            Fecha
                        </Table.Column>
                        <Table.Column id="status" minWidth={100} className="text-center">
                            Estado
                        </Table.Column>
                    </Table.Header>
                    <Table.Body items={purchases}>
                        {(purchase) => (
                            <Table.Row>
                                <Table.Cell className="text-center font-mono">{purchase.folio}</Table.Cell>
                                <Table.Cell className="text-center">{purchase.buyer}</Table.Cell>
                                <Table.Cell className="text-center">{purchase.quantity}</Table.Cell>
                                <Table.Cell className="text-center">
                                    {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(purchase.total)}
                                </Table.Cell>
                                <Table.Cell className="text-center">{purchase.purchaseDate}</Table.Cell>
                                <Table.Cell className="text-center">
                                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASSNAME[purchase.status]}`}>
                                        {STATUS_LABEL[purchase.status]}
                                    </span>
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}
