/**
 * Renoble mark: the transparent logo (public/frame-13.png) with no background box.
 * The file is white, so it is tinted dark to stay visible on light pages.
 */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/frame-13.png"
      alt="Renoble"
      className={className}
      style={{ width: size, height: size, objectFit: "contain", filter: "brightness(0)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    />
  );
}
