
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/lib/AuthContext";
import TrialControl from "@/components/TrialControl";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  // We'll move branding logic to a client component or handle it differently if needed, 
  // but for layout it can stay as is if we don't need dynamic title here (already handled in page.tsx)
  return {
    title: "Gestión Estacionamientos",
    description: "Sistema de Control de Acceso",
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <TrialControl>
            {children}
          </TrialControl>
        </AuthProvider>
      </body>
    </html>
  );
}

