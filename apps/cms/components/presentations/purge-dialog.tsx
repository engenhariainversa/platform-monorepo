"use client";

import { useState } from "react";

/** Permanent delete, confirmed by typing the exact title. */
export function PurgeDialog({ title, onConfirm, onCancel }: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md bg-surface-container rounded-xl border border-outline-variant p-6 space-y-4">
        <h2 className="font-headline text-lg font-bold text-error">Excluir definitivamente</h2>
        <p className="text-sm text-on-surface-variant">
          Esta ação não pode ser desfeita: a apresentação e todos os seus slides serão apagados para sempre.
          Só é possível excluir definitivamente pelo painel, com o seu login; chaves de API não têm essa permissão.
        </p>
        <p className="text-sm text-on-surface-variant">
          Digite <strong className="text-on-surface">{title}</strong> para confirmar.
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-error focus:outline-none text-sm"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="py-2 px-4 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-high">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={typed !== title}
            className="bg-error text-on-error font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-40"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
