import { useState } from "react";
import {
    Button,
    Description,
    Icon,
    Input,
    Label,
    Router,
    Separator,
    TextField,
    useCart,
} from "@nextticket-frontend/commons";

function formatPrice(value: number) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
    }).format(value);
}

/** Duración del pago simulado, para que se vea el estado de carga. */
const FAKE_PAYMENT_MS = 1200;

export function Checkout() {
    const navigate = Router.useNavigate();
    const { event, seats, subtotal, serviceFee, total } = useCart();
    const [isProcessing, setIsProcessing] = useState(false);

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

    const handleSubmit = (formEvent: React.FormEvent) => {
        formEvent.preventDefault();
        setIsProcessing(true);

        // Pago simulado: no hay pasarela todavía.
        window.setTimeout(() => {
            navigate("/checkout/confirmacion");
        }, FAKE_PAYMENT_MS);
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
                <div>
                    <h2>Checkout</h2>
                    <p className="text-muted md:text-sm text-xs">
                        Revisa tu compra y confirma
                    </p>
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
                            <TextField isRequired name="firstName" defaultValue="Juan">
                                <Label>Nombre</Label>
                                <Input />
                            </TextField>
                            <TextField isRequired name="lastName" defaultValue="Pérez García">
                                <Label>Apellidos</Label>
                                <Input />
                            </TextField>
                            <TextField
                                isRequired
                                name="email"
                                type="email"
                                defaultValue="juan.perez@ejemplo.com"
                                className="sm:col-span-2"
                            >
                                <Label>Correo electrónico</Label>
                                <Input />
                            </TextField>
                            <TextField
                                name="phone"
                                type="tel"
                                defaultValue="+52 55 1234 5678"
                                className="sm:col-span-2"
                            >
                                <Label>Teléfono</Label>
                                <Input />
                            </TextField>
                        </div>
                    </div>

                    <Separator />

                    <div className="flex flex-col gap-4">
                        <div>
                            <h4>Pago</h4>
                            <Description>
                                Cobro simulado: no se procesa ningún cargo real
                            </Description>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <TextField
                                isRequired
                                name="cardholder"
                                defaultValue="JUAN PEREZ"
                                className="sm:col-span-2"
                            >
                                <Label>Nombre en la tarjeta</Label>
                                <Input />
                            </TextField>
                            <TextField
                                isRequired
                                name="cardNumber"
                                defaultValue="4242 4242 4242 4242"
                                className="sm:col-span-2"
                            >
                                <Label>Número de tarjeta</Label>
                                <Input />
                            </TextField>
                            <TextField isRequired name="expiry" defaultValue="12/30">
                                <Label>Vencimiento</Label>
                                <Input />
                            </TextField>
                            <TextField isRequired name="cvv" defaultValue="123">
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
                                            Fila {seat.row} · Asiento {seat.number}
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
