import { Table } from "@nextticket-frontend/commons";
import type { ZoneSales } from "../types/adminTickets";

export function ZoneDistributionTable({ zones }: { zones: ZoneSales[] }) {
    if (zones.length === 0) {
        return <p className="text-muted text-xs py-4 text-center">Este evento no tiene zonas configuradas.</p>;
    }

    return (
        <Table>
            <Table.ScrollContainer>
                <Table.Content aria-label="Distribución por zona" className="min-w-140 text-xs">
                    <Table.Header>
                        <Table.Column isRowHeader id="zone" minWidth={140} className="text-center">
                            Zona
                        </Table.Column>
                        <Table.Column id="capacity" minWidth={100} className="text-center">
                            Capacidad
                        </Table.Column>
                        <Table.Column id="sold" minWidth={100} className="text-center">
                            Vendidos
                        </Table.Column>
                        <Table.Column id="available" minWidth={100} className="text-center">
                            Disponibles
                        </Table.Column>
                        <Table.Column id="revenue" minWidth={120} className="text-center">
                            Ingreso
                        </Table.Column>
                    </Table.Header>
                    <Table.Body items={zones}>
                        {(zone) => (
                            <Table.Row>
                                <Table.Cell className="text-center font-medium">{zone.zone}</Table.Cell>
                                <Table.Cell className="text-center">{zone.capacity.toLocaleString()}</Table.Cell>
                                <Table.Cell className="text-center">{zone.sold.toLocaleString()}</Table.Cell>
                                <Table.Cell className="text-center">{zone.available.toLocaleString()}</Table.Cell>
                                <Table.Cell className="text-center">
                                    {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(zone.revenue)}
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}
