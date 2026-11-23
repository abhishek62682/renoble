import { DocumentSheet, SHEET_H, SHEET_W } from "@/components/documents/DocumentSheet";
import { useDocumentScale } from "@/components/documents/useDocumentScale";
import type { ComponentProps } from "react";

/** Responsive wrapper: shrinks the A4 sheet on small screens; printing resets the scale (see index.css). */
export function ScaledSheet({ doc }: ComponentProps<typeof DocumentSheet>) {
  const { ref, scale } = useDocumentScale();
  return (
    <div ref={ref} className="w-full">
      <div className="doc-scale-wrap" style={{ height: SHEET_H * scale, width: SHEET_W * scale }}>
        <div className="doc-scale-inner" style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: SHEET_W }}>
          <DocumentSheet doc={doc} />
        </div>
      </div>
    </div>
  );
}
