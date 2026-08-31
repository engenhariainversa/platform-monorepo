"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Menu, X } from "@repo/ui";
import { LANDING_PAGE_CONTENT } from "@repo/graphql";
import type { LandingPageContent } from "@repo/types";
import { useQuery } from "@repo/graphql/react";

// In page order, so the highlight travels left to right as the reader scrolls.
const navLinks = [
  { label: "Live", href: "#live" },
  { label: "Episódios", href: "#episodios" },
  { label: "Sobre", href: "#sobre" },
];

// Height of the fixed bar (h-20). A section only counts as being read once it
// has scrolled clear of it.
const NAV_HEIGHT = 80;

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // null until the effect has looked at the page; every link is shown until
  // then, so the bar renders complete on first paint instead of popping in.
  const [presentIds, setPresentIds] = useState<string[] | null>(null);

  // Sections come and go while the landing content loads: EpisodesSection
  // renders a skeleton carrying the same id before swapping in the real one,
  // and omits the section entirely when there is nothing to show. Re-running
  // on the query result re-attaches the observer to whatever is on the page
  // now — the query itself is free here, served from the same cache entries
  // the sections already read.
  const { data } = useQuery<LandingPageContent>(LANDING_PAGE_CONTENT);

  useEffect(() => {
    const sections = navLinks
      .map((link) => document.getElementById(link.href.slice(1)))
      .filter((element): element is HTMLElement => element !== null);

    // Both #live and #episodios can be absent — the admin hides the live
    // section from the CMS, and the episodes section is omitted when there is
    // nothing to list. A link to a section that is not on the page is the bug
    // "Cursos" used to be, so those items are dropped from the bar.
    setPresentIds(sections.map((section) => section.id));

    if (sections.length === 0) return;

    const intersecting = new Map<string, boolean>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          intersecting.set(entry.target.id, entry.isIntersecting);
        });

        // Topmost wins when the band catches two sections at once.
        const current = sections
          .filter((section) => intersecting.get(section.id))
          .sort(
            (a, b) =>
              a.getBoundingClientRect().top - b.getBoundingClientRect().top,
          )[0];

        // Nothing in the band means the viewport is above the first section or
        // below the last one. Keeping the previous highlight beats blanking the
        // bar mid-scroll.
        if (current) setActiveId(current.id);
      },
      // The band runs from just under the bar down to 45% of the viewport, so
      // one section is highlighted at a time instead of every one on screen.
      { rootMargin: `-${NAV_HEIGHT}px 0px -55% 0px` },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [data]);

  const isActive = (href: string) => href.slice(1) === activeId;

  const visibleLinks =
    presentIds === null
      ? navLinks
      : navLinks.filter((link) => presentIds.includes(link.href.slice(1)));

  return (
    <nav
      id="main-nav"
      className="fixed top-0 w-full z-50 border-b border-outline-variant bg-background/80 backdrop-blur-md"
    >
      {/* Top bar */}
      <div className="h-20 px-margin-mobile md:px-margin-desktop flex justify-between items-center max-w-7xl mx-auto w-full">
        {/* Logo */}
        <div className="flex items-center gap-sm">
          <Image
            src="/images/engenharia-inversa-logo.svg"
            alt="Logo Engenharia Inversa"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
          <Image
            src="/images/engenharia-inversa.svg"
            alt="Engenharia Inversa"
            width={160}
            height={32}
            className="h-7 w-auto object-contain hidden sm:block"
          />
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-lg ml-auto">
          {visibleLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              aria-current={isActive(link.href) ? "true" : undefined}
              className={
                isActive(link.href)
                  ? "text-primary font-bold border-b-2 border-primary pb-1 font-label text-label-md"
                  : "text-on-surface-variant font-label text-label-md hover:text-primary transition-colors"
              }
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-md">

          {/* Hamburger button — mobile only */}
          <button
            id="mobile-menu-toggle"
            className="md:hidden w-10 h-10 flex items-center justify-center text-on-surface hover:text-primary transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-margin-mobile py-md border-t border-outline-variant bg-surface-container/95 backdrop-blur-lg space-y-xs">
          {visibleLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(link.href) ? "true" : undefined}
              className={`block py-sm px-md rounded-lg transition-colors font-label text-label-md ${
                isActive(link.href)
                  ? "text-primary bg-primary/10 font-bold"
                  : "text-on-surface-variant hover:text-primary hover:bg-primary/5"
              }`}
            >
              {link.label}
            </a>
          ))}

        </div>
      </div>
    </nav>
  );
}
