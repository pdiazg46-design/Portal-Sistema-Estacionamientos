
"use client";

import { useState } from "react";
import BrandingModal from "./BrandingModal";

export default function BrandingTool({ branding }: { branding: any }) {
    const [isBrandingOpen, setIsBrandingOpen] = useState(false);

    return (
        <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
            <button
                onClick={() => setIsBrandingOpen(true)}
                style={{
                    padding: "6px 14px",
                    background: "#f1f5f9",
                    color: "#64748b",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s"
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.background = "#e2e8f0";
                    e.currentTarget.style.color = "var(--primary)";
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.background = "#f1f5f9";
                    e.currentTarget.style.color = "#64748b";
                }}
            >
                ✨ Personalizar Marca
            </button>

            <BrandingModal
                isOpen={isBrandingOpen}
                onClose={() => setIsBrandingOpen(false)}
                initialData={branding}
            />
        </div>
    );
}
