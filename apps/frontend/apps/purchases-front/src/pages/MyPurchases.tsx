import { useEffect, useState } from "react";
import { ApiError, Button, Chip, Icon, ScrollShadow, useApi } from "@nextticket-frontend/commons";
import type { ApiPurchaseStatus, ApiPurchaseSummary } from "../types";

interface Paginated<T> {
    data: T[];
}

const STATUS_META: Record<ApiPurchaseStatus, { label: string; color: "success" | "warning" | "danger" | "default" }> = {
    PENDING: { label: "Pendiente", color: "warning" },
    CONFIRMED: { label: "Confirmada", color: "success" },
    CANCELED: { label: "Cancelada", color: "danger" },
    REFUNDED: { label: "Reembolsada", color: "default" },
};

function formatPrice(value: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
    }).format(Number(value));
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatFolio(folio: string | number | null) {
    if (folio === null || folio === undefined) return "—";
    return `TK-${folio}`;
}

/** "Mis compras": historial simple, sin filtros ni paginación real (alcanza con las últimas 20 para la demo). */
export function MyPurchases() {
    const api = useApi();

    const [purchases, setPurchases] = useState<ApiPurchaseSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);

        api.get<Paginated<ApiPurchaseSummary>>("/purchases?limit=20")
            .then((res) => setPurchases(res.data))
            .catch((err) => {
                setError(err instanceof ApiError ? err.message : "No se pudieron cargar tus compras");
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    return (
        <div className="flex flex-col h-full">
            <div className="shrink-0">
                <h2>Mis compras</h2>
                <p className="text-muted md:text-sm text-xs">Historial de tus compras confirmadas y pendientes.</p>
            </div>

            <ScrollShadow className="flex-1 overflow-auto md:pt-4 pt-2">
                {loading && <p className="text-muted text-xs py-16 text-center">Cargando compras...</p>}

                {!loading && error && (
                    <div className="flex flex-col items-center gap-3 py-16">
                        <Icon.CircleAlert className="size-8 text-muted" />
                        <p className="text-muted text-xs text-center">{error}</p>
                        <Button size="sm" onPress={load}>
                            Reintentar
                        </Button>
                    </div>
                )}

                {!loading && !error && purchases.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                        <Icon.ReceiptText className="size-8 text-muted" />
                        <h4>Todavía no tienes compras</h4>
                        <p className="text-muted md:text-sm text-xs">
                            Cuando compres boletos, los verás aquí.
                        </p>
                    </div>
                )}

                {!loading && !error && purchases.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {purchases.map((purchase) => {
                            const status = STATUS_META[purchase.status];
                            return (
                                <div
                                    key={purchase.id}
                                    className="flex flex-wrap items-center justify-between gap-3 bg-surface shadow-surface rounded-[10px] p-4"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex size-10 items-center justify-center rounded-full bg-accent/10 shrink-0">
                                            <Icon.ReceiptText className="size-5 text-accent" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="md:text-sm text-xs font-medium truncate">
                                                {formatFolio(purchase.folio)}
                                            </p>
                                            <p className="text-xs text-muted truncate">
                                                {formatDate(purchase.createdAt)} · {purchase.details.length}{" "}
                                                {purchase.details.length === 1 ? "boleto" : "boletos"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="md:text-sm text-xs font-semibold">
                                            {formatPrice(purchase.total)}
                                        </span>
                                        <Chip variant="soft" size="sm" color={status.color}>
                                            {status.label}
                                        </Chip>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ScrollShadow>
        </div>
    );
}
