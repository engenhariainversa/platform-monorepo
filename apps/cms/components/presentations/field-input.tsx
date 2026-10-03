"use client";

import { useState } from "react";
import type { FieldDescriptor } from "@repo/slides";
import { getUploadUrl, uploadFile } from "@repo/graphql";
import { emptyValueFor, formatLineList, LINE_LIST_FIELDS, parseLineList, pathKey, type Path } from "./form-state";

export const inputClass =
  "w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm";

type FieldInputProps = {
  field: FieldDescriptor;
  path: Path;
  value: unknown;
  issues: Record<string, string>;
  onChange: (path: Path, value: unknown) => void;
};

function Issue({ message }: { message?: string }) {
  return message ? <p className="text-xs text-error mt-1">{message}</p> : null;
}

function Counter({ value, max }: { value: string; max?: number }) {
  if (!max) return null;
  return (
    <span className={`text-[10px] ${value.length > max ? "text-error" : "text-on-surface-variant"}`}>
      {value.length}/{max}
    </span>
  );
}

function Label({ field, value }: { field: FieldDescriptor; value?: string }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <label className="text-xs text-on-surface-variant font-label">
        {field.label}
        {field.optional && <span className="opacity-60"> (opcional)</span>}
      </label>
      {value !== undefined && <Counter value={value} max={field.maxLength} />}
    </div>
  );
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function FieldInput({ field, path, value, issues, onChange }: FieldInputProps) {
  const key = pathKey(path);
  const message = issues[key];

  switch (field.kind) {
    case "text": {
      if (LINE_LIST_FIELDS.has(field.name) && path.length === 1) {
        return <LineListInput field={field} path={path} value={value} message={message} onChange={onChange} />;
      }
      const text = typeof value === "string" ? value : "";
      return (
        <div>
          <Label field={field} value={text} />
          <input className={inputClass} value={text} onChange={(e) => onChange(path, e.target.value)} />
          {field.help && <p className="text-[11px] text-on-surface-variant mt-1">{field.help}</p>}
          <Issue message={message} />
        </div>
      );
    }
    case "textarea":
    case "code": {
      const text = typeof value === "string" ? value : "";
      return (
        <div>
          <Label field={field} value={text} />
          <textarea
            className={`${inputClass} ${field.kind === "code" ? "font-code" : ""}`}
            rows={field.kind === "code" ? 12 : 5}
            spellCheck={field.kind !== "code"}
            value={text}
            onChange={(e) => onChange(path, e.target.value)}
          />
          {field.help && <p className="text-[11px] text-on-surface-variant mt-1">{field.help}</p>}
          <Issue message={message} />
        </div>
      );
    }
    case "select":
      return (
        <div>
          <Label field={field} />
          <select className={inputClass} value={String(value ?? "")} onChange={(e) => onChange(path, e.target.value)}>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Issue message={message} />
        </div>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(path, e.target.checked)} />
          {field.label}
        </label>
      );
    case "image":
      return <ImageInput field={field} path={path} value={value} issues={issues} onChange={onChange} />;
    case "list": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      const max = field.maxItems ?? Infinity;
      return (
        <div className="space-y-2">
          <Label field={field} />
          {items.map((item, i) => (
            <div key={i}>
              <div className="flex gap-1">
                <input className={inputClass} value={item} onChange={(e) => onChange([...path, i], e.target.value)} />
                <ItemButtons
                  onUp={() => onChange(path, moveItem(items, i, i - 1))}
                  onDown={() => onChange(path, moveItem(items, i, i + 1))}
                  onRemove={() => onChange(path, items.filter((_, j) => j !== i))}
                />
              </div>
              <Issue message={issues[pathKey([...path, i])]} />
            </div>
          ))}
          {items.length < max && (
            <button type="button" onClick={() => onChange(path, [...items, ""])} className="text-xs text-primary hover:underline">
              + Adicionar item
            </button>
          )}
          <Issue message={message} />
        </div>
      );
    }
    case "objectList": {
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const max = field.maxItems ?? Infinity;
      return (
        <div className="space-y-2">
          <Label field={field} />
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-outline-variant p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-code text-on-surface-variant">#{i + 1}</span>
                <ItemButtons
                  onUp={() => onChange(path, moveItem(items, i, i - 1))}
                  onDown={() => onChange(path, moveItem(items, i, i + 1))}
                  onRemove={() => onChange(path, items.filter((_, j) => j !== i))}
                />
              </div>
              {(field.fields ?? []).map((sub) => (
                <FieldInput key={sub.name} field={sub} path={[...path, i, sub.name]} value={item?.[sub.name]} issues={issues} onChange={onChange} />
              ))}
            </div>
          ))}
          {items.length < max && (
            <button
              type="button"
              onClick={() => onChange(path, [...items, emptyValueFor({ ...field, kind: "group" })])}
              className="text-xs text-primary hover:underline"
            >
              + Adicionar
            </button>
          )}
          <Issue message={message} />
        </div>
      );
    }
    case "group": {
      const present = value !== undefined && value !== null;
      return (
        <div className="rounded-lg border border-outline-variant p-3 space-y-2">
          {field.optional ? (
            <label className="flex items-center gap-2 text-xs text-on-surface-variant font-label">
              <input
                type="checkbox"
                checked={present}
                onChange={(e) => onChange(path, e.target.checked ? emptyValueFor(field) : undefined)}
              />
              {field.label}
            </label>
          ) : (
            <Label field={field} />
          )}
          {present &&
            (field.fields ?? []).map((sub) => (
              <FieldInput
                key={sub.name}
                field={sub}
                path={[...path, sub.name]}
                value={(value as Record<string, unknown>)[sub.name]}
                issues={issues}
                onChange={onChange}
              />
            ))}
          <Issue message={message} />
        </div>
      );
    }
  }
}

function ItemButtons({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  const b = "px-2 text-xs text-on-surface-variant hover:text-on-surface";
  return (
    <div className="flex shrink-0">
      <button type="button" onClick={onUp} className={b} title="Subir">↑</button>
      <button type="button" onClick={onDown} className={b} title="Descer">↓</button>
      <button type="button" onClick={onRemove} className={`${b} hover:text-error`} title="Remover">✕</button>
    </div>
  );
}

function ImageInput({ field, path, value, issues, onChange }: FieldInputProps) {
  const image = (value as { url?: string; alt?: string } | undefined) ?? {};
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url } = await uploadFile(file);
      onChange([...path, "url"], url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label field={field} />
      {image.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={getUploadUrl(image.url)} alt="" className="w-full max-h-32 object-contain rounded border border-outline-variant bg-surface-container-lowest" />
      )}
      <div className="flex gap-2 items-center">
        <label className="text-xs bg-surface-container-high px-3 py-2 rounded-lg cursor-pointer hover:bg-surface-container-highest whitespace-nowrap">
          {uploading ? "Enviando..." : "Enviar imagem"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
        </label>
        <input
          className={inputClass}
          placeholder="ou cole uma URL"
          value={image.url ?? ""}
          onChange={(e) => onChange([...path, "url"], e.target.value)}
        />
      </div>
      <Issue message={issues[pathKey([...path, "url"])] ?? error} />
      <input
        className={inputClass}
        placeholder="Texto alternativo"
        value={image.alt ?? ""}
        onChange={(e) => onChange([...path, "alt"], e.target.value)}
      />
      <Issue message={issues[pathKey([...path, "alt"])]} />
    </div>
  );
}

/** Text box for a number-array value ("2, 4-5"); keeps its own draft so typing is not rewritten. */
function LineListInput({
  field,
  path,
  value,
  message,
  onChange,
}: {
  field: FieldDescriptor;
  path: Path;
  value: unknown;
  message?: string;
  onChange: (path: Path, value: unknown) => void;
}) {
  const [draft, setDraft] = useState(() => formatLineList(value));
  // Resync when the value changes from outside (e.g. switching slides), not from our own typing.
  const own = JSON.stringify(parseLineList(draft)) === JSON.stringify(value);
  const shown = own ? draft : formatLineList(value);

  return (
    <div>
      <Label field={field} />
      <input
        className={inputClass}
        value={shown}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(path, parseLineList(e.target.value));
        }}
      />
      {field.help && <p className="text-[11px] text-on-surface-variant mt-1">{field.help}</p>}
      <Issue message={message} />
    </div>
  );
}
