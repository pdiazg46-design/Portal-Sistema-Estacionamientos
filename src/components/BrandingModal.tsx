
"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { updateBranding } from "@/lib/actions";

type BrandingModalProps = {
    isOpen: boolean;
    onClose: () => void;
    initialData: {
        companyName: string;
        systemName: string;
        description: string;
        logoUrl: string;
    };
};

export default function BrandingModal({ isOpen, onClose, initialData }: BrandingModalProps) {
    const [formData, setFormData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert("La imagen es muy pesada (max 2MB)");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData({ ...formData, logoUrl: reader.result as string });
        };
        reader.readAsDataURL(file);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            await updateBranding(formData);
            onClose();
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert("Error al actualizar marca");
        } finally {
            setLoading(false);
        }
    }

    const styles = {
        overlay: {
            position: "fixed" as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000,
            overflowY: "auto" as const,
            padding: "20px"
        },
        modal: {
            background: "white",
            padding: "30px",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "500px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            margin: "auto"
        },
        header: {
            margin: "0 0 20px 0",
            color: "var(--primary)",
            fontSize: "24px",
            fontWeight: "900"
        },
        group: {
            marginBottom: "15px"
        },
        label: {
            display: "block",
            fontSize: "13px",
            fontWeight: "700",
            color: "#64748b",
            marginBottom: "6px"
        },
        input: {
            width: "100%",
            padding: "12px 14px",
            borderRadius: "10px",
            border: "2px solid #e2e8f0",
            fontSize: "14px",
            outline: "none",
            transition: "all 0.2s"
        },
        logoPreview: {
            width: "100%",
            height: "120px",
            border: "2px dashed #e2e8f0",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            background: "#f8fafc",
            overflow: "hidden",
            position: "relative" as const,
            transition: "all 0.2s"
        },
        actions: {
            display: "flex",
            gap: "12px",
            marginTop: "25px"
        },
        btnSave: {
            flex: 2,
            padding: "14px",
            background: "var(--primary)",
            color: "white",
            border: "none",
            borderRadius: "12px",
            fontWeight: "800",
            cursor: "pointer"
        },
        btnCancel: {
            flex: 1,
            padding: "14px",
            background: "#f1f5f9",
            color: "#64748b",
            border: "none",
            borderRadius: "12px",
            fontWeight: "700",
            cursor: "pointer"
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal} className="animate-fade-in">
                <h3 style={styles.header}>Personalización de Marca</h3>
                <form onSubmit={handleSubmit}>
                    <div style={styles.group}>
                        <label style={styles.label}>Logotipo de la Empresa</label>
                        <div
                            style={styles.logoPreview}
                            onClick={() => fileInputRef.current?.click()}
                            onMouseOver={e => e.currentTarget.style.borderColor = "var(--primary)"}
                            onMouseOut={e => e.currentTarget.style.borderColor = "#e2e8f0"}
                        >
                            {formData.logoUrl ? (
                                <Image
                                    src={formData.logoUrl}
                                    alt="Logo preview"
                                    width={100}
                                    height={100}
                                    style={{ objectFit: "contain", maxHeight: "80px" }}
                                />
                            ) : (
                                <span style={{ fontSize: "12px", color: "#64748b" }}>Seleccionar Imagen</span>
                            )}
                            <div style={{
                                position: "absolute",
                                bottom: 0,
                                background: "rgba(0,0,0,0.5)",
                                width: "100%",
                                color: "white",
                                fontSize: "11px",
                                textAlign: "center",
                                padding: "4px 0"
                            }}>
                                Click para cambiar
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>

                    <div style={styles.group}>
                        <label style={styles.label}>Nombre de la Empresa (Glosa)</label>
                        <input
                            style={styles.input}
                            value={formData.companyName}
                            onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                            placeholder="Ej: Parking Central S.A."
                            required
                        />
                    </div>
                    <div style={styles.group}>
                        <label style={styles.label}>Título del Sistema</label>
                        <input
                            style={styles.input}
                            value={formData.systemName}
                            onChange={e => setFormData({ ...formData, systemName: e.target.value })}
                            placeholder="Ej: Panel de Control de Estacionamientos"
                            required
                        />
                    </div>
                    <div style={styles.group}>
                        <label style={styles.label}>Descripción / Subtítulo</label>
                        <input
                            style={styles.input}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Ej: Sistema de Gestión de Acceso"
                            required
                        />
                    </div>

                    <div style={styles.actions}>
                        <button type="button" onClick={onClose} style={styles.btnCancel} disabled={loading}>Cancelar</button>
                        <button type="submit" style={styles.btnSave} disabled={loading}>
                            {loading ? "Guardando..." : "Guardar Cambios"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
