"use client";

import Image from "next/image";
import { User } from "lucide-react";

const navLinks = [
  { label: "Cursos", href: "#cursos", active: true },
  { label: "Episódios", href: "#episodios", active: false },
  { label: "Mentoria", href: "#mentoria", active: false },
  { label: "Sobre", href: "#sobre", active: false },
];

export function Navbar() {
  return (
    <nav
      id="main-nav"
      className="fixed top-0 w-full z-50 border-b border-outline-variant bg-background/80 backdrop-blur-md h-20 px-margin-mobile md:px-margin-desktop flex justify-between items-center"
    >
      {/* Logo */}
      <div className="flex items-center gap-base">
        <Image
          src="/images/logo-mascot.png"
          alt="Logo Engenharia Inversa"
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
        />
        <span className="text-headline-lg font-headline font-black text-primary uppercase tracking-tighter hidden sm:inline">
          Engenharia Inversa
        </span>
      </div>

      {/* Navigation Links */}
      <div className="hidden md:flex items-center gap-lg">
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
        <button
          id="cta-enroll"
          className="bg-primary-container text-on-primary font-bold uppercase py-xs px-md rounded-lg hover:scale-95 transition-transform duration-150 shadow-lg glow-primary text-sm"
        >
          Matricular-se
        </button>
        <User className="w-6 h-6 text-on-surface cursor-pointer hover:text-primary transition-colors" />
      </div>
    </nav>
  );
}
