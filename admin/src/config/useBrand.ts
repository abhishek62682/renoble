import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/config/api/agency.api";

export const DEFAULT_PANEL = "#1a1a1a";
export const DEFAULT_ACCENT = "#7241fa";

/** Colours chosen in Settings (cached; falls back to the defaults while loading). */
export function useBrand() {
  const { data } = useQuery({ queryKey: ["settings"], queryFn: getSettings, staleTime: 5 * 60 * 1000 });
  return { panelColor: data?.panelColor || DEFAULT_PANEL, accentColor: data?.accentColor || DEFAULT_ACCENT };
}
