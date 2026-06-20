import Image from "next/image";
import { Play, Eye } from "@repo/ui";

export function LiveSection() {
  return (
    <section id="live" className="px-margin-mobile md:px-margin-desktop pb-xl">
      <div className="max-w-7xl mx-auto">
        <div className="bg-surface-container-high rounded-xl overflow-hidden border border-outline-variant flex flex-col md:flex-row items-stretch shadow-2xl relative">
          {/* Video Thumbnail */}
          <div className="md:w-1/2 aspect-video bg-surface-container relative overflow-hidden group">
            <Image
              src="/images/live-studio.png"
              alt="Estúdio de streaming para desenvolvimento mobile"
              fill
              className="object-cover"
            />
            {/* Play Overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Play className="w-16 h-16 text-white fill-white" />
            </div>
            {/* Live Badge */}
            <div className="absolute top-md left-md bg-error text-on-error-container font-bold text-code-sm px-base py-1 rounded-sm flex items-center gap-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              AO VIVO AGORA
            </div>
            {/* Viewers Count */}
            <div className="absolute bottom-md left-md bg-black/60 backdrop-blur-md px-base py-xs rounded text-code-sm text-white flex items-center gap-xs">
              <Eye className="w-4 h-4" />
              1.2k assistindo
            </div>
          </div>

          {/* Live Info */}
          <div className="md:w-1/2 p-lg flex flex-col justify-center space-y-md">
            <div className="space-y-xs">
              <p className="font-code text-code-sm text-primary">
                PRÓXIMA ETAPA DO PIPELINE
              </p>
              <h2 className="font-headline text-headline-lg-mobile md:text-headline-lg text-on-surface">
                Live #24: Implementando CI/CD com Fastlane e GitHub Actions
              </h2>
            </div>
            <p className="font-body text-body-md text-on-surface-variant">
              Hoje vamos configurar toda a automação de deploy para App Store e
              Play Store. Do zero absoluto ao deploy automatizado.
            </p>
            <button
              id="cta-live"
              className="w-fit bg-primary-container text-on-primary font-bold uppercase py-md px-xl rounded-lg glow-primary transition-all flex items-center gap-sm"
            >
              Entrar na Live
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
