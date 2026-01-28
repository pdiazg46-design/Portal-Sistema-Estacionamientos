
"use client";

import { useState, useEffect } from "react";
import { getReportData } from "@/lib/actions";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function ReportsPage() {
    const { role } = useAuth();
    const today = new Date();
    const [startDate, setStartDate] = useState(today.toISOString().split("T")[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"VISITS" | "SUBSCRIBERS">("VISITS");

    const [rangeType, setRangeType] = useState("today");

    useEffect(() => {
        fetchData();
    }, [startDate, endDate]);

    async function fetchData() {
        setLoading(true);
        try {
            const result = await getReportData(startDate, endDate);
            setData(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const applyRange = (type: string) => {
        setRangeType(type);
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (type) {
            case "today":
                // Already at today/now
                break;
            case "this_week":
                const day = now.getDay();
                start.setDate(now.getDate() - day + (day === 0 ? -6 : 1)); // Monday
                break;
            case "this_month":
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case "last_month":
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case "quarter":
                const q = Math.floor(now.getMonth() / 3);
                start = new Date(now.getFullYear(), q * 3, 1);
                break;
            case "semester":
                start = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
                break;
            case "year":
                start = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                return;
        }

        setStartDate(start.toISOString().split("T")[0]);
        setEndDate(end.toISOString().split("T")[0]);
    };

    if (!data && loading) return <div style={{ padding: "100px", textAlign: "center", fontSize: "24px", color: "var(--primary)", fontWeight: "800" }}>📊 Procesando Análisis Estadístico...</div>;

    const summary = data?.summary || {};

    const exportToCSV = () => {
        if (!data?.dailyRevenue) return;

        const isCharging = data.chargingEnabled && role === "ADMIN";
        const headers = isCharging
            ? ["Fecha", "Vehículos", "Ingresos (CLP)"]
            : ["Fecha", "Vehículos"];

        const rows = data.dailyRevenue.map((item: any) => isCharging
            ? [item.day, item.entries, item.revenue]
            : [item.day, item.entries]
        );

        const csvContent = [
            headers.join(","),
            ...rows.map((r: any) => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_estacionamiento_${startDate}_${endDate}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }} className="animate-fade-in">
            <header style={{ marginBottom: "40px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <Link href="/" style={{ textDecoration: "none", color: "var(--primary)", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", marginBottom: "15px" }}>
                            ← Volver al Panel
                        </Link>
                        <h1 style={{ margin: 0, color: "var(--primary)", fontSize: "36px", fontWeight: "900", letterSpacing: "-1px" }}>
                            {role === "ADMIN" ? "Inteligencia de Estacionamientos" : "Reporte de Operaciones"}
                        </h1>
                        <p style={{ color: "#64748b", margin: "5px 0 0 0", fontSize: "16px" }}>
                            {data.chargingEnabled && role === "ADMIN"
                                ? "Reporte avanzado de flujo vehicular y rendimiento económico"
                                : "Reporte avanzado de flujo vehicular y rendimiento operativo"}
                        </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
                        <div style={{ display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "10px", gap: "2px" }}>
                            <select
                                value={rangeType}
                                onChange={(e) => applyRange(e.target.value)}
                                style={{ ...styles.dateInput, border: "none", background: "white", minWidth: "160px" }}
                            >
                                <option value="today">📅 Hoy ({today.toLocaleDateString('es-CL')})</option>
                                <option value="custom">Rango Personalizado</option>
                                <option value="this_week">Esta Semana</option>
                                <option value="this_month">Mes en Curso</option>
                                <option value="last_month">Mes Anterior</option>
                                <option value="quarter">Este Trimestre</option>
                                <option value="semester">Este Semestre</option>
                                <option value="year">Año {today.getFullYear()}</option>
                            </select>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setRangeType("custom") }} style={styles.dateInput} />
                            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setRangeType("custom") }} style={styles.dateInput} />
                        </div>
                    </div>
                </div>
            </header>

            {/* Numerical Summary */}
            <div style={styles.statsGrid}>
                {data.chargingEnabled && role === "ADMIN" && (
                    <>
                        <ReportCard
                            title="Ingresos Totales"
                            value={`$${summary.totalRevenue?.toLocaleString('es-CL')}`}
                            icon="💰"
                            color="#059669"
                            subtitle={summary.subscriptionRevenue > 0
                                ? `$${summary.timeRevenue?.toLocaleString('es-CL')} Visitas + $${summary.subscriptionRevenue?.toLocaleString('es-CL')} Suscripciones`
                                : "Venta neta del periodo"
                            }
                        />
                        <ReportCard
                            title="Ingresos por Abonados"
                            value={`$${summary.subscriptionRevenue?.toLocaleString('es-CL')}`}
                            icon="👤"
                            color="#0ea5e9"
                            subtitle="Cuotas mensuales prorrateadas"
                        />
                    </>
                )}
                <ReportCard title="Total Ingresos (Veh)" value={summary.totalEntries} icon="🚗" color="#2563eb" subtitle="Flujo total de vehículos" />
                {data.chargingEnabled && role === "ADMIN" && <ReportCard title="Ticket Promedio (Visita)" value={`$${Math.round(summary.avgRevenuePerEntry || 0).toLocaleString('es-CL')}`} icon="📈" color="#7c3aed" subtitle="En base a ingresos por tiempo" />}
                <ReportCard title="Estadía Promedio" value={formatDuration(summary.avgStaySeconds)} icon="⏱️" color="#db2777" subtitle="Tiempo de uso medio" />
            </div>

            <div style={{ marginTop: "40px" }}>
                <div style={{ display: "flex", gap: "20px", marginBottom: "20px", borderBottom: "2px solid #f1f5f9" }}>
                    <button
                        onClick={() => setActiveTab("VISITS")}
                        style={{
                            padding: "12px 20px",
                            border: "none",
                            background: "none",
                            fontSize: "16px",
                            fontWeight: "800",
                            color: activeTab === "VISITS" ? "var(--primary)" : "#94a3b8",
                            borderBottom: activeTab === "VISITS" ? "3px solid var(--primary)" : "3px solid transparent",
                            cursor: "pointer",
                            transition: "all 0.2s"
                        }}
                    >
                        🚗 Detalle de Visitas ({data.visitsList?.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab("SUBSCRIBERS")}
                        style={{
                            padding: "12px 20px",
                            border: "none",
                            background: "none",
                            fontSize: "16px",
                            fontWeight: "800",
                            color: activeTab === "SUBSCRIBERS" ? "var(--primary)" : "#94a3b8",
                            borderBottom: activeTab === "SUBSCRIBERS" ? "3px solid var(--primary)" : "3px solid transparent",
                            cursor: "pointer",
                            transition: "all 0.2s"
                        }}
                    >
                        👤 Abonados Activos ({data.subscribersList?.length || 0})
                    </button>
                </div>

                {activeTab === "VISITS" ? (
                    <div style={styles.chartContainer}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                            <h3 style={styles.chartTitle}>📋 Registro de Operaciones Diarias</h3>
                            <button onClick={exportToCSV} style={styles.btnExcel}>📥 Exportar Visitas</button>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Patente</th>
                                        <th style={styles.th}>Sitio</th>
                                        <th style={styles.th}>Ingreso</th>
                                        <th style={styles.th}>Salida</th>
                                        <th style={styles.th}>Duración</th>
                                        <th style={styles.th}>Cobro</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.visitsList?.map((v: any, idx: number) => (
                                        <tr key={idx} style={styles.tr}>
                                            <td style={{ ...styles.td, fontWeight: "900", fontFamily: "monospace" }}>{v.licensePlate}</td>
                                            <td style={styles.td}>{v.spotCode}</td>
                                            <td style={styles.td}>{formatDateTime(v.entryTime)}</td>
                                            <td style={styles.td}>{v.exitTime ? formatDateTime(v.exitTime) : "En Sitio"}</td>
                                            <td style={styles.td}>{v.exitTime ? formatDuration((new Date(v.exitTime).getTime() - new Date(v.entryTime).getTime()) / 1000) : "-"}</td>
                                            <td style={{ ...styles.td, fontWeight: "800", color: "var(--success)" }}>${(v.cost || 0).toLocaleString('es-CL')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div style={styles.chartContainer}>
                        <h3 style={{ ...styles.chartTitle, marginBottom: "20px" }}>💳 Detalle de Suscripciones (Control Cruzado)</h3>
                        <div style={{ overflowX: "auto" }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Abonado</th>
                                        <th style={styles.th}>PatentePrincipal</th>
                                        <th style={styles.th}>Sitio Asignado</th>
                                        <th style={styles.th}>Cuota Mensual</th>
                                        <th style={styles.th}>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.subscribersList?.map((s: any, idx: number) => (
                                        <tr key={idx} style={styles.tr}>
                                            <td style={{ ...styles.td, fontWeight: "700" }}>{s.name || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin Asignar</span>}</td>
                                            <td style={{ ...styles.td, fontFamily: "monospace" }}>{s.plate || "-"}</td>
                                            <td style={styles.td}>{s.spotCode}</td>
                                            <td style={{ ...styles.td, fontWeight: "800", color: "var(--primary)" }}>${(s.monthlyFee || 0).toLocaleString('es-CL')}</td>
                                            <td style={styles.td}>
                                                {s.name ? (
                                                    <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>ACTIVO</span>
                                                ) : (
                                                    <span style={{ background: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "800" }}>VACANTE</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

function ReportCard({ title, value, icon, color, subtitle }: any) {
    return (
        <div style={{ background: "white", padding: "24px", borderRadius: "16px", boxShadow: "var(--shadow)", borderTop: `4px solid ${color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{title}</div>
                    <div style={{ fontSize: "32px", fontWeight: "950", color: "#1e293b", letterSpacing: "-1px" }}>{value}</div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", marginTop: "4px" }}>{subtitle}</div>
                </div>
                <div style={{ fontSize: "28px", background: "#f8fafc", padding: "12px", borderRadius: "12px" }}>{icon}</div>
            </div>
        </div>
    );
}

function DistributionItem({ label, value, total, color }: any) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div style={{ marginBottom: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "700", marginBottom: "5px" }}>
                <span>{label}</span>
                <span style={{ color }}>{value} ({pct.toFixed(1)}%)</span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color }}></div>
            </div>
        </div>
    );
}

function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

const styles = {
    dateInput: {
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        fontSize: "14px",
        fontWeight: "600",
        color: "#1e293b",
        outline: "none"
    },
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "20px"
    },
    chartContainer: {
        background: "white",
        padding: "30px",
        borderRadius: "20px",
        boxShadow: "var(--shadow)"
    },
    chartTitle: {
        margin: 0,
        fontSize: "16px",
        fontWeight: "800",
        color: "#1e293b"
    },
    barChartWrapper: {
        height: "250px",
        display: "flex",
        alignItems: "flex-end",
        gap: "8px",
        marginTop: "30px",
        paddingBottom: "20px",
        borderBottom: "2px solid #f1f5f9"
    },
    barItem: {
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "flex-end",
        alignItems: "center",
        gap: "8px"
    },
    bar: {
        width: "100%",
        background: "linear-gradient(to top, var(--primary), #3b82f6)",
        borderRadius: "4px 4px 0 0",
        minHeight: "4px",
        transition: "height 1s ease-out"
    },
    barLabel: {
        fontSize: "9px",
        fontWeight: "700",
        color: "#94a3b8",
        transform: "rotate(-45deg)",
        whiteSpace: "nowrap" as const
    },
    barDate: {
        fontSize: "10px",
        fontWeight: "800",
        color: "#64748b"
    },
    table: {
        width: "100%",
        borderCollapse: "collapse" as const,
        fontSize: "13px"
    },
    th: {
        textAlign: "left" as const,
        padding: "12px",
        background: "#f8fafc",
        color: "#64748b",
        fontWeight: "700",
        borderBottom: "2px solid #f1f5f9"
    },
    tr: {
        borderBottom: "1px solid #f1f5f9"
    },
    td: {
        padding: "12px",
        color: "#1e293b"
    },
    btnExcel: {
        padding: "8px 16px",
        background: "#059669",
        color: "white",
        border: "none",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: "700",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px"
    }
};

function formatDateTime(date: Date | string | null | undefined) {
    if (!date) return "-";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
