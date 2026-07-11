import "./globals.css";
import type { Metadata } from "next";
import { ApolloWrapper } from "@repo/graphql/react";

export const metadata: Metadata = {
  title: "Engenharia Inversa — CMS",
  description: "Painel administrativo da plataforma Engenharia Inversa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-surface text-on-surface font-body min-h-screen">
        <ApolloWrapper tokenCookieName="cms_token">{children}</ApolloWrapper>
      </body>
    </html>
  );
}
