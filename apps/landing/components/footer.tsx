import Image from "next/image";

const navLinks = [
  { label: "Cursos", href: "#cursos" },
  { label: "Episódios", href: "#episodios" },
  { label: "Mentoria", href: "#mentoria" },
  { label: "Sobre", href: "#sobre" },
];

const socialLinks = [
  { label: "YouTube", href: "#" },
  { label: "GitHub", href: "#" },
  { label: "Discord", href: "#" },
  { label: "Newsletter", href: "#" },
];

export function Footer() {
  return (
    <footer
      id="footer"
      className="bg-surface-container-lowest border-t border-outline-variant py-xl"
    >
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 md:grid-cols-12 gap-gutter">
        {/* Branding */}
        <div className="md:col-span-4 space-y-md">
          <div className="flex items-center gap-base">
            <Image
              src="/images/logo-mascot.png"
              alt="Logo Engenharia Inversa"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="font-code text-code-sm text-primary uppercase tracking-widest font-bold">
              Engenharia Inversa
            </span>
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

        {/* Social */}
        <div className="md:col-span-2 space-y-md">
          <h4 className="font-code text-code-sm text-on-surface uppercase font-bold">
            Social
          </h4>
          <ul className="space-y-xs text-sm">
            {socialLinks.map((link) => (
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

        {/* Newsletter */}
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
          <div className="flex gap-md pt-sm">
            <a
              href="#"
              className="text-on-surface-variant hover:text-primary transition-colors font-label text-xs"
            >
              Privacidade
            </a>
            <a
              href="#"
              className="text-on-surface-variant hover:text-primary transition-colors font-label text-xs"
            >
              Termos
            </a>
          </div>
        </div>

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
