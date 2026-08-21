import React, { useState, useEffect } from "react";
import { Drawer, ScrollShadow, AlertDialog, Button, Switch, Description, Label, Select } from "@heroui/react";

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export interface SmartPanelProps {
  isOpen: boolean;
  onOpenChange: (val: boolean) => void;
  isDesktop: boolean;
  placement: "left" | "right";
  width?: string;
  className?: string;
  children: React.ReactNode;
}

export function SmartPanel({
  isOpen,
  onOpenChange,
  isDesktop,
  placement,
  width = "w-[276px]",
  className = "bg-surface shadow-surface",
  children,
}: SmartPanelProps) {
  const isLeft = placement === "left";
  const marginSide = isOpen
    ? (isLeft ? "mr-2" : "ml-2")
    : "mx-0";

  if (!isDesktop) {
    return (
      <Drawer.Backdrop
        variant="blur"
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      >
        <Drawer.Content placement={placement}>
          <Drawer.Dialog aria-label="Panel lateral">
            <Drawer.CloseTrigger />
            <Drawer.Body className="p-4">{children}</Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    );
  }

  return (
    <div className={`relative transition-[width,min-width,margin] duration-500 ease-in-out shrink-0 h-full ${isOpen ? width : "w-0 min-w-0"} ${marginSide}`}>
      <aside
        inert={!isOpen ? true : undefined}
        className={`pointer-events-auto absolute top-0 ${isLeft ? "left-0" : "right-0"} ${width} h-full ${className} rounded-[10px] flex flex-col overflow-hidden transition-transform duration-500 ease-in-out ${isOpen
          ? "translate-x-0"
          : (isLeft ? "-translate-x-[calc(100%+28px)]" : "translate-x-[calc(100%+28px)]")
          }`}
      >
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

export interface ConfirmAlertDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  status?: "default" | "accent" | "success" | "warning" | "danger";
}

export function ConfirmAlertDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  status = "danger",
}: ConfirmAlertDialogProps) {
  const animationClasses = {
    backdrop: [
      "data-[entering]:duration-400",
      "data-[entering]:ease-[cubic-bezier(0.16,1,0.3,1)]",
      "data-[exiting]:duration-200",
      "data-[exiting]:ease-[cubic-bezier(0.7,0,0.84,0)]",
    ].join(" "),
    container: [
      "data-[entering]:animate-in",
      "data-[entering]:fade-in-0",
      "data-[entering]:zoom-in-95",
      "data-[entering]:duration-400",
      "data-[entering]:ease-[cubic-bezier(0.16,1,0.3,1)]",
      "data-[exiting]:animate-out",
      "data-[exiting]:fade-out-0",
      "data-[exiting]:zoom-out-95",
      "data-[exiting]:duration-200",
      "data-[exiting]:ease-[cubic-bezier(0.7,0,0.84,0)]",
    ].join(" "),
  };

  return (
    <AlertDialog>
      <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} className={animationClasses.backdrop}>
        <AlertDialog.Container className={animationClasses.container} size="sm">
          <AlertDialog.Dialog className="p-6">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header className="p-0">
              <AlertDialog.Icon status={status} />
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-muted">{description}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary" onPress={() => onOpenChange(false)}>
                {cancelText}
              </Button>
              <Button slot="close" variant={status === "danger" ? "danger" : "primary"} onPress={() => {
                onConfirm();
                onOpenChange(false);
              }}>
                {confirmText}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

type DynamicProp<T, V = boolean> = T | ((newVal: V) => T);

export interface ConfirmSwitchProps {
  isSelected: boolean;
  onChange: (val: boolean) => void;
  confirmWhen?: "turning-off" | "turning-on" | "always";
  title: DynamicProp<string>;
  description: DynamicProp<string>;
  confirmText?: DynamicProp<string>;
  cancelText?: DynamicProp<string>;
  status?: DynamicProp<"default" | "accent" | "success" | "warning" | "danger">;
  size?: "sm" | "md" | "lg";
}

export function ConfirmSwitch({
  isSelected,
  onChange,
  confirmWhen = "turning-off",
  title,
  description,
  confirmText,
  cancelText,
  status,
  size = "md"
}: ConfirmSwitchProps) {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [pendingVal, setPendingVal] = useState<boolean | null>(null);
  const [lastPendingVal, setLastPendingVal] = useState<boolean>(false);

  const handleChange = (newVal: boolean) => {
    const needsConfirm =
      (confirmWhen === "always") ||
      (confirmWhen === "turning-off" && !newVal) ||
      (confirmWhen === "turning-on" && newVal);

    if (needsConfirm) {
      setPendingVal(newVal);
      setLastPendingVal(newVal);
      setIsAlertOpen(true);
    } else {
      onChange(newVal);
    }
  };

  const handleConfirm = () => {
    if (pendingVal !== null) {
      onChange(pendingVal);
      setPendingVal(null);
    }
  };

  const resolveProp = <T,>(prop: DynamicProp<T> | undefined, val: boolean, fallback?: T): T | undefined => {
    if (typeof prop === "function") {
      return (prop as Function)(val);
    }
    return prop !== undefined ? prop : fallback;
  };

  return (
    <>
      <Switch
        size={size}
        isSelected={isSelected}
        onChange={handleChange}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>

      <ConfirmAlertDialog
        isOpen={isAlertOpen}
        onOpenChange={(open) => {
          setIsAlertOpen(open);
          if (!open) setPendingVal(null);
        }}
        title={resolveProp(title, lastPendingVal, "")!}
        description={resolveProp(description, lastPendingVal, "")!}
        confirmText={resolveProp(confirmText, lastPendingVal)}
        cancelText={resolveProp(cancelText, lastPendingVal)}
        onConfirm={handleConfirm}
        status={resolveProp(status, lastPendingVal)}
      />
    </>
  );
}

export interface ConfirmSelectProps {
  value: string;
  onChange: (val: string) => void;
  confirmWhen?: "always" | ((val: string) => boolean);
  title: DynamicProp<string, string>;
  description: DynamicProp<string, string>;
  confirmText?: DynamicProp<string, string>;
  cancelText?: DynamicProp<string, string>;
  status?: DynamicProp<"default" | "accent" | "success" | "warning" | "danger", string>;
  placeholder?: string;
  children: React.ReactNode;
}

export function ConfirmSelect({
  value,
  onChange,
  confirmWhen = "always",
  title,
  description,
  confirmText,
  cancelText,
  status,
  placeholder,
  children
}: ConfirmSelectProps) {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [pendingVal, setPendingVal] = useState<string | null>(null);
  const [lastPendingVal, setLastPendingVal] = useState<string>("");

  const handleChange = (newVal: any) => {
    const needsConfirm = typeof confirmWhen === "function" ? confirmWhen(newVal) : confirmWhen === "always";

    if (needsConfirm) {
      setPendingVal(newVal);
      setLastPendingVal(newVal);
      setIsAlertOpen(true);
    } else {
      onChange(newVal);
    }
  };

  const handleConfirm = () => {
    if (pendingVal !== null) {
      onChange(pendingVal);
      setPendingVal(null);
    }
  };

  const resolveProp = <T,>(prop: DynamicProp<T, string> | undefined, val: string, fallback?: T): T | undefined => {
    if (typeof prop === "function") {
      return (prop as Function)(val);
    }
    return prop !== undefined ? prop : fallback;
  };

  return (
    <>
      <Select
        placeholder={placeholder}
        variant="secondary"
        value={value}
        onChange={handleChange}
      >
        {children}
      </Select>

      <ConfirmAlertDialog
        isOpen={isAlertOpen}
        onOpenChange={(open) => {
          setIsAlertOpen(open);
          if (!open) setPendingVal(null);
        }}
        title={resolveProp(title, lastPendingVal, "")!}
        description={resolveProp(description, lastPendingVal, "")!}
        confirmText={resolveProp(confirmText, lastPendingVal)}
        cancelText={resolveProp(cancelText, lastPendingVal)}
        onConfirm={handleConfirm}
        status={resolveProp(status, lastPendingVal)}
      />
    </>
  );
}