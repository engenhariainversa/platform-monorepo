import Image from "next/image";
import { ArrowRight } from "lucide-react";

const episodes = [
  {
    id: "ep-01",
    module: "MOD-01 • EP 04",
    title: "Otimização de Performance e Memoization no Flutter",
    duration: "45:20",
    image: "/images/ep-01.png",
  },
  {
    id: "ep-02",
    module: "MOD-01 • EP 03",
    title: "State Management com Bloc vs Riverpod: O Duelo Final",
    duration: "32:15",
    image: "/images/ep-02.png",
  },
  {
    id: "ep-03",
    module: "MOD-02 • EP 01",
    title: "Arquitetura de Micro-frontends em Aplicativos Nativos",
    duration: "58:00",
    image: "/images/ep-03.png",
  },
  {
    id: "ep-04",
    module: "MOD-01 • EP 02",
    title: "Desvendando o Event Loop e Multithreading no Dart",
    duration: "24:45",
    image: "/images/ep-04.png",
  },
];

export function EpisodesSection() {
  return (
    <section
      id="episodios"
      className="px-margin-mobile md:px-margin-desktop py-xl bg-surface-container-lowest"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-lg gap-md">
          <div className="space-y-xs">
            <h2 className="font-headline text-headline-lg text-on-surface">
              Episódios Recentes
            </h2>
            <div className="h-1 w-32 pipeline-line rounded-full" />
          </div>
          <button
            id="btn-all-episodes"
            className="text-primary font-bold uppercase font-label text-label-md flex items-center gap-xs hover:gap-sm transition-all"
          >
            Ver todos episódios
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Episode Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {episodes.map((ep) => (
            <div
              key={ep.id}
              className="group bg-surface-container rounded-lg overflow-hidden border border-outline-variant hover:border-primary transition-colors cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="aspect-video relative">
                <Image
                  src={ep.image}
                  alt={ep.title}
                  fill
                  className="object-cover"
                />
                <span className="absolute bottom-xs right-xs bg-black/80 px-xs text-xs rounded font-code text-code-sm text-white">
                  {ep.duration}
                </span>
              </div>

              {/* Info */}
              <div className="p-md space-y-sm">
                <span className="font-code text-code-sm text-secondary bg-secondary/10 px-xs py-0.5 rounded inline-block">
                  {ep.module}
                </span>
                <h3 className="font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2 text-sm">
                  {ep.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
