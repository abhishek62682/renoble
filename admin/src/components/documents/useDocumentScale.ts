import { useEffect, useRef, useState } from "react";

/** Scale the 794px A4 sheet to fit its container width. */
export function useDocumentScale(sheetWidth = 595) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(3, el.clientWidth / sheetWidth))); // fill the available width (grow or shrink)
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheetWidth]);
  return { ref, scale };
}
