import { Button, Chip, Description, Icon, Router, Separator } from "@nextticket-frontend/commons";
import type { ApiPurchaseResult } from "../types";

function formatPrice(value: string | number) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
    }).format(Number(value));
}

function formatFolio(folio: string | number | null) {
    if (folio === null || folio === undefined) return "—";
    return `TK-${folio}`;
}

export function CheckoutConfirmation() {
    const navigate = Router.useNavigate();
    const location = Router.useLocation();

    // El resultado de la compra viaja por el state de navegación (no por
    // CartProvider, que ya se vació al llegar aquí): si el usuario refresca
    // esta pantalla, el state se pierde y se muestra el estado vacío, que es
    // el comportamiento esperado — no hay nada que "recuperar" sin volver a
    // consultar el backend, y no vale la pena para una pantalla de recibo.
    const purchase = (location.state ?? null) as ApiPurchaseResult | null;

    if (!purchase) {
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
                    Ya puedes ver tus boletos en Mis boletos.
                </p>
            </div>

            <div className="w-full max-w-xl rounded-[10px] bg-surface shadow-surface p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                    <Description>Folio</Description>
                    <Chip variant="soft" size="sm">
                        {formatFolio(purchase.folio)}
                    </Chip>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Description>Boletos</Description>
                        <p className="md:text-sm text-xs">{purchase.tickets.length}</p>
                    </div>
                    <div>
                        <Description>Total pagado</Description>
                        <p className="md:text-sm text-xs font-semibold">
                            {formatPrice(purchase.total)}
                        </p>
                    </div>
                </div>

                {purchase.tickets.length > 0 && (
                    <>
                        <Separator />
                        <div className="flex flex-col gap-2">
                            {purchase.tickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className="flex items-center justify-between gap-2 rounded-[10px] bg-surface-secondary px-3 py-2"
                                >
                                    <span className="md:text-sm text-xs font-medium">{ticket.folio}</span>
                                    <Chip variant="soft" size="sm" color="success">
                                        {ticket.status}
                                    </Chip>
                                </div>
                            ))}
                        </div>
                    </>
                )}
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
