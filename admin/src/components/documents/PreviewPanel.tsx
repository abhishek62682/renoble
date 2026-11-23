import { useState, type ComponentProps } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentSheet } from "@/components/documents/DocumentSheet";
import { ScaledSheet } from "@/components/documents/ScaledSheet";
import { ChevronDown } from "lucide-react";
import { useBrand } from "@/config/useBrand";

const GRID = "https://cdn.cosmofeed.com/assets/images/patterns/grid-pattern.png";
const DEVICES = { desktop: "100%", tablet: "560px", mobile: "340px" } as const;
type Device = keyof typeof DEVICES;

/** Dark grid panel with a browser-window frame around the live document. */
export function PreviewPanel({ doc, url, className = "" }: { doc: ComponentProps<typeof DocumentSheet>["doc"]; url: string; className?: string }) {
  const [device, setDevice] = useState<Device>("desktop");
  const { panelColor } = useBrand();
  return (
    <section
      className={`flex h-full min-w-0 flex-col overflow-hidden bg-[#1a1a1a] px-5 py-6 sm:px-10 lg:px-16 ${className}`}
      style={{ backgroundImage: `url(${GRID})`, backgroundColor: panelColor }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Preview</h2>
        <Select value={device} onValueChange={(v) => setDevice(v as Device)}>
          <SelectTrigger className="h-11 w-[132px] rounded-lg border-white/15 bg-transparent text-base text-white hover:bg-white/10 [&_svg]:text-white">
            <SelectValue />
            <ChevronDown className="hidden" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desktop">Desktop</SelectItem>
            <SelectItem value="tablet">Tablet</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* the browser frame stays put; only the page inside it scrolls */}
      <div className="mt-8 min-h-0 flex-1 pb-6">
        <div
          className="mx-auto flex h-full max-h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101010] shadow-[0_20px_60px_rgba(0,0,0,0.55)] transition-[max-width] duration-300"
          style={{ maxWidth: DEVICES[device] }}
        >
          <div className="flex shrink-0 items-center gap-4 px-4 py-3">
            <div className="flex gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="mx-auto w-full max-w-[60%] truncate rounded-md bg-[#3a3a3a] px-3 py-1 text-center text-[11px] text-white/80">{url}</div>
            <div className="w-[52px]" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
            <ScaledSheet doc={doc} />
          </div>
        </div>
      </div>
    </section>
  );
}
