import { Alert, Button, Icon } from "@nextticket-frontend/commons";
import type { ValidationResult } from "../mocks/validatorTickets";

interface ValidationResultCardProps {
    result: ValidationResult;
    onValidateAnother: () => void;
}

const PRESENTATION = {
    VALID: {
        status: "success" as const,
        title: "Boleto válido",
        description: "Acceso autorizado. Permite el ingreso del asistente.",
        icon: Icon.CircleCheck,
    },
    USED: {
        status: "warning" as const,
        title: "Boleto ya utilizado",
        description: "Este boleto ya registró un acceso y no puede volver a utilizarse.",
        icon: Icon.TriangleAlert,
    },
    INVALID: {
        status: "danger" as const,
        title: "Boleto inválido",
        description: "El boleto no pertenece a este evento o fue cancelado.",
        icon: Icon.CircleX,
    },
    NOT_FOUND: {
        status: "danger" as const,
        title: "Boleto no encontrado",
        description: "No existe ningún boleto registrado con el folio consultado.",
        icon: Icon.CircleX,
    },
};

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted">{label}</span>
            <span className="text-sm font-medium break-words">{value}</span>
        </div>
    );
}

export function ValidationResultCard({ result, onValidateAnother }: ValidationResultCardProps) {
    const presentation = PRESENTATION[result.outcome];
    const ResultIcon = presentation.icon;
    const ticket = result.ticket;

    return (
        <div className="flex flex-col gap-4">
            <Alert status={presentation.status}>
                <Alert.Indicator>
                    <ResultIcon />
                </Alert.Indicator>
                <Alert.Content>
                    <Alert.Title>{presentation.title}</Alert.Title>
                    <Alert.Description>
                        {ticket?.reason ?? presentation.description}
                    </Alert.Description>
                </Alert.Content>
            </Alert>

            <div className="rounded-[10px] bg-surface-secondary p-4 grid grid-cols-2 gap-4">
                <DetailRow label="Folio consultado" value={result.folio} />
                <DetailRow
                    label="Método"
                    value={result.method === "qr" ? "Código QR" : "Folio manual"}
                />

                {result.outcome === "VALID" && ticket ? (
                    <>
                        <DetailRow label="Asistente" value={ticket.attendeeName} />
                        <DetailRow label="Tipo de boleto" value={ticket.ticketType} />
                        <DetailRow label="Zona / sección" value={ticket.section} />
                    </>
                ) : null}

                {result.outcome === "USED" && ticket ? (
                    <>
                        <DetailRow label="Asistente" value={ticket.attendeeName} />
                        <DetailRow label="Hora de uso" value={`Hoy a las ${ticket.usedAt} h`} />
                    </>
                ) : null}
            </div>

            <Button variant="secondary" onPress={onValidateAnother} fullWidth>
                <Icon.RotateCcw />
                Validar otro boleto
            </Button>
        </div>
    );
}
