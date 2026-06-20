import Image from "next/image";

const pipelineSteps = [
  {
    level: 0,
    title: "Nível Zero: Fundamentos",
    subtitle: "Lógica, Git e Setup Profissional",
    status: "active" as const,
  },
  {
    level: 1,
    title: "Core: Arquitetura",
    subtitle: "Clean Architecture & Design Patterns",
    status: "next" as const,
  },
  {
    level: 2,
    title: "Avançado: Scalability",
    subtitle: "CI/CD, Performance & Security",
    status: "locked" as const,
  },
];

export function AboutSection() {
  return (
    <section
      id="sobre"
      className="px-margin-mobile md:px-margin-desktop py-xl"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-xl items-center">
        {/* Text Content */}
        <div className="space-y-md">
          <h2 className="font-headline text-headline-lg text-on-surface">
            A Escola do Futuro
          </h2>

          <div className="space-y-base font-body text-body-md text-on-surface-variant leading-relaxed">
            <p>
              A{" "}
              <strong className="text-primary">Engenharia Inversa</strong> não é
              apenas uma escola de cursos. É uma fábrica de software que opera
              de portas abertas. Nosso diferencial é a transparência absoluta.
            </p>
            <p>
              Enquanto outros ensinam apenas a sintaxe, nós ensinamos o
              &quot;porquê&quot;. Mostramos os erros de arquitetura, as
              refatorações difíceis e as decisões técnicas que ninguém te conta
              nos cursos tradicionais.
            </p>
            <p>
              Nosso modelo{" "}
              <strong className="text-secondary">Build in Public</strong>{" "}
              garante que você veja o projeto crescendo, evoluindo e sendo
              testado em produção real.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-md pt-md">
            <div className="p-md bg-surface-container rounded-lg border-l-4 border-primary">
              <span className="font-headline text-headline-lg text-primary block">
                100+
              </span>
              <span className="font-code text-code-sm uppercase tracking-wider text-on-surface-variant">
                Horas de Live
              </span>
            </div>
            <div className="p-md bg-surface-container rounded-lg border-l-4 border-secondary">
              <span className="font-headline text-headline-lg text-secondary block">
                15k
              </span>
              <span className="font-code text-code-sm uppercase tracking-wider text-on-surface-variant">
                Devs Ativos
              </span>
            </div>
          </div>
        </div>

        {/* Pipeline de Aprendizado */}
        <div className="relative bg-surface-container-high p-lg rounded-xl border border-outline-variant overflow-hidden">
          <div className="space-y-lg relative z-10">
            <h3 className="font-code text-code-sm text-primary uppercase tracking-widest mb-md">
              Pipeline de Aprendizado
            </h3>

            {pipelineSteps.map((step, i) => (
              <div key={step.level}>
                <div
                  className={`flex items-center gap-md ${step.status === "locked" ? "opacity-50" : ""}`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold shrink-0 ${
                      step.status === "active"
                        ? "bg-primary text-on-primary"
                        : step.status === "next"
                          ? "border-2 border-primary-fixed-dim text-primary-fixed-dim"
                          : "border-2 border-outline-variant text-on-surface-variant"
                    }`}
                  >
                    {step.level}
                  </div>
                  <div>
                    <p className="font-bold text-on-surface">{step.title}</p>
                    <p className="text-code-sm font-code text-on-surface-variant">
                      {step.subtitle}
                    </p>
                  </div>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <div className="w-px h-8 bg-outline-variant ml-6" />
                )}
              </div>
            ))}
          </div>

          {/* Ghost Logo */}
          <div className="absolute bottom-0 right-0 p-lg opacity-10">
            <Image
              src="/images/logo-mascot.png"
              alt=""
              width={256}
              height={256}
              className="w-64 grayscale"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
