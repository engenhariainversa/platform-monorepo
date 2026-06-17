import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Engenhariainversa - CMS System",
  description: "Manage your CMS data and pages",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-slate-100 font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}
