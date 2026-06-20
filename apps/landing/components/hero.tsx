import Image from "next/image";
import { PlayCircle } from "lucide-react";

export function Hero() {
  return (
    <section
      id="hero"
      className="pt-xl pb-xl px-margin-mobile md:px-margin-desktop min-h-[80vh] flex items-center relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-xl items-center relative z-10">
        {/* Text Content */}
        <div className="md:col-span-7 space-y-md">
          {/* Badge */}
          <div className="inline-flex items-center gap-base bg-surface-container-high px-base py-xs rounded-full border border-outline-variant">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-code text-code-sm text-secondary uppercase tracking-widest">
              Build in Public Initiative
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-headline text-headline-lg-mobile md:text-headline-xl text-on-surface leading-tight">
            Construindo a maior escola{" "}
            <span className="text-primary">mobile</span> do zero
          </h1>

          {/* Description */}
          <p className="font-body text-body-md text-on-surface-variant max-w-xl">
            Acompanhe os bastidores técnicos reais através da nossa jornada
            Build in Public no YouTube. Aprenda engenharia de software de
            verdade, vendo como as coisas são feitas na prática.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-md pt-base">
            <button
              id="cta-youtube"
              className="bg-primary text-on-primary font-bold uppercase py-md px-lg rounded-lg glow-primary transition-all flex items-center justify-center gap-sm"
            >
              <PlayCircle className="w-5 h-5" />
              Acompanhar no YouTube
            </button>
            <button
              id="cta-courses"
              className="border-2 border-secondary text-secondary font-bold uppercase py-md px-lg rounded-lg hover:bg-secondary/10 transition-all text-center"
            >
              Ver Cursos
            </button>
          </div>
        </div>

        {/* Mascot */}
        <div className="md:col-span-5 relative flex justify-center">
          <div className="absolute -inset-20 bg-primary/10 blur-[100px] rounded-full" />
          <Image
            src="/images/logo-mascot.png"
            alt="Engenharia Inversa Mascot"
            width={450}
            height={450}
            className="w-full max-w-[350px] md:max-w-[450px] relative drop-shadow-[0_20px_50px_rgba(230,126,34,0.3)] animate-float"
            priority
          />
        </div>
      </div>
    </section>
  );
}
