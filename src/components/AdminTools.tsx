
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import SpotConfigModal from "./SpotConfigModal";
import BrandingModal from "./BrandingModal";
import BulkUploadModal from "./BulkUploadModal";

export default function AdminTools({ branding }: { branding: any }) {
    const { isSuperAdmin } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showSpotConfig, setShowSpotConfig] = useState(false);
    const [showBranding, setShowBranding] = useState(false);
    const [showBulkUpload, setShowBulkUpload] = useState(false);

    return (
        <div style={{ display: "flex", gap: "10px" }}>
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
                onClick={() => setShowBranding(true)}
                disabled={loading}
                style={{
                    padding: "6px 12px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: loading ? 0.6 : 1
                }}
            >
                ⚙️ Configuración
            </button>

            {isSuperAdmin && (
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
            )}

            <button
                onClick={() => setShowBulkUpload(true)}
                disabled={loading}
                style={{
                    padding: "6px 12px",
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: loading ? 0.6 : 1
                }}
            >
                📥 Carga Masiva
            </button>

            {showSpotConfig && (
                <SpotConfigModal onClose={() => setShowSpotConfig(false)} />
            )}

            {showBranding && (
                <BrandingModal
                    isOpen={showBranding}
                    onClose={() => setShowBranding(false)}
                    initialData={branding}
                />
            )}

            {showBulkUpload && (
                <BulkUploadModal
                    isOpen={showBulkUpload}
                    onClose={() => setShowBulkUpload(false)}
                />
            )}
        </div>
    );
}
