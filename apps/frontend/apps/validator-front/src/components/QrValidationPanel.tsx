import { useState } from "react";
import { Button, Description, Icon, Label, Spinner } from "@nextticket-frontend/commons";
import { QR_SIMULATION_OPTIONS, validateFolio, type ValidationResult } from "../mocks/validatorTickets";

interface QrValidationPanelProps {
    isProcessing: boolean;
    onValidate: (result: ValidationResult) => void;
    onProcessingChange: (isProcessing: boolean) => void;
}

/**
 * Lector QR simulado: no accede a la cámara ni usa librerías de escaneo.
 * El resultado se resuelve con los folios mock.
 */
export function QrValidationPanel({
    isProcessing,
    onValidate,
    onProcessingChange,
}: QrValidationPanelProps) {
    const [simulation, setSimulation] = useState(QR_SIMULATION_OPTIONS[0].id);

    function handleScan() {
        const option = QR_SIMULATION_OPTIONS.find((item) => item.id === simulation);
        if (!option) return;

        onProcessingChange(true);
        window.setTimeout(() => {
            onValidate(validateFolio(option.folio, "qr"));
            onProcessingChange(false);
        }, 900);
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Área visual que simula el lector */}
            <div className="mx-auto w-full max-w-xs">
                <div className="relative aspect-square rounded-[10px] border-2 border-dashed border-border bg-surface-secondary flex flex-col items-center justify-center gap-3 overflow-hidden">
                    {isProcessing ? (
                        <>
                            <Spinner size="lg" />
                            <span className="text-sm text-muted">Leyendo código…</span>
                            <span className="absolute inset-x-6 h-0.5 bg-accent/70 animate-pulse" />
                        </>
                    ) : (
                        <>
                            <Icon.QrCode className="size-16! text-muted" />
                            <span className="text-sm text-muted text-center px-6">
                                Coloca el código QR del boleto frente al lector
                            </span>
                        </>
                    )}

                    <span className="absolute top-3 left-3 size-6 border-t-2 border-l-2 border-accent/60 rounded-tl-[6px]" />
                    <span className="absolute top-3 right-3 size-6 border-t-2 border-r-2 border-accent/60 rounded-tr-[6px]" />
                    <span className="absolute bottom-3 left-3 size-6 border-b-2 border-l-2 border-accent/60 rounded-bl-[6px]" />
                    <span className="absolute bottom-3 right-3 size-6 border-b-2 border-r-2 border-accent/60 rounded-br-[6px]" />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <Label>Resultado a simular</Label>
                <div className="flex flex-wrap gap-2">
                    {QR_SIMULATION_OPTIONS.map((option) => (
                        <Button
                            key={option.id}
                            size="sm"
                            variant={simulation === option.id ? "primary" : "secondary"}
                            isDisabled={isProcessing}
                            onPress={() => setSimulation(option.id)}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>
                <Description>
                    El lector es una simulación visual: elige qué resultado quieres reproducir.
                </Description>
            </div>

            <Button fullWidth isDisabled={isProcessing} onPress={handleScan}>
                {isProcessing ? <Spinner size="sm" color="current" /> : <Icon.ScanLine />}
                {isProcessing ? "Escaneando…" : "Simular escaneo"}
            </Button>
        </div>
    );
}
