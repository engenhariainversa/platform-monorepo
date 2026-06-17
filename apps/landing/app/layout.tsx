import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Engenhariainversa - Landing Page",
  description: "Welcome to our Next.js Landing Page",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}
