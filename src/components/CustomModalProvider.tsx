"use client";

import { useState, useEffect } from "react";

type ModalState = {
    isOpen: boolean;
    type: "alert" | "confirm";
    message: string;
    resolve: (value: boolean) => void;
};

export default function CustomModalProvider({ children }: { children: React.ReactNode }) {
    const [modal, setModal] = useState<ModalState>({
        isOpen: false,
        type: "alert",
        message: "",
        resolve: () => {},
    });

    useEffect(() => {
        // Sobrescribir alert del navegador
        window.alert = (message: string) => {
            return new Promise<boolean>((resolve) => {
                setModal({
                    isOpen: true,
                    type: "alert",
                    message: String(message),
                    resolve,
                });
            }).then(() => {});
        };

        // Sobrescribir confirm del navegador
        window.confirm = (message: string) => {
            return new Promise<boolean>((resolve) => {
                setModal({
                    isOpen: true,
                    type: "confirm",
                    message: String(message),
                    resolve,
                });
            }) as any;
        };
    }, []);

    const handleConfirm = () => {
        modal.resolve(true);
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleCancel = () => {
        modal.resolve(false);
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    const styles = {
        overlay: {
            position: "fixed" as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(10px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999999,
            transition: "opacity 0.2s ease"
        },
        container: {
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: "24px",
            padding: "32px",
            width: "92%",
            maxWidth: "400px",
            boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.05)",
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            textAlign: "center" as const,
            border: "1px solid rgba(255, 255, 255, 0.8)",
            animation: "scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)"
        },
        iconWrapper: {
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "26px",
            marginBottom: "20px",
            background: modal.type === "confirm" ? "#fef3c7" : "#fee2e2",
            color: modal.type === "confirm" ? "#b45309" : "#b91c1c",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)"
        },
        title: {
            fontSize: "18px",
            fontWeight: "900",
            color: "#0f172a",
            margin: "0 0 12px 0",
            letterSpacing: "-0.025em"
        },
        message: {
            fontSize: "14px",
            color: "#475569",
            lineHeight: "1.6",
            margin: "0 0 28px 0",
            whiteSpace: "pre-wrap" as const,
            fontWeight: "500"
        },
        buttonGroup: {
            display: "flex",
            gap: "12px",
            width: "100%"
        },
        btnAccept: {
            flex: 1,
            padding: "12px 24px",
            border: "none",
            borderRadius: "14px",
            fontWeight: "800",
            fontSize: "14px",
            cursor: "pointer",
            background: modal.type === "confirm" ? "var(--primary)" : "#dc2626",
            color: "white",
            transition: "all 0.2s ease",
            boxShadow: modal.type === "confirm" ? "0 4px 12px rgba(3, 105, 161, 0.2)" : "0 4px 12px rgba(220, 38, 38, 0.2)"
        },
        btnCancel: {
            flex: 1,
            padding: "12px 24px",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            fontWeight: "700",
            fontSize: "14px",
            cursor: "pointer",
            background: "#f8fafc",
            color: "#64748b",
            transition: "all 0.2s ease"
        }
    };

    return (
        <>
            {children}
            {modal.isOpen && (
                <div style={styles.overlay}>
                    <div style={styles.container}>
                        <div style={styles.iconWrapper}>
                            {modal.type === "confirm" ? "❓" : "⚠️"}
                        </div>
                        <h4 style={styles.title}>
                            {modal.type === "confirm" ? "Confirmación" : "Aviso del Sistema"}
                        </h4>
                        <p style={styles.message}>{modal.message}</p>
                        <div style={styles.buttonGroup}>
                            {modal.type === "confirm" && (
                                <button onClick={handleCancel} style={styles.btnCancel}>
                                    Cancelar
                                </button>
                            )}
                            <button onClick={handleConfirm} style={styles.btnAccept}>
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <style jsx global>{`
                @keyframes scaleIn {
                    from { transform: scale(0.92); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </>
    );
}
