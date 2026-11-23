import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICE_OPTIONS } from "@/types/agency";

/** Searchable list: pick several services, or type a new one and press Enter. */
export function ServicePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (s: string) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  const q = text.trim().toLowerCase();
  const all = [...SERVICE_OPTIONS, ...value.filter((s) => !SERVICE_OPTIONS.includes(s))];
  const list = all.filter((s) => s.toLowerCase().includes(q));
  const canAdd = !!q && !all.some((s) => s.toLowerCase() === q);
  const add = () => { if (canAdd) { onChange([...value, text.trim()]); setText(""); } };

  return (
    <div ref={box} className="relative">
      <div
        className="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm"
        onClick={() => setOpen(true)}
      >
        {value.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5">
            {s}
            <button type="button" aria-label={`Remove ${s}`} onClick={(e) => { e.stopPropagation(); toggle(s); }}><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input
          value={text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={value.length ? "" : "Select services…"}
          className="min-w-24 flex-1 bg-transparent outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); if (canAdd) add(); else if (list.length === 1) toggle(list[0]); }
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
        />
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </div>
      {open && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {list.map((s) => {
            const on = value.includes(s);
            return (
              <li key={s}>
                <button type="button" onClick={() => toggle(s)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted", on && "font-medium")}>
                  <Check className={cn("h-4 w-4", on ? "opacity-100" : "opacity-0")} /> {s}
                </button>
              </li>
            );
          })}
          {canAdd && (
            <li>
              <button type="button" onClick={add} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted">
                <Check className="h-4 w-4 opacity-0" /> Add "{text.trim()}"
              </button>
            </li>
          )}
          {!list.length && !canAdd && <li className="px-2 py-1.5 text-muted-foreground">No services</li>}
        </ul>
      )}
    </div>
  );
}
