import Image from "next/image";
import { PlayCircle } from "@repo/ui";

export function Hero() {
  return (
    <section
      id="hero"
      className="pt-[140px] pb-lg md:pt-xl md:pb-xl px-margin-mobile md:px-margin-desktop md:min-h-[80vh] flex items-center relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-lg md:gap-xl items-center relative z-10">
        {/* Mascot — appears FIRST on mobile (above text), SECOND on desktop (right side) */}
        <div className="md:col-span-5 md:order-2 relative flex justify-center">
          <div className="absolute -inset-20 bg-primary/10 blur-[100px] rounded-full" />
          <Image
            src="/images/logo-mascot.png"
            alt="Engenharia Inversa Mascot"
            width={450}
            height={450}
            className="w-40 md:w-full max-w-[450px] relative drop-shadow-[0_20px_50px_rgba(230,126,34,0.3)] animate-float"
            priority
          />
        </div>

        {/* Text Content */}
        <div className="md:col-span-7 md:order-1 space-y-md text-center md:text-left">
          {/* Headline */}
          <h1 className="font-headline text-headline-lg-mobile md:text-headline-xl text-on-surface leading-tight">
            Construindo a maior escola{" "}
            <span className="text-primary">mobile</span> do zero
          </h1>

          {/* Description */}
          <p className="font-body text-body-md text-on-surface-variant max-w-xl mx-auto md:mx-0">
            Acompanhe os bastidores técnicos reais através da nossa jornada
            Build in Public no YouTube. Aprenda engenharia de software de
            verdade, vendo como as coisas são feitas na prática.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-md pt-base justify-center md:justify-start">
            <button
              id="cta-youtube"
              className="bg-primary text-on-primary font-bold uppercase py-md px-lg rounded-lg glow-primary transition-all flex items-center justify-center gap-sm"
            >
              <PlayCircle className="w-5 h-5" />
              Acompanhar no YouTube
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
