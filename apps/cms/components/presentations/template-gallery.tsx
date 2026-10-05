"use client";

import { SLIDE_TEMPLATE_KEYS, SLIDE_TEMPLATES, type SlideTemplateKey } from "@repo/slides";
import { SlideRenderer } from "@repo/ui";

export function TemplateGallery({ onPick, onClose }: { onPick: (key: SlideTemplateKey) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[85vh] overflow-y-auto bg-surface-container rounded-xl border border-outline-variant p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-headline text-lg font-bold text-on-surface mb-4">Escolha o modelo</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {SLIDE_TEMPLATE_KEYS.map((key) => (
            <button key={key} onClick={() => onPick(key)} className="text-left rounded-lg border border-outline-variant hover:border-primary p-2 space-y-2">
              <div className="pointer-events-none">
                <SlideRenderer template={key} content={SLIDE_TEMPLATES[key].example} />
              </div>
              <p className="text-sm font-bold text-on-surface">{SLIDE_TEMPLATES[key].label}</p>
              <p className="text-xs text-on-surface-variant">{SLIDE_TEMPLATES[key].description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
