
"use client";

import { useAuth } from "@/lib/AuthContext";
import ChargingToggle from "./ChargingToggle";
import PriceInput from "./PriceInput";
import AdminTools from "./AdminTools";
import BrandingTool from "./BrandingTool";

interface HeaderActionsProps {
    chargingEnabled: boolean;
    currentPrice: number;
    branding: any;
}

export default function HeaderActions({ chargingEnabled, currentPrice, branding }: HeaderActionsProps) {
    const { isAdmin } = useAuth();

    const styles = {
        badge: (enabled: boolean) => ({
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: enabled ? "#f0fdf4" : "#f1f5f9",
            padding: "8px 20px",
            borderRadius: "24px",
            fontSize: "13px",
            fontWeight: "700",
            color: enabled ? "#166534" : "#64748b",
            transition: "all 0.3s ease",
            border: `1px solid ${enabled ? "#bbf7d0" : "#e2e8f0"}`,
            minWidth: "max-content"
        }),
        priceInfo: {
            marginLeft: "12px",
            paddingLeft: "12px",
            borderLeft: "1px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap" as const
        }
    };

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
                <div style={styles.badge(chargingEnabled)}>
                    <span>{chargingEnabled ? "⚡ Sistema de Cobro ACTIVO" : "🛡️ Modo Gestión Gratuita"}</span>
                    {isAdmin && <ChargingToggle enabled={chargingEnabled} />}
                    {chargingEnabled && (
                        <div style={styles.priceInfo}>
                            <span>Tarifa:</span>
                            {isAdmin ? <PriceInput initialPrice={currentPrice} /> : <span style={{ fontWeight: 800 }}>${currentPrice}</span>}
                            <span>/ min</span>
                        </div>
                    )}
                </div>
                {isAdmin && <AdminTools />}
            </div>
            {isAdmin && <BrandingTool branding={branding} />}
        </div>
    );
}
