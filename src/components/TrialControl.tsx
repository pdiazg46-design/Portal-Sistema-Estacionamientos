
"use client";

import { useEffect, useState } from "react";
import { getTrialStatus, isOperatorOnly } from "@/lib/actions";
import { useAuth } from "@/lib/AuthContext";

export default function TrialControl({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<{ expired: boolean; daysLeft: number } | null>(null);
    const { user, setUser } = useAuth();
    const [isOperatorMode, setIsOperatorMode] = useState(false);

    useEffect(() => {
        async function check() {
            const res = await getTrialStatus();
            setStatus(res);

            const opOnly = await isOperatorOnly();
            if (opOnly && user && user.role !== "OPERATOR") {
                setIsOperatorMode(true);
                setUser({ ...user, role: "OPERATOR" });
            }
        }
        check();
    }, [user, setUser]);

    if (!status) return null;

    if (status.expired) {
        return (
            <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(15, 23, 42, 0.98)",
                backdropFilter: "blur(10px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 99999,
                color: "white",
                textAlign: "center" as const,
                padding: "40px"
            }}>
                <div style={{ fontSize: "100px", marginBottom: "20px" }}>⌛</div>
                <h1 style={{ fontSize: "48px", fontWeight: "900", marginBottom: "20px" }}>Versión de Prueba Expirada</h1>
                <p style={{ fontSize: "20px", color: "#94a3b8", maxWidth: "600px", lineHeight: "1.6" }}>
                    Tus 15 días de prueba han finalizado. Por favor, contacta al administrador para obtener una licencia completa y continuar utilizando el sistema de gestión de estacionamientos.
                </p>
            </div>
        );
    }

    return (
        <>
            {status.daysLeft <= 3 && (
                <div style={{
                    position: "fixed",
                    top: "20px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--warning)",
                    color: "white",
                    padding: "10px 20px",
                    borderRadius: "12px",
                    fontWeight: "800",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    zIndex: 99998,
                    fontSize: "14px"
                }}>
                    ⚠️ Versión de prueba: Quedan {status.daysLeft} días
                </div>
            )}
            {children}
            {isOperatorMode && (
                <style jsx global>{`
                    .role-selector-container {
                        display: none !important;
                    }
                    .admin-only {
                        display: none !important;
                    }
                `}</style>
            )}
        </>
    );
}
