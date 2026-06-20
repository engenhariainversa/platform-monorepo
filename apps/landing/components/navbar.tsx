"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Cursos", href: "#cursos", active: true },
  { label: "Episódios", href: "#episodios", active: false },
  { label: "Sobre", href: "#sobre", active: false },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      id="main-nav"
      className="fixed top-0 w-full z-50 border-b border-outline-variant bg-background/80 backdrop-blur-md"
    >
      {/* Top bar */}
      <div className="h-20 px-margin-mobile md:px-margin-desktop flex justify-between items-center">
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
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={
                link.active
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
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block py-sm px-md rounded-lg transition-colors font-label text-label-md ${
                link.active
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
