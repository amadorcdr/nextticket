import { useEffect, useState } from "react";
import {
    ApiError,
    Button,
    Description,
    Icon,
    Input,
    Label,
    Router,
    Separator,
    TextField,
    clearStoredHold,
    getStoredHold,
    toast,
    useApi,
    useCart,
    useSession,
} from "@nextticket-frontend/commons";
import type { ApiPurchaseResult } from "../types";

/** El backend guarda un solo `name`: se separa en nombre/apellido(s) para prellenar el formulario. */
function splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function formatPrice(value: number) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatCountdown(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** "12/30" -> {month: 12, year: 2030}. Devuelve null si no se puede parsear. */
function parseExpiry(value: string): { month: number; year: number } | null {
    const match = /^(\d{1,2})\s*\/\s*(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    if (month < 1 || month > 12) return null;
    return { month, year };
}

/** Va insertando el "/" solo, conforme se escribe: "0826" -> "08/26". */
function formatExpiryInput(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** La misma regla de "no vencida" que usa purchases-service, pero antes de mandar la petición. */
function isExpiryInThePast(expiry: { month: number; year: number }): boolean {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    return expiry.year < currentYear || (expiry.year === currentYear && expiry.month < currentMonth);
}

export function Checkout() {
    const navigate = Router.useNavigate();
    const api = useApi();
    const { user } = useSession();
    const { event, seats, subtotal, serviceFee, total, clear } = useCart();
    const { firstName, lastName } = splitName(user?.name ?? "");

    const hold = event ? getStoredHold(event.id) : null;

    const [isProcessing, setIsProcessing] = useState(false);
    const [expiryValue, setExpiryValue] = useState("");
    const [remainingMs, setRemainingMs] = useState<number>(() =>
        hold ? new Date(hold.expiresAt).getTime() - Date.now() : 0,
    );

    // Cuenta regresiva del hold: si llega a 0 antes de pagar, los asientos ya
    // se liberaron en el backend y no tiene caso dejar el botón de pago activo.
    useEffect(() => {
        if (!hold) return;

        const interval = window.setInterval(() => {
            setRemainingMs(new Date(hold.expiresAt).getTime() - Date.now());
        }, 1000);

        return () => window.clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hold?.expiresAt]);

    const expired = hold !== null && remainingMs <= 0;

    // Sin asientos no hay nada que cobrar: mandamos de vuelta al catálogo.
    if (!event || seats.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Icon.ShoppingCart className="size-8 text-muted" />
                <h4>Tu carrito está vacío</h4>
                <p className="text-muted md:text-sm text-xs">
                    Elige un evento y selecciona tus asientos para continuar.
                </p>
                <Button variant="secondary" onPress={() => navigate("/eventos")}>
                    <Icon.ArrowLeft />
                    Ver eventos
                </Button>
            </div>
        );
    }

    // Hay asientos en el carrito pero no un hold vigente para ellos (llegó
    // directo a /checkout, o el hold ya expiró): no se puede cobrar sin uno.
    if (!hold || expired) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Icon.TimerOff className="size-8 text-muted" />
                <h4>{expired ? "Se acabó tu tiempo para pagar" : "Tu selección ya no está vigente"}</h4>
                <p className="text-muted md:text-sm text-xs max-w-sm">
                    {expired
                        ? "Tus asientos se liberaron. Vuelve a elegirlos para intentarlo de nuevo."
                        : "No encontramos un bloqueo activo para estos asientos. Vuelve a elegirlos."}
                </p>
                <Button
                    variant="secondary"
                    onPress={() => {
                        clearStoredHold(event.id);
                        clear();
                        navigate(`/event/${event.id}/asientos`);
                    }}
                >
                    <Icon.ArrowLeft />
                    Elegir asientos de nuevo
                </Button>
            </div>
        );
    }

    const handleSubmit = (formEvent: React.FormEvent<HTMLFormElement>) => {
        formEvent.preventDefault();

        const formData = new FormData(formEvent.currentTarget);
        const cardNumber = String(formData.get("cardNumber") ?? "").replace(/\s+/g, "");
        const cardholderName = String(formData.get("cardholder") ?? "").trim();
        const cvv = String(formData.get("cvv") ?? "").trim();
        const expiry = parseExpiry(String(formData.get("expiry") ?? ""));

        if (!cardholderName) {
            toast.danger("Ingresa el nombre en la tarjeta.");
            return;
        }
        if (!/^\d{16}$/.test(cardNumber)) {
            toast.danger("El número de tarjeta debe tener 16 dígitos.");
            return;
        }
        if (!expiry) {
            toast.danger("La fecha de vencimiento no es válida (formato MM/AA).");
            return;
        }
        if (isExpiryInThePast(expiry)) {
            toast.danger("Esa tarjeta ya venció.");
            return;
        }
        if (!/^\d{3,4}$/.test(cvv)) {
            toast.danger("El CVV no es válido.");
            return;
        }

        const details = seats.map((seat) => {
            const held = hold.seatMap[seat.id];
            return {
                eventZoneId: held?.eventZoneId ?? "",
                eventSeatId: held?.eventSeatId ?? undefined,
                unitPrice: held?.unitPrice ?? seat.price,
            };
        });

        if (details.some((detail) => !detail.eventZoneId)) {
            toast.danger("No pudimos identificar la zona de uno de tus asientos. Vuelve a elegirlos.");
            return;
        }

        setIsProcessing(true);

        api
            .post<ApiPurchaseResult>("/purchases", {
                eventId: event.id,
                temporaryBlockIds: hold.blockIds,
                details,
                payment: {
                    paymentMethod: "CREDIT_CARD",
                    cardholderName,
                    cardNumber,
                    expirationMonth: expiry.month,
                    expirationYear: expiry.year,
                    cvv,
                },
            })
            .then((result) => {
                if (!result.paymentResult.approved) {
                    toast.danger(result.paymentResult.message || "Tu pago fue rechazado, intenta con otra tarjeta.");
                    return;
                }

                clearStoredHold(event.id);
                clear();
                navigate("/checkout/confirmacion", { state: result });
            })
            .catch((err) => {
                toast.danger(err instanceof ApiError ? err.message : "No se pudo completar la compra");
            })
            .finally(() => setIsProcessing(false));
    };

    return (
        <div className="flex flex-col gap-4 pb-6">
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => navigate(`/event/${event.id}/asientos`)}
                >
                    <Icon.ArrowLeft />
                </Button>
                <div className="flex-1 min-w-0">
                    <h2>Checkout</h2>
                    <p className="text-muted md:text-sm text-xs">
                        Revisa tu compra y confirma
                    </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1.5 shrink-0">
                    <Icon.Clock className="size-3.5 text-warning" />
                    <span className="text-xs font-medium text-warning">{formatCountdown(remainingMs)}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
                <form
                    id="checkout-form"
                    onSubmit={handleSubmit}
                    className="rounded-[10px] bg-surface shadow-surface p-4 flex flex-col gap-6"
                >
                    <div className="flex flex-col gap-4">
                        <div>
                            <h4>Datos del comprador</h4>
                            <Description>A este correo llegan tus boletos</Description>
                        </div>

                        {/* En HeroUI (react-aria) el valor vive en TextField, no en Input. */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <TextField isRequired name="firstName" defaultValue={firstName}>
                                <Label>Nombre</Label>
                                <Input />
                            </TextField>
                            <TextField isRequired name="lastName" defaultValue={lastName}>
                                <Label>Apellidos</Label>
                                <Input />
                            </TextField>
                            <TextField
                                isRequired
                                name="email"
                                type="email"
                                defaultValue={user?.email ?? ""}
                                className="sm:col-span-2"
                            >
                                <Label>Correo electrónico</Label>
                                <Input />
                            </TextField>
                        </div>
                    </div>

                    <Separator />

                    <div className="flex flex-col gap-4">
                        <div>
                            <h4>Pago</h4>
                            <Description>
                                Pago simulado: usa la tarjeta de prueba 4242 4242 4242 4242 o cambia el número para probar un rechazo
                            </Description>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <TextField isRequired name="cardholder" className="sm:col-span-2">
                                <Label>Nombre en la tarjeta</Label>
                                <Input />
                            </TextField>
                            <TextField isRequired name="cardNumber" className="sm:col-span-2">
                                <Label>Número de tarjeta</Label>
                                <Input />
                            </TextField>
                            <TextField
                                isRequired
                                name="expiry"
                                value={expiryValue}
                                onChange={(v) => setExpiryValue(formatExpiryInput(v))}
                            >
                                <Label>Vencimiento</Label>
                                <Input placeholder="MM/AA" />
                            </TextField>
                            <TextField isRequired name="cvv">
                                <Label>CVV</Label>
                                <Input />
                            </TextField>
                        </div>
                    </div>
                </form>

                <aside className="lg:sticky lg:top-0 lg:self-start flex flex-col gap-4">
                    <div className="rounded-[10px] bg-surface shadow-surface p-4 flex flex-col gap-4">
                        <div className="flex gap-3">
                            <img
                                src={event.imageUrl}
                                alt={event.title}
                                className="size-16 rounded-[10px] object-cover shrink-0"
                            />
                            <div className="min-w-0">
                                <h4 className="line-clamp-2">{event.title}</h4>
                                <p className="text-xs text-muted truncate">
                                    {event.date} • {event.time} hrs
                                </p>
                                <p className="text-xs text-muted truncate">
                                    {event.venue}, {event.city}
                                </p>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-2">
                            {seats.map((seat) => (
                                <div
                                    key={seat.id}
                                    className="flex items-center justify-between gap-2"
                                >
                                    <div className="min-w-0">
                                        <p className="md:text-sm text-xs">
                                            {seat.row === "GA"
                                                ? `Admisión general #${seat.number}`
                                                : `Fila ${seat.row} · Asiento ${seat.number}`}
                                        </p>
                                        <p className="text-xs text-muted truncate">{seat.zone}</p>
                                    </div>
                                    <span className="md:text-sm text-xs shrink-0">
                                        {formatPrice(seat.price)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between md:text-sm text-xs">
                                <span className="text-muted">Subtotal</span>
                                <span>{formatPrice(subtotal)}</span>
                            </div>
                            <div className="flex items-center justify-between md:text-sm text-xs">
                                <span className="text-muted">Cargo por servicio</span>
                                <span>{formatPrice(serviceFee)}</span>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <span className="font-medium">Total</span>
                                <span className="text-lg font-semibold">
                                    {formatPrice(total)}
                                </span>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            form="checkout-form"
                            className="w-full"
                            isDisabled={isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <Icon.LoaderCircle className="animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <Icon.Lock />
                                    Pagar {formatPrice(total)}
                                </>
                            )}
                        </Button>

                        <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
                            <Icon.ShieldCheck className="size-3.5" />
                            Compra protegida
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
