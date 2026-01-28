
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { updateBranding } from "@/lib/actions";

type LogoUploadProps = {
    initialUrl: string;
    companyName: string;
};

export default function LogoUpload({ initialUrl, companyName }: LogoUploadProps) {
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith("image/")) {
            alert("Por favor selecciona un archivo de imagen");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert("La imagen es muy pesada (max 2MB)");
            return;
        }

        setLoading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result as string;
                await updateBranding({ logoUrl: base64String });
                window.location.reload(); // Refresh to show new logo
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error(error);
            alert("Error al cargar el logo");
            setLoading(false);
        }
    }

    return (
        <div
            onClick={() => fileInputRef.current?.click()}
            style={{
                position: "relative",
                cursor: "pointer",
                width: "100px",
                height: "100px",
                borderRadius: "12px",
                overflow: "hidden",
                border: "2px dashed transparent",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f8fafc"
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.background = "#eff6ff";
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.background = "#f8fafc";
            }}
            title="Click para cambiar el logo"
        >
            <Image
                src={initialUrl}
                alt={`Logo ${companyName}`}
                width={100}
                height={100}
                style={{
                    objectFit: "contain",
                    maxHeight: "100px",
                    opacity: loading ? 0.3 : 1
                }}
                priority
            />

            {loading && (
                <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: "bold",
                    color: "var(--primary)"
                }}>
                    CARGANDO...
                </div>
            )}

            <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background: "rgba(0,0,0,0.4)",
                color: "white",
                fontSize: "10px",
                textAlign: "center",
                padding: "2px 0",
                opacity: 0,
                transition: "opacity 0.2s"
            }} className="upload-overlay">
                Cambiar
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: "none" }}
            />

            <style jsx>{`
                div:hover .upload-overlay {
                    opacity: 1 !important;
                }
            `}</style>
        </div>
    );
}
