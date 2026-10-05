/** Shown in place of a slide whose template or content does not validate. */
export function InvalidSlide({ template }: { template: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="rounded-xl border-[3px] border-dashed border-error px-[80px] py-[56px] text-center">
        <p className="font-headline font-bold text-[56px] text-error">
          Slide inválido: {template}
        </p>
        <p className="mt-[16px] text-[28px] text-on-surface-variant">
          Corrija o conteúdo no editor do CMS.
        </p>
      </div>
    </div>
  );
}
