
"use client";

import { useState } from "react";
import { toggleSpotType, updateSpotMonthlyFee } from "@/lib/actions";

export default function SpotAdminModal({
    spot,
    onClose,
    onOpenAssignment
}: {
    spot: any,
    onClose: () => void,
    onOpenAssignment: () => void
}) {
    const [fee, setFee] = useState(spot.monthlyFee || 0);
    const [loading, setLoading] = useState(false);

    async function handleToggleType() {
        if (spot.isOccupied) {
            alert("No se puede cambiar el tipo de un sitio ocupado.");
            return;
        }
        setLoading(true);
        await toggleSpotType(spot.id);
        window.location.reload();
    }

    const formatValue = (val: number | string) => {
        if (val === "" || val === 0) return "";
        const num = typeof val === "string" ? parseInt(val.replace(/\./g, "")) : val;
        if (isNaN(num)) return "";
        return num.toLocaleString("es-CL");
    };

    const handleFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\./g, "");
        const numValue = parseInt(rawValue);
        if (!isNaN(numValue) || rawValue === "") {
            setFee(numValue || 0);
        }
    };

    async function handleSaveFee() {
        setLoading(true);
        await updateSpotMonthlyFee(spot.id, fee);
        setLoading(false);
        alert("Tarifa mensual actualizada.");
    }

    return (
        <div style={modalStyles.overlay}>
            <div style={modalStyles.container} className="animate-scale-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h2 style={{ margin: 0, color: "var(--primary)", fontWeight: "900" }}>⚙️ Configurar Sitio {spot.code}</h2>
                    <button onClick={onClose} style={modalStyles.closeBtn}>✕</button>
                </div>

                <div style={modalStyles.section}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={modalStyles.label}>Tipo de Sitio</div>
                            <div style={{ ...modalStyles.value, color: spot.type === "RESERVED" ? "#0369a1" : "#166534" }}>
                                {spot.type === "RESERVED" ? "👤 Reservado / Abonado" : "🚗 General / Público"}
                            </div>
                        </div>
                        <button
                            onClick={handleToggleType}
                            disabled={loading || spot.isOccupied}
                            style={{
                                ...modalStyles.actionBtn,
                                opacity: spot.isOccupied ? 0.5 : 1,
                                background: spot.type === "RESERVED" ? "#f1f5f9" : "#e0f2fe",
                                color: spot.type === "RESERVED" ? "#64748b" : "#0369a1"
                            }}
                        >
                            Cambiar a {spot.type === "RESERVED" ? "General" : "Reservado"}
                        </button>
                    </div>
                </div>

                {spot.type === "RESERVED" ? (
                    <>
                        <div style={modalStyles.section}>
                            <div style={modalStyles.label}>Tarifa Mensual (Suscripción)</div>
                            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                                <div style={modalStyles.inputWrapper}>
                                    <span style={{ color: "#94a3b8", fontWeight: "800" }}>$</span>
                                    <input
                                        type="text"
                                        value={formatValue(fee)}
                                        onChange={handleFeeChange}
                                        style={modalStyles.input}
                                        placeholder="0"
                                    />
                                </div>
                                <button
                                    onClick={handleSaveFee}
                                    disabled={loading}
                                    style={{ ...modalStyles.actionBtn, background: "var(--primary)", color: "white" }}
                                >
                                    Guardar Tarifa
                                </button>
                            </div>
                        </div>

                        <div style={{ ...modalStyles.section, border: "none" }}>
                            <div style={modalStyles.label}>Gestión de Abonado</div>
                            <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 12px 0" }}>
                                {spot.ownerName ? `Asignado a: ${spot.ownerName}` : "Este sitio no tiene un abonado asignado todavía."}
                            </p>
                            <button
                                onClick={() => { onClose(); onOpenAssignment(); }}
                                style={{ ...modalStyles.actionBtn, width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", color: "var(--primary)" }}
                            >
                                {spot.isOccupied ? "🏁 Ver Detalle de Ocupación" : (spot.ownerName ? "📝 Editar Asignación" : "👤 Asignar Nuevo Abonado")}
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ ...modalStyles.section, border: "none" }}>
                        <div style={modalStyles.label}>Operaciones de Tráfico</div>
                        <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 12px 0" }}>
                            {spot.isOccupied ? `Ocupado por patente ${spot.currentPlate}` : "Sitio libre para uso de público general."}
                        </p>
                        <button
                            onClick={() => { onClose(); onOpenAssignment(); }}
                            style={{
                                ...modalStyles.actionBtn,
                                width: "100%",
                                background: spot.isOccupied ? "var(--error)" : "var(--success)",
                                color: "white"
                            }}
                        >
                            {spot.isOccupied ? "🏁 Registrar Salida / Cobro" : "🚗 Registrar Entrada Manual"}
                        </button>
                    </div>
                )}

                <div style={{ marginTop: "20px", textAlign: "center" }}>
                    <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#94a3b8", fontWeight: "700", cursor: "pointer" }}>
                        Cerrar Ventana
                    </button>
                </div>
            </div>
        </div>
    );
}

const modalStyles = {
    overlay: {
        position: "fixed" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 15000
    },
    container: {
        background: "white",
        padding: "30px",
        borderRadius: "24px",
        width: "100%",
        maxWidth: "400px",
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
    },
    closeBtn: {
        background: "none",
        border: "none",
        fontSize: "20px",
        color: "#94a3b8",
        cursor: "pointer"
    },
    section: {
        padding: "16px 0",
        borderBottom: "1px solid #f1f5f9"
    },
    label: {
        fontSize: "12px",
        fontWeight: "800",
        color: "#94a3b8",
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px"
    },
    value: {
        fontSize: "16px",
        fontWeight: "700",
        marginTop: "4px"
    },
    inputWrapper: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: "5px",
        background: "#f8fafc",
        padding: "0 12px",
        borderRadius: "10px",
        border: "1px solid #e2e8f0"
    },
    input: {
        width: "100%",
        padding: "10px 0",
        background: "transparent",
        border: "none",
        outline: "none",
        fontSize: "16px",
        fontWeight: "700",
        color: "#1e293b"
    },
    actionBtn: {
        padding: "10px 16px",
        borderRadius: "10px",
        border: "none",
        fontWeight: "800",
        fontSize: "13px",
        cursor: "pointer",
        transition: "all 0.2s"
    }
};
