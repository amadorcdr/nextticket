import React from "react";
import { useTheme } from "@heroui/react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useTheme();
    return children
}
