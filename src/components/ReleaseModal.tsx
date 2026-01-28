
"use client";

import { useState } from "react";

type ReleaseModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onRelease: () => Promise<{ success: boolean; cost: number; durationInSeconds: number; entryTime?: Date | null; exitTime?: Date | null }>;
    spot: {
        code: string;
        type: string;
        ownerName?: string;
        ownerPhone?: string;
        currentPlate?: string;
    };
    initialResult?: { cost: number; durationInSeconds: number; isHistory?: boolean; entryTime?: Date | string | null; exitTime?: Date | string | null } | null;
    chargingEnabled?: boolean;
};

export default function ReleaseModal({ isOpen, onClose, onRelease, spot, initialResult, chargingEnabled }: ReleaseModalProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ cost: number; durationInSeconds: number; isHistory?: boolean; entryTime?: Date | string | null; exitTime?: Date | string | null } | null>(initialResult || null);

    if (!isOpen) return null;

    const handleRelease = async () => {
        setLoading(true);
        const data = await onRelease();
        if (data.success) {
            setResult({
                cost: data.cost,
                durationInSeconds: data.durationInSeconds,
                entryTime: data.entryTime,
                exitTime: data.exitTime
            });
        } else {
            onClose();
        }
        setLoading(false);
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
    };

    const formatDateTime = (date: Date | string | null | undefined) => {
        if (!date) return "-";
        const d = typeof date === "string" ? new Date(date) : date;
        return d.toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const styles = {
        overlay: {
            position: "fixed" as const,
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(5px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000,
            padding: "40px 20px",
            overflowY: "auto" as const
        },
        modal: {
            backgroundColor: "white",
            padding: "32px",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "450px",
            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.2)",
            textAlign: "center" as const,
            position: "relative" as const,
            margin: "auto"
        },
        header: {
            fontSize: "20px",
            fontWeight: "800",
            color: result ? "var(--success)" : "#dc2626",
            margin: "0 0 16px 0"
        },
        code: {
            fontSize: "32px",
            fontWeight: "900",
            color: "var(--primary)",
            margin: "12px 0"
        },
        infoCard: {
            background: "#f8fafc",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            textAlign: "left" as const,
            marginBottom: "20px"
        },
        infoRow: {
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "8px",
            fontSize: "14px"
        },
        label: { color: "#64748b", fontWeight: "600" },
        value: { color: "#1e293b", fontWeight: "700" },
        plateBadge: {
            background: "#fee2e2",
            color: "#dc2626",
            padding: "6px 16px",
            borderRadius: "8px",
            fontWeight: "900",
            fontFamily: "monospace",
            fontSize: "20px",
            display: "inline-block",
            marginTop: "6px",
            letterSpacing: "1px"
        },
        costBadge: {
            background: "#dcfce7",
            color: "#166534",
            padding: "12px 24px",
            borderRadius: "12px",
            fontWeight: "900",
            fontSize: "32px",
            display: "inline-block",
            marginTop: "10px",
            border: "2px solid #bbf7d0"
        },
        auditBox: {
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid #e2e8f0",
            fontSize: "13px",
            color: "#64748b",
            textAlign: "left" as const
        },
        actions: {
            display: "flex",
            gap: "12px",
            marginTop: "8px"
        },
        btnRelease: {
            padding: "12px 24px",
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "800",
            fontSize: "15px",
            flex: 1,
            boxShadow: "0 2px 0 rgba(0,0,0,0.1)"
        },
        btnCancel: {
            padding: "12px 24px",
            background: "#f1f5f9",
            color: "#475569",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "700",
            fontSize: "15px",
            flex: 1
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal} className="animate-fade-in">
                {result ? (
                    <>
                        <h3 style={{ ...styles.header, color: result.isHistory ? "var(--primary)" : "var(--success)" }}>
                            {result.isHistory ? "Detalle de Cobro" : "¡Salida Exitosa!"}
                        </h3>
                        <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>
                            {result.isHistory ? `Registro histórico para ${spot.code}` : `Resumen de Cobro para ${spot.code}`}
                        </div>

                        <div style={styles.infoCard}>
                            <div style={styles.infoRow}>
                                <span style={styles.label}>Vehículo:</span>
                                <span style={styles.value}>{spot.currentPlate}</span>
                            </div>
                            <div style={styles.infoRow}>
                                <span style={styles.label}>Tiempo Uso:</span>
                                <span style={styles.value}>{formatDuration(result.durationInSeconds)}</span>
                            </div>

                            <div style={styles.auditBox}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                    <span>📅 Ingreso:</span>
                                    <span style={{ fontSize: "14px", fontWeight: "900", color: "#1e293b" }}>{formatDateTime(result.entryTime)}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                    <span>🏁 Salida:</span>
                                    <span style={{ fontSize: "14px", fontWeight: "900", color: "#1e293b" }}>{formatDateTime(result.exitTime)}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontStyle: "italic", fontSize: "12px", color: "#64748b" }}>
                                    <span>🕒 Reporte generado:</span>
                                    <span style={{ fontWeight: "600" }}>{formatDateTime(new Date())}</span>
                                </div>
                            </div>

                            {chargingEnabled && (
                                <div style={{ ...styles.infoRow, flexDirection: "column", alignItems: "center", marginTop: "16px", borderTop: "1px dashed #cbd5e1", paddingTop: "16px" }}>
                                    <span style={styles.label}>TOTAL A COBRAR:</span>
                                    <div style={styles.costBadge}>
                                        ${result.cost.toLocaleString('es-CL')}
                                    </div>
                                    <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "8px" }}>* Redondeo Chileno Aplicado</div>
                                </div>
                            )}
                        </div>

                        <button type="button" onClick={onClose} style={{ ...styles.btnCancel, width: "100%", background: "var(--primary)", color: "white", fontWeight: "800" }}>
                            Finalizar y Cerrar
                        </button>
                    </>
                ) : (
                    <>
                        <h3 style={styles.header}>Estado de Ocupación</h3>
                        <div style={styles.code}>{spot.code}</div>

                        <div style={styles.infoCard}>
                            <div style={styles.infoRow}>
                                <span style={styles.label}>Tipo de Sitio:</span>
                                <span style={styles.value}>{spot.type === "RESERVED" ? "ABONADO" : "GENERAL"}</span>
                            </div>
                            {spot.type === "RESERVED" && (
                                <div style={styles.infoRow}>
                                    <span style={styles.label}>Asignado a:</span>
                                    <span style={styles.value}>{spot.ownerName || "Desconocido"}</span>
                                </div>
                            )}
                            <div style={{ ...styles.infoRow, flexDirection: "column", alignItems: "center", marginTop: "16px", borderTop: "1px dashed #cbd5e1", paddingTop: "16px" }}>
                                <span style={styles.label}>Vehículo Detectado:</span>
                                <div style={styles.plateBadge}>{spot.currentPlate || "???"}</div>
                            </div>
                        </div>

                        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px", lineHeight: "1.5" }}>
                            ¿El vehículo se ha retirado? Presione liberar para registrar la salida y calcular cobro.
                        </p>

                        <div style={styles.actions}>
                            <button type="button" onClick={onClose} style={styles.btnCancel}>Cerrar</button>
                            <button type="button" onClick={handleRelease} style={styles.btnRelease} disabled={loading}>
                                {loading ? "Calculando..." : "LIBERAR SITIO"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
