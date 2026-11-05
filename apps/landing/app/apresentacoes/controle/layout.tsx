import type { Metadata } from "next";
import { PresenterLinkProvider } from "../../../components/presenter-link";

// A private control page: never indexed, and no Referer header leaves it.
export const metadata: Metadata = {
  title: "Controle da apresentação | Engenharia Inversa",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PresenterLinkLayout({ children }: { children: React.ReactNode }) {
  return <PresenterLinkProvider>{children}</PresenterLinkProvider>;
}
