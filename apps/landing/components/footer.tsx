"use client";

import Image from "next/image";
import { LANDING_PAGE_CONTENT } from "@repo/graphql";
import type { LandingPageContent } from "@repo/types";
import { useQuery } from "@repo/graphql/react";

const navLinks = [
  { label: "Cursos", href: "#cursos" },
  { label: "Episódios", href: "#episodios" },
  { label: "Mentoria", href: "#mentoria" },
  { label: "Sobre", href: "#sobre" },
  // Legal links live here rather than under the newsletter widget, which is
  // hidden by default — they would disappear with it.
  { label: "Privacidade", href: "#" },
  { label: "Termos", href: "#" },
];

export function Footer() {
  const { data } = useQuery<LandingPageContent>(LANDING_PAGE_CONTENT);

  // The newsletter widget stays hidden until an admin turns it on, and while
  // the query is still in flight: the switch defaults to off, so rendering it
  // optimistically would flash a block that is about to disappear.
  const showNewsletter = data?.footerSection?.newsletterEnabled ?? false;

  // The social block needs both the switch on and at least one link: an empty
  // "Social" heading is worse than no block at all. The switch defaults to on,
  // so the list alone decides while the query is in flight.
  // A link with no URL yet is still being filled in on the CMS side; rendering
  // it would put a dead entry in the footer.
  const socialLinks = (data?.socialLinks ?? []).filter(
    (link) => link.url.trim() !== "",
  );
  const showSocial =
    (data?.footerSection?.socialLinksEnabled ?? true) && socialLinks.length > 0;

  return (
    <footer
      id="footer"
      className="bg-surface-container-lowest border-t border-outline-variant py-xl"
    >
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 md:grid-cols-12 gap-gutter">
        {/* Branding */}
        <div className="md:col-span-4 space-y-md">
          <div className="flex items-center gap-sm">
            <Image
              src="/images/engenharia-inversa-logo.svg"
              alt="Logo Engenharia Inversa"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <Image
              src="/images/engenharia-inversa.svg"
              alt="Engenharia Inversa"
              width={140}
              height={28}
              className="h-6 w-auto object-contain"
            />
          </div>
          <p className="font-body text-on-surface-variant text-sm">
            A primeira escola de mobile focada em engenharia real e processos
            transparentes. Do código ao deploy, sem segredos.
          </p>
        </div>

        {/* Navigation */}
        <div className="md:col-span-2 space-y-md">
          <h4 className="font-code text-code-sm text-on-surface uppercase font-bold">
            Navegação
          </h4>
          <ul className="space-y-xs text-sm">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="text-on-surface-variant hover:text-secondary transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Social — CMS-managed */}
        {showSocial && (
          <div className="md:col-span-2 space-y-md">
            <h4 className="font-code text-code-sm text-on-surface uppercase font-bold">
              Social
            </h4>
            <ul className="space-y-xs text-sm">
              {socialLinks.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-on-surface-variant hover:text-secondary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Newsletter — CMS-managed visibility */}
        {showNewsletter && (
          <div className="md:col-span-4 space-y-md">
            <h4 className="font-code text-code-sm text-on-surface uppercase font-bold">
              Assine a News
            </h4>
            <div className="flex">
              <input
                id="newsletter-email"
                type="email"
                placeholder="seu@email.com"
                className="bg-background border border-outline-variant px-md py-sm rounded-l-lg w-full focus:outline-none focus:ring-2 focus:ring-primary font-code text-code-sm text-on-surface"
              />
              <button
                id="newsletter-submit"
                className="bg-primary text-on-primary px-md py-sm rounded-r-lg font-bold text-sm"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Copyright */}
        <div className="md:col-span-12 mt-xl pt-lg border-t border-outline-variant/30 text-center">
          <p className="font-code text-code-sm text-on-surface-variant opacity-60">
            © {new Date().getFullYear()} Engenharia Inversa - Build in Public.
            Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
