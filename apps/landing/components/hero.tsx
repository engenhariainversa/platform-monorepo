"use client";

import Image from "next/image";
import { PlayCircle } from "@repo/ui";
import { LANDING_PAGE_CONTENT } from "@repo/graphql";
import type { LandingPageContent } from "@repo/types";
import { useQuery } from "@repo/graphql/react";

// The hero always renders (it's the top of the page), so unlike the live and
// episodes sections it falls back to this baked-in copy while the CMS content
// is loading or if the API is unreachable — never a blank hero.
const FALLBACK = {
  title: "Construindo a maior escola mobile do zero",
  subtitle:
    "Acompanhe os bastidores técnicos reais através da nossa jornada Build in Public no YouTube. Aprenda engenharia de software de verdade, vendo como as coisas são feitas na prática.",
  buttonText: "Acompanhar no YouTube",
  buttonUrl: "#",
};

export function Hero() {
  const { data, loading } = useQuery<LandingPageContent>(LANDING_PAGE_CONTENT);

  if (loading) {
    return <HeroSkeleton />;
  }

  const hero = data?.heroSection ?? FALLBACK;

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
            {hero.title}
          </h1>

          {/* Description */}
          <p className="font-body text-body-md text-on-surface-variant max-w-xl mx-auto md:mx-0">
            {hero.subtitle}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-md pt-base justify-center md:justify-start">
            <a
              id="cta-youtube"
              href={hero.buttonUrl}
              className="bg-primary text-on-primary font-bold uppercase py-md px-lg rounded-lg glow-primary transition-all flex items-center justify-center gap-sm"
            >
              <PlayCircle className="w-5 h-5" />
              {hero.buttonText}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// Placeholder shown while the hero content is being fetched. Mirrors the real
// layout (mascot + headline/subtitle/CTA) so the section doesn't shift once
// data arrives. The mascot renders as-is since it isn't CMS-managed.
function HeroSkeleton() {
  return (
    <section
      id="hero"
      aria-hidden="true"
      className="pt-[140px] pb-lg md:pt-xl md:pb-xl px-margin-mobile md:px-margin-desktop md:min-h-[80vh] flex items-center relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-lg md:gap-xl items-center relative z-10">
        {/* Mascot — not CMS-managed, so shown for real even in the skeleton */}
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

        {/* Text placeholder */}
        <div className="md:col-span-7 md:order-1 space-y-md w-full animate-pulse">
          {/* Headline (two lines) */}
          <div className="space-y-3">
            <div className="h-10 md:h-14 w-11/12 rounded-lg bg-surface-container-high mx-auto md:mx-0" />
            <div className="h-10 md:h-14 w-3/4 rounded-lg bg-surface-container-high mx-auto md:mx-0" />
          </div>

          {/* Subtitle (three lines) */}
          <div className="space-y-2 max-w-xl mx-auto md:mx-0">
            <div className="h-4 w-full rounded bg-surface-container-high" />
            <div className="h-4 w-full rounded bg-surface-container-high" />
            <div className="h-4 w-2/3 rounded bg-surface-container-high" />
          </div>

          {/* CTA */}
          <div className="pt-base flex justify-center md:justify-start">
            <div className="h-12 w-60 rounded-lg bg-surface-container-high" />
          </div>
        </div>
      </div>
    </section>
  );
}
