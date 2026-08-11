import { useEffect, useMemo, useState } from "react";
import {
    Button,
    Chip,
    Description,
    Icon,
    Router,
    Separator,
    useCart,
} from "@nextticket-frontend/commons";

function formatPrice(value: number) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
    }).format(value);
}

/** Mismo formato de folio que emite tickets-service: TK-XXXXXXXX. */
function buildFolio() {
    return `TK-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

export function CheckoutConfirmation() {
    const navigate = Router.useNavigate();
    const { event, seats, total, clear } = useCart();

    /*
     * Se congela el resumen al montar: en cuanto se vacía el carrito, el
     * contexto ya no tiene los datos y la pantalla debe seguir mostrándolos.
     */
    const [summary] = useState(() =>
        event && seats.length > 0
            ? { event, seats, total, folio: buildFolio() }
            : null,
    );

    const seatLabels = useMemo(
        () =>
            summary?.seats
                .map((seat) => `${seat.row}${seat.number}`)
                .join(" • ") ?? "",
        [summary],
    );

    useEffect(() => {
        if (summary) clear();
        // Solo al montar: la compra ya se cerró.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!summary) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Icon.ReceiptText className="size-8 text-muted" />
                <h4>No hay una compra reciente</h4>
                <p className="text-muted md:text-sm text-xs">
                    Cuando completes una compra, aquí verás tu confirmación.
                </p>
                <Button variant="secondary" onPress={() => navigate("/eventos")}>
                    <Icon.ArrowLeft />
                    Ver eventos
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-6 py-6 pb-10">
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
                    <Icon.Check className="size-6 text-success" />
                </div>
                <h2>¡Compra confirmada!</h2>
                <p className="text-muted md:text-sm text-xs">
                    Te enviamos los boletos a tu correo. También los encuentras en
                    Mis boletos.
                </p>
            </div>

            <div className="w-full max-w-xl rounded-[10px] bg-surface shadow-surface p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                    <Description>Folio</Description>
                    <Chip variant="soft" size="sm">
                        {summary.folio}
                    </Chip>
                </div>

                <Separator />

                <div className="flex gap-3">
                    <img
                        src={summary.event.imageUrl}
                        alt={summary.event.title}
                        className="size-16 rounded-[10px] object-cover shrink-0"
                    />
                    <div className="min-w-0">
                        <h4 className="line-clamp-2">{summary.event.title}</h4>
                        <p className="text-xs text-muted truncate">
                            {summary.event.date} • {summary.event.time} hrs
                        </p>
                        <p className="text-xs text-muted truncate">
                            {summary.event.venue}, {summary.event.city}
                        </p>
                    </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Description>Asientos</Description>
                        <p className="md:text-sm text-xs">{seatLabels}</p>
                    </div>
                    <div>
                        <Description>Zona</Description>
                        <p className="md:text-sm text-xs">{summary.seats[0].zone}</p>
                    </div>
                    <div>
                        <Description>Boletos</Description>
                        <p className="md:text-sm text-xs">{summary.seats.length}</p>
                    </div>
                    <div>
                        <Description>Total pagado</Description>
                        <p className="md:text-sm text-xs font-semibold">
                            {formatPrice(summary.total)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
                <Button onPress={() => navigate("/mis-boletos")}>
                    <Icon.Ticket />
                    Ver mis boletos
                </Button>
                <Button variant="secondary" onPress={() => navigate("/eventos")}>
                    Seguir explorando
                </Button>
            </div>
        </div>
    );
}
