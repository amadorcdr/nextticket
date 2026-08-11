import React from "react";
import { CloseButton, Drawer } from "@heroui/react";

export interface PanelProps {
    isOpen: boolean;
    onOpenChange: (val: boolean) => void;
    isDrawer?: boolean;
    placement: "left" | "right";
    width?: string;
    className?: string;
    margin?: number;
    children: React.ReactNode;
}

export function Panel({
    isOpen,
    onOpenChange,
    isDrawer,
    placement,
    width = "w-[276px]",
    className = "",
    margin = 8,
    children,
}: PanelProps) {

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
            className={`transition-[width,margin] duration-500 ease-in-out shadow-surface bg-surface overflow-hidden shrink-0 rounded-[10px] ${isOpen ? width : "w-0"}`}
            style={{ [placement === "left" ? "marginRight" : "marginLeft"]: isOpen ? margin : 0 }}
            inert={!isOpen ? true : undefined}
        >
            <div className={`${width} h-full ${className} flex flex-col overflow-y-auto relative`}>

                {children}
            </div>
        </aside>
    );
}
