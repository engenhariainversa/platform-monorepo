import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Engenharia Inversa | Build in Public Mobile School",
  description:
    "A primeira escola de mobile focada em engenharia real e processos transparentes. Acompanhe os bastidores técnicos reais da nossa jornada Build in Public.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="technical-grid min-h-screen">{children}</body>
    </html>
  );
}
