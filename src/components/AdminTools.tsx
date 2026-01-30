
"use client";

import { useState } from "react";
import { simulateOneMonthData, clearAllRecords } from "@/lib/actions";
import SpotConfigModal from "./SpotConfigModal";

export default function AdminTools() {
    const [loading, setLoading] = useState(false);
    const [showSpotConfig, setShowSpotConfig] = useState(false);

    async function handleSimulate() {
        if (!confirm("Esto generará un mes de datos aleatorios. ¿Continuar?")) return;
        setLoading(true);
        try {
            const res = await simulateOneMonthData();
            alert(`Simulación completada: ${res.count} registros generados.`);
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error en simulación");
        } finally {
            setLoading(false);
        }
    }

    async function handleClear() {
        if (!confirm("¿Seguro que deseas borrar TODOS los registros del historial? Esta acción no se puede deshacer.")) return;
        setLoading(true);
        try {
            await clearAllRecords();
            alert("Historial limpiado.");
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error al limpiar");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "flex", gap: "10px" }}>
            {/* Simulation and Clear buttons hidden by request to avoid accidental data loss */}
            {/* 
            <button
                onClick={handleSimulate}
                disabled={loading}
                style={{
                    padding: "6px 12px",
                    background: "#6366f1",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    opacity: loading ? 0.6 : 1
                }}
            >
                {loading ? "..." : "🧪 Simular 1 Mes"}
            </button>
            <button
                onClick={handleClear}
                disabled={loading}
                style={{
                    padding: "6px 12px",
                    background: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    opacity: loading ? 0.6 : 1
                }}
            >
                {loading ? "..." : "🗑️ Limpiar Historial"}
            </button>
            */}
            <a
                href="/reports"
                style={{
                    padding: "6px 12px",
                    background: "var(--primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center"
                }}
            >
                📊 Ver Reportes
            </a>

            <button
                onClick={() => setShowSpotConfig(true)}
                disabled={loading}
                style={{
                    padding: "6px 12px",
                    background: "#0ea5e9",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    opacity: loading ? 0.6 : 1
                }}
            >
                ⚙️ Inventario
            </button>

            {showSpotConfig && (
                <SpotConfigModal onClose={() => setShowSpotConfig(false)} />
            )}
        </div>
    );
}
