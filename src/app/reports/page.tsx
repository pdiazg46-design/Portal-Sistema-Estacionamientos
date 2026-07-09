"use client";

import { useState, useEffect } from "react";
import { getReportData } from "@/lib/actions";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function ReportsPage() {
    const { role, isAdmin } = useAuth();
    const today = new Date();
    const [startDate, setStartDate] = useState(today.toISOString().split("T")[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"VISITS" | "SUBSCRIBERS">("VISITS");
    const [rangeType, setRangeType] = useState("today");
    const [searchPlate, setSearchPlate] = useState("");

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

        if (type === "today") {
            // Default today
        } else if (type === "yesterday") {
            start.setDate(now.getDate() - 1);
            end.setDate(now.getDate() - 1);
        } else if (type === "this_week") {
            const day = now.getDay();
            start.setDate(now.getDate() - day + (day === 0 ? -6 : 1)); // Monday
        } else if (type === "this_month") {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (type === "last_month") {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
        } else if (type === "quarter") {
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1);
        } else if (type === "semester") {
            start = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
        } else if (type.startsWith("year_")) {
            const yr = parseInt(type.split("_")[1]);
            start = new Date(yr, 0, 1);
            end = new Date(yr, 11, 31);
        } else {
            return;
        }

        setStartDate(start.toISOString().split("T")[0]);
        setEndDate(end.toISOString().split("T")[0]);
    };

    if (!data && loading) return <div style={{ padding: "100px", textAlign: "center", fontSize: "24px", color: "var(--primary)", fontWeight: "800" }}>📊 Procesando Análisis Estadístico...</div>;

    const summary = data?.summary || {};
    const showMonetization = data?.chargingEnabled && isAdmin;

    // Filters based on search plate input
    const filteredVisits = data?.visitsList?.filter((v: any) => 
        v.licensePlate.toLowerCase().includes(searchPlate.trim().toLowerCase())
    ) || [];

    const filteredSubscribers = data?.subscribersList?.filter((s: any) => 
        (s.name || "").toLowerCase().includes(searchPlate.trim().toLowerCase()) ||
        (s.plate || "").toLowerCase().includes(searchPlate.trim().toLowerCase())
    ) || [];

    // Critical duration vehicles: still in the lot and parked > 24 hours ago
    const nowTime = new Date();
    const criticalVehicles = data?.visitsList?.filter((v: any) => {
        if (v.exitTime) return false;
        const entry = new Date(v.entryTime);
        const diffHours = (nowTime.getTime() - entry.getTime()) / (1000 * 60 * 60);
        return diffHours >= 24;
    }) || [];

    // Active Hours with traffic logic
    const activeHours = data?.hourlyTraffic?.filter((h: any) => h.count > 0) || [];
    const maxHourCount = Math.max(...(data?.hourlyTraffic?.map((h: any) => h.count) || [1]), 1);

    // Max daily entries count
    const maxDailyEntries = Math.max(...(data?.dailyRevenue?.map((d: any) => d.entries) || [1]), 1);

    const startYear = 2026;
    const currentYear = new Date().getFullYear();
    const yearsList = [];
    for (let y = startYear; y <= currentYear; y++) {
        yearsList.push(y);
    }

    const exportToCSV = () => {
        if (!data?.dailyRevenue) return;

        const headers = showMonetization
            ? ["Fecha", "Vehículos", "Ingresos (CLP)"]
            : ["Fecha", "Vehículos"];

        const rows = data.dailyRevenue.map((item: any) => showMonetization
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
                            {isAdmin ? "Inteligencia de Estacionamientos" : "Reporte de Operaciones"}
                        </h1>
                        <p style={{ color: "#64748b", margin: "5px 0 0 0", fontSize: "16px" }}>
                            {showMonetization
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
                                <option value="yesterday">📅 Ayer</option>
                                <option value="custom">Rango Personalizado</option>
                                <option value="this_week">Esta Semana</option>
                                <option value="this_month">Mes en Curso</option>
                                <option value="last_month">Mes Anterior</option>
                                <option value="quarter">Este Trimestre</option>
                                <option value="semester">Este Semestre</option>
                                {yearsList.map(yr => (
                                    <option key={yr} value={`year_${yr}`}>Año {yr}</option>
                                ))}
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
                {showMonetization && (
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
                {showMonetization && <ReportCard title="Ticket Promedio (Visita)" value={`$${Math.round(summary.avgRevenuePerEntry || 0).toLocaleString('es-CL')}`} icon="📈" color="#7c3aed" subtitle="En base a ingresos por tiempo" />}
                <ReportCard title="Estadía Promedio" value={formatDuration(summary.avgStaySeconds)} icon="⏱️" color="#db2777" subtitle="Tiempo de uso medio" />
            </div>

            {/* License Plate Search Bar */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "white", padding: "16px 20px", borderRadius: "16px", boxShadow: "var(--shadow)", marginBottom: "30px", marginTop: "30px" }}>
                <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--primary)" }}>🔍 BUSCAR POR PATENTE:</span>
                <input
                    type="text"
                    placeholder="Ej: ABC123"
                    value={searchPlate}
                    onChange={e => setSearchPlate(e.target.value)}
                    style={{
                        padding: "8px 12px",
                        border: "2px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        width: "250px",
                        outline: "none",
                        fontWeight: "700"
                    }}
                />
                {searchPlate && (
                    <button 
                        onClick={() => setSearchPlate("")} 
                        style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444", fontWeight: "800", fontSize: "12px" }}
                    >
                        Limpiar Búsqueda
                    </button>
                )}
            </div>

            {/* Custom Management Graphics & Alerts Panel */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginBottom: "40px" }} className="reports-dashboard-grid">
                {/* Traffic Flow Chart Card */}
                <div style={{ background: "white", padding: "24px", borderRadius: "20px", boxShadow: "var(--shadow)" }}>
                    <h3 style={{ margin: "0 0 15px 0", fontSize: "15px", fontWeight: "800", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                        📈 Flujo de Tránsito ({startDate === endDate ? "Tráfico por Hora" : "Tránsito Diario"})
                    </h3>
                    {startDate === endDate ? (
                        activeHours.length > 0 ? (
                            <div style={{ display: "flex", alignItems: "flex-end", height: "180px", gap: "8px", padding: "10px 0" }}>
                                {activeHours.map((h: any) => {
                                    const heightPct = (h.count / maxHourCount) * 100;
                                    return (
                                        <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", minWidth: "22px" }}>
                                            <div style={{ fontSize: "10px", fontWeight: "800", color: "var(--primary)", marginBottom: "2px" }}>{h.count}</div>
                                            <div style={{
                                                width: "12px",
                                                height: `${Math.max(4, heightPct)}%`,
                                                background: "linear-gradient(to top, var(--primary), #3b82f6)",
                                                borderRadius: "4px 4px 0 0"
                                            }} title={`Hora ${h.hour}:00 - ${h.count} vehículos`} />
                                            <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b", marginTop: "4px" }}>{`${String(h.hour).padStart(2, '0')}`}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px", fontWeight: "600" }}>
                                Sin movimientos registrados hoy
                            </div>
                        )
                    ) : (
                        data.dailyRevenue?.length > 0 ? (
                            <div style={{ display: "flex", alignItems: "flex-end", height: "180px", gap: "6px", padding: "10px 0" }}>
                                {data.dailyRevenue.map((d: any) => {
                                    const heightPct = (d.entries / maxDailyEntries) * 100;
                                    const formattedDay = d.day.substring(5);
                                    return (
                                        <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", minWidth: "28px" }}>
                                            <div style={{ fontSize: "10px", fontWeight: "800", color: "var(--primary)", marginBottom: "2px" }}>{d.entries}</div>
                                            <div style={{
                                                width: "14px",
                                                height: `${Math.max(4, heightPct)}%`,
                                                background: "linear-gradient(to top, var(--primary), #10b981)",
                                                borderRadius: "4px 4px 0 0"
                                            }} title={`${d.day}: ${d.entries} vehículos`} />
                                            <div style={{ fontSize: "8px", fontWeight: "700", color: "#64748b", marginTop: "4px", whiteSpace: "nowrap" }}>{formattedDay}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px", fontWeight: "600" }}>
                                Sin movimientos registrados en este periodo
                            </div>
                        )
                    )}
                </div>

                {/* Operations & Alerts Card */}
                <div style={{ background: "white", padding: "24px", borderRadius: "20px", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column" }}>
                    <h3 style={{ margin: "0 0 15px 0", fontSize: "15px", fontWeight: "800", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                        🚨 Alertas de Gestión y Estadía Crítica
                    </h3>
                    <div style={{ flex: 1, overflowY: "auto", maxHeight: "180px" }}>
                        {criticalVehicles.length > 0 ? (
                            criticalVehicles.map((v: any, idx: number) => {
                                const entry = new Date(v.entryTime);
                                const diffHours = Math.round((nowTime.getTime() - entry.getTime()) / (1000 * 60 * 60));
                                return (
                                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "8px", marginBottom: "8px" }}>
                                        <div>
                                            <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "900", background: "#f87171", color: "white", padding: "2px 6px", borderRadius: "4px", marginRight: "8px" }}>
                                                {v.licensePlate}
                                            </span>
                                            <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                                                Sitio: {v.spotCode || "N/A"}
                                            </span>
                                            <div style={{ fontSize: "11px", color: "#7f1d1d", marginTop: "2px", fontWeight: "600" }}>
                                                Ingreso: {formatDateTime(v.entryTime)}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: "12px", fontWeight: "800", color: "#dc2626", background: "#fee2e2", padding: "4px 8px", borderRadius: "6px" }}>
                                            ⚠️ +{diffHours} hrs
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#059669", padding: "20px" }}>
                                <div style={{ fontSize: "28px", marginBottom: "8px" }}>✅</div>
                                <div style={{ fontSize: "13px", fontWeight: "800" }}>Todo en Orden</div>
                                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", textAlign: "center" }}>No hay vehículos sospechosos de abandono (+24 horas sin salida)</div>
                            </div>
                        )}
                    </div>
                </div>
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
                        🚗 Detalle de Visitas ({filteredVisits.length})
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
                        👤 Abonados Activos ({filteredSubscribers.length})
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
                                        {showMonetization && <th style={styles.th}>Cobro</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredVisits.map((v: any, idx: number) => (
                                        <tr key={idx} style={styles.tr}>
                                            <td style={{ ...styles.td, fontWeight: "900", fontFamily: "monospace" }}>{v.licensePlate}</td>
                                            <td style={styles.td}>{v.spotCode}</td>
                                            <td style={styles.td}>{formatDateTime(v.entryTime)}</td>
                                            <td style={styles.td}>{v.exitTime ? formatDateTime(v.exitTime) : "En Sitio"}</td>
                                            <td style={styles.td}>{v.exitTime ? formatDuration((new Date(v.exitTime).getTime() - new Date(v.entryTime).getTime()) / 1000) : "-"}</td>
                                            {showMonetization && (
                                                <td style={{ ...styles.td, fontWeight: "800", color: "var(--success)" }}>${(v.cost || 0).toLocaleString('es-CL')}</td>
                                            )}
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
                                        {showMonetization && <th style={styles.th}>Cuota Mensual</th>}
                                        <th style={styles.th}>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubscribers.map((s: any, idx: number) => (
                                        <tr key={idx} style={styles.tr}>
                                            <td style={{ ...styles.td, fontWeight: "700" }}>{s.name || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin Asignar</span>}</td>
                                            <td style={{ ...styles.td, fontFamily: "monospace" }}>{s.plate || "-"}</td>
                                            <td style={styles.td}>{s.spotCode}</td>
                                            {showMonetization && (
                                                <td style={{ ...styles.td, fontWeight: "800", color: "var(--primary)" }}>${(s.monthlyFee || 0).toLocaleString('es-CL')}</td>
                                            )}
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
            <style jsx global>{`
                @media (max-width: 768px) {
                    .reports-dashboard-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
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
