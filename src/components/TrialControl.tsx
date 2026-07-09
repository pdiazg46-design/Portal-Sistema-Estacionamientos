
"use client";

import { useEffect, useState } from "react";
import { getTrialStatus, isOperatorOnly, loginUser } from "@/lib/actions";
import { useAuth } from "@/lib/AuthContext";

export default function TrialControl({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<{ expired: boolean; daysLeft: number } | null>(null);
    const { user, setUser } = useAuth();
    const [isOperatorMode, setIsOperatorMode] = useState(false);
    
    // Login form states for the expiration screen
    const [showLogin, setShowLogin] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function check() {
            try {
                const res = await getTrialStatus();
                setStatus(res);

                const opOnly = await isOperatorOnly();
                if (opOnly && user && user.role !== "OPERATOR") {
                    setIsOperatorMode(true);
                    setUser({ ...user, role: "OPERATOR" });
                }
            } catch (e) {
                console.error("Trial check failed (DB might be empty):", e);
                // Fallback safe to allow rendering
                setStatus({ expired: false, daysLeft: 15 });
            }
        }
        check();
    }, [user, setUser]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await loginUser(username, password);
            if (res.success && res.user) {
                // @ts-ignore - The user object matches the context type
                setUser(res.user);
                setUsername("");
                setPassword("");
            } else {
                setError(res.message || "Error al iniciar sesión");
            }
        } catch (err) {
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    if (!status) return null;

    const isAdmin = user && (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN");
    const isDev = process.env.NODE_ENV === "development";

    if (status.expired && !isAdmin && !isDev) {
        return (
            <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(15, 23, 42, 0.98)",
                backdropFilter: "blur(10px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 99999,
                color: "white",
                textAlign: "center" as const,
                padding: "40px"
            }}>
                <div style={{ fontSize: "100px", marginBottom: "20px" }}>⌛</div>
                <h1 style={{ fontSize: "48px", fontWeight: "900", marginBottom: "20px" }}>Versión de Prueba Expirada</h1>
                <p style={{ fontSize: "20px", color: "#94a3b8", maxWidth: "600px", lineHeight: "1.6", marginBottom: "35px" }}>
                    Tus 15 días de prueba han finalizado. Por favor, contacta al administrador para obtener una licencia completa y continuar utilizando el sistema de gestión de estacionamientos.
                </p>

                {!showLogin ? (
                    <button
                        onClick={() => setShowLogin(true)}
                        style={{
                            padding: "14px 32px",
                            background: "var(--primary, #003a8c)",
                            color: "white",
                            border: "none",
                            borderRadius: "12px",
                            fontSize: "16px",
                            fontWeight: "800",
                            cursor: "pointer",
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                            transition: "all 0.2s"
                        }}
                    >
                        🔐 Iniciar Sesión de Administrador
                    </button>
                ) : (
                    <div style={{
                        background: "white",
                        padding: "30px",
                        borderRadius: "20px",
                        width: "100%",
                        maxWidth: "400px",
                        color: "#0f172a",
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                        textAlign: "left"
                    }}>
                        <h3 style={{ margin: "0 0 20px 0", color: "var(--primary, #003a8c)", fontWeight: "900", fontSize: "24px" }}>Control de Acceso</h3>
                        <form onSubmit={handleLogin}>
                            <div style={{ marginBottom: "15px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#64748b", marginBottom: "5px", textTransform: "uppercase" }}>Usuario</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nombre de usuario"
                                    autoFocus
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        borderRadius: "10px",
                                        border: "2px solid #e2e8f0",
                                        outline: "none",
                                        fontSize: "16px"
                                    }}
                                />
                            </div>
                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#64748b", marginBottom: "5px", textTransform: "uppercase" }}>Contraseña</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Tu contraseña"
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        borderRadius: "10px",
                                        border: "2px solid #e2e8f0",
                                        outline: "none",
                                        fontSize: "16px"
                                    }}
                                />
                            </div>

                            {error && (
                                <div style={{ color: "#ef4444", background: "#fee2e2", padding: "10px", borderRadius: "8px", marginBottom: "15px", fontSize: "14px", fontWeight: "600", textAlign: "center" }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => { setShowLogin(false); setError(""); }}
                                    style={{
                                        flex: 1,
                                        padding: "14px",
                                        background: "#f1f5f9",
                                        border: "none",
                                        borderRadius: "12px",
                                        fontWeight: "700",
                                        cursor: "pointer"
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        flex: 1,
                                        padding: "14px",
                                        background: "var(--primary, #003a8c)",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "12px",
                                        fontWeight: "800",
                                        cursor: "pointer",
                                        boxShadow: "0 4px 12px rgba(0, 58, 140, 0.3)"
                                    }}
                                >
                                    {loading ? "Entrando..." : "Entrar"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            {status.daysLeft <= 3 && !isAdmin && (
                <div style={{
                    position: "fixed",
                    top: "20px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--warning)",
                    color: "white",
                    padding: "10px 20px",
                    borderRadius: "12px",
                    fontWeight: "800",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    zIndex: 99998,
                    fontSize: "14px"
                }}>
                    ⚠️ Versión de prueba: Quedan {status.daysLeft} días
                </div>
            )}
            {children}
            {isOperatorMode && (
                <style jsx global>{`
                    .role-selector-container {
                        display: none !important;
                    }
                    .admin-only {
                        display: none !important;
                    }
                `}</style>
            )}
        </>
    );
}

