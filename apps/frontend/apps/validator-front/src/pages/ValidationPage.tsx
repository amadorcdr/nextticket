import { useState } from "react";
import { Alert, Button, Card, EmptyState, Icon, Router, Separator, Tabs } from "@nextticket-frontend/commons";
import { EventSummaryCard } from "../components/EventSummaryCard";
import { FolioValidationForm } from "../components/FolioValidationForm";
import { QrValidationPanel } from "../components/QrValidationPanel";
import { ValidationResultCard } from "../components/ValidationResultCard";
import { useSelectedEvent } from "../context/SelectedEventContext";
import type { ValidationResult } from "../types/validatorTickets";

type ValidationMethod = "qr" | "folio";

function NoEventSelected({ onBack }: { onBack: () => void }) {
    return (
        <EmptyState className="py-16">
            <div className="flex flex-col items-center gap-4 text-center">
                <Icon.TicketX className="size-10! text-muted" />
                <div className="flex flex-col gap-1">
                    <h3>No hay evento seleccionado</h3>
                    <p className="text-muted max-w-md">
                        Para validar boletos primero elige un evento disponible desde la lista.
                    </p>
                </div>
                <Button onPress={onBack}>
                    <Icon.ArrowLeft />
                    Volver a eventos
                </Button>
            </div>
        </EmptyState>
    );
}

export function ValidationPage() {
    const navigate = Router.useNavigate();
    const { selectedEvent, clearEvent } = useSelectedEvent();

    const [method, setMethod] = useState<ValidationMethod>("qr");
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<ValidationResult | null>(null);
    const [serviceError, setServiceError] = useState<string | null>(null);

    function handleChangeEvent() {
        clearEvent();
        navigate("/validator");
    }

    function handleMethodChange(next: ValidationMethod) {
        setMethod(next);
        setResult(null);
        setServiceError(null);
    }

    function handleValidate(next: ValidationResult) {
        setServiceError(null);
        setResult(next);
    }

    function handleServiceError(message: string) {
        setResult(null);
        setServiceError(message);
    }

    if (!selectedEvent) {
        return <NoEventSelected onBack={() => navigate("/validator")} />;
    }

    return (
        <div className="flex flex-col gap-6 pb-4 max-w-4xl mx-auto w-full">
            <header className="flex flex-col gap-1">
                <h1 className="text-2xl md:text-3xl">Validación · {selectedEvent.name}</h1>
                <p className="text-muted">
                    Escanea el código QR o captura el folio del boleto para verificar el acceso.
                </p>
            </header>

            <EventSummaryCard event={selectedEvent} onChangeEvent={handleChangeEvent} />

            <Card variant="default">
                <Card.Header>
                    <Card.Title className="text-base">Método de validación</Card.Title>
                    <Card.Description>
                        Elige cómo quieres verificar el boleto del asistente.
                    </Card.Description>
                </Card.Header>

                <Card.Content className="flex flex-col gap-4">
                    <Tabs
                        aria-label="Método de validación"
                        variant="secondary"
                        selectedKey={method}
                        onSelectionChange={(key) => handleMethodChange(key as ValidationMethod)}
                    >
                        <Tabs.ListContainer className="w-fit">
                            <Tabs.List>
                                <Tabs.Tab id="qr" className="flex items-center gap-2">
                                    <Icon.QrCode className="size-4" />
                                    <span>Validar por QR</span>
                                    <Tabs.Indicator className="rounded-full" />
                                </Tabs.Tab>
                                <Tabs.Tab id="folio" className="flex items-center gap-2">
                                    <Icon.Hash className="size-4" />
                                    <span>Validar por folio</span>
                                    <Tabs.Indicator className="rounded-full" />
                                </Tabs.Tab>
                            </Tabs.List>
                        </Tabs.ListContainer>

                        <Tabs.Panel id="qr" className="pt-4">
                            <QrValidationPanel
                                event={selectedEvent}
                                isProcessing={isProcessing}
                                result={result}
                                onProcessingChange={setIsProcessing}
                                onValidate={handleValidate}
                                onServiceError={handleServiceError}
                            />
                        </Tabs.Panel>

                        <Tabs.Panel id="folio" className="pt-4">
                            <FolioValidationForm
                                event={selectedEvent}
                                isProcessing={isProcessing}
                                onProcessingChange={setIsProcessing}
                                onValidate={handleValidate}
                                onServiceError={handleServiceError}
                            />
                        </Tabs.Panel>
                    </Tabs>

                    <Separator />

                    {serviceError ? (
                        <Alert status="danger">
                            <Alert.Indicator>
                                <Icon.WifiOff />
                            </Alert.Indicator>
                            <Alert.Content>
                                <Alert.Title>Error de servicio</Alert.Title>
                                <Alert.Description>{serviceError}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : result ? (
                        <ValidationResultCard
                            result={result}
                            onValidateAnother={() => setResult(null)}
                        />
                    ) : (
                        <p className="text-sm text-muted flex items-center gap-2">
                            <Icon.Info className="size-4 shrink-0" />
                            El resultado de la validación aparecerá aquí.
                        </p>
                    )}
                </Card.Content>
            </Card>
        </div>
    );
}
