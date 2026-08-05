import { useState, type FormEvent } from "react";
import {
    Button,
    Description,
    FieldError,
    Icon,
    Input,
    Label,
    Spinner,
    TextField,
} from "@nextticket-frontend/commons";
import { validateFolio, type ValidationResult } from "../mocks/validatorTickets";

interface FolioValidationFormProps {
    isProcessing: boolean;
    onValidate: (result: ValidationResult) => void;
    onProcessingChange: (isProcessing: boolean) => void;
}

/** Validación por folio resuelta contra los boletos mock, sin peticiones HTTP. */
export function FolioValidationForm({
    isProcessing,
    onValidate,
    onProcessingChange,
}: FolioValidationFormProps) {
    const [folio, setFolio] = useState("");
    const [error, setError] = useState<string | null>(null);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!folio.trim()) {
            setError("Ingresa un folio para continuar.");
            return;
        }

        setError(null);
        onProcessingChange(true);
        window.setTimeout(() => {
            onValidate(validateFolio(folio, "folio"));
            onProcessingChange(false);
        }, 700);
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <TextField
                value={folio}
                onChange={(value) => {
                    setFolio(value);
                    if (error) setError(null);
                }}
                isInvalid={Boolean(error)}
                isDisabled={isProcessing}
                autoComplete="off"
                fullWidth
            >
                <Label>Folio del boleto</Label>
                <Input placeholder="Ej. VALIDO001" className="font-mono uppercase" />
                <Description>
                    Escribe el folio impreso en el boleto. Puedes probar con VALIDO001, USADO001 o
                    INVALIDO001.
                </Description>
                <FieldError>{error}</FieldError>
            </TextField>

            <Button type="submit" fullWidth isDisabled={isProcessing}>
                {isProcessing ? <Spinner size="sm" color="current" /> : <Icon.TicketCheck />}
                {isProcessing ? "Validando…" : "Validar folio"}
            </Button>
        </form>
    );
}
