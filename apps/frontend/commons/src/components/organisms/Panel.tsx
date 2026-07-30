import React from "react";
import { CloseButton, Drawer } from "@heroui/react";

export interface PanelProps {
    isOpen: boolean;
    onOpenChange: (val: boolean) => void;
    isDrawer?: boolean;
    placement: "left" | "right";
    width?: string;
    className?: string;
    children: React.ReactNode;
}

export function Panel({
    isOpen,
    onOpenChange,
    isDrawer,
    placement,
    width = "w-[276px]",
    className = "",
    children,
}: PanelProps) {
    const marginSide = isOpen ? (placement === "left" ? "mr-2" : "ml-2") : "m-0";

    if (isDrawer) {
        return (
            <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
                <Drawer.Content placement={placement}>
                    <Drawer.Dialog className={`p-0 ${width}`}>
                        <Drawer.CloseTrigger />
                        <Drawer.Body className="flex flex-col">{children}</Drawer.Body>
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>
        );
    }

    return (
        <aside
            className={`transition-[width,margin] duration-500 ease-in-out shadow-surface bg-surface overflow-hidden shrink-0 rounded-[10px] ${isOpen ? width : "w-0"} ${marginSide}`}
            inert={!isOpen ? true : undefined}
        >
            <div className={`${width} h-full ${className} flex flex-col overflow-y-auto relative`}>
                <CloseButton className="absolute top-4 right-4 z-50"
                    onPress={() => onOpenChange(false)}
                />
                {children}
            </div>
        </aside>
    );
}
