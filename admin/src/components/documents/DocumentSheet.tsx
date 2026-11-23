import { LogoMark } from "@/components/LogoMark";
import { useBrand } from "@/config/useBrand";
import { calcTotals, formatDate, KIND_LABEL, METHOD_LABEL, type BankDetails, type DocKind, type DocumentRecord, type PaymentMethod } from "@/types/agency";


/** A4 in CSS px at the PDF's native size (595 × 842 pt). Everything below is positioned from the reference invoice. */
export const SHEET_W = 595;
export const SHEET_H = 842;

type Sheet = Pick<DocumentRecord, "items" | "taxPercent" | "advanceReceived" | "billedTo" | "from" | "thankYou" | "terms" | "issueDate" | "dueDate" | "paymentInfo"> & {
  kind: DocKind;
  number: string;
  bank?: BankDetails; // invoices only
};

const C = {
  dark: "#1a1c21",
  gray: "#5e6470",
  rule: "#f0f1f4",
  rule2: "#e4e6ea",
  purple: "#7241fa",
  purpleLine: "#7c4cff",
  icon: "#8b919e",
  dot: "#e8743b", // bullet colour
};
const isBullet = (l: string) => /^\s*[-•*]\s+/.test(l);
const stripBullet = (l: string) => l.replace(/^\s*[-•*]\s+/, "");

const money = (n: number) => "₹ " + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const COLS = "312px 24px 80px 99px"; // Service | Qty | Rate | Total  (x = 40 / 352 / 376 / 456 → 555)

export function DocumentSheet({ doc }: { doc: Sheet }) {
  const { accentColor } = useBrand();
  const t = calcTotals(doc);
  const isInvoice = doc.kind === "invoice";
  const isReceipt = doc.kind === "receipt";
  const b = doc.bank;
  // "Notes & Terms": one bullet per line of the terms box (not shown on receipts)
  const termLines = isReceipt ? [] : (doc.terms || "").split("\n").map((l) => stripBullet(l).trim()).filter(Boolean);
  // quotations say how long they stay valid, worked out from the issue and valid-until dates
  const validDays = doc.kind === "quotation" && doc.dueDate
    ? Math.max(Math.round((new Date(doc.dueDate).getTime() - new Date(doc.issueDate).getTime()) / 86400000), 0) : null;
  const bankLines = isInvoice && b
    ? ([["Account name", b.accountName], ["A/c No", b.accountNumber], ["IFSC", b.ifsc], ["Branch", b.branch], ["UPI", b.upi]] as const).filter(([, v]) => v)
    : [];

  const party = (p: Sheet["billedTo"], showEmail = true) => (
    <div style={{ color: C.gray, overflowWrap: "anywhere", wordBreak: "break-word" }}>
      <div style={{ fontWeight: 500, fontSize: 10.6 }}>{p.name || "—"}</div>
      {p.address && <div style={{ whiteSpace: "pre-line" }}>{p.address}</div>}
      {p.phone && <div>{p.phone}</div>}
      {showEmail && p.email && <div style={{ fontSize: 10.5 }}>{p.email}</div>}
    </div>
  );

  const row = (label: string, value: string, opts: { valueColor?: string; last?: boolean } = {}) => (
    <div
      style={{
        display: "flex", justifyContent: "space-between", height: 34, boxSizing: "border-box", paddingTop: 9.4,
        borderBottom: opts.last ? "none" : `1px solid ${C.rule}`,
      }}
    >
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ color: opts.valueColor ?? C.gray }}>{value}</span>
    </div>
  );

  const accentLabel = isReceipt ? "Amount received" : isInvoice ? "Amount due" : "Grand total";
  const accentValue = isInvoice ? t.due : t.total;

  return (
    <div
      id="print-doc"
      style={{
        position: "relative", width: SHEET_W, height: SHEET_H, background: "#fff", color: C.dark, overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, lineHeight: "16px",
      }}
    >
      {/* title + number + logo */}
      <div style={{ position: "absolute", left: 40, top: 26.5, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ fontSize: 28, fontWeight: 500, lineHeight: "40px", letterSpacing: "-0.01em", textTransform: "uppercase" }}>{KIND_LABEL[doc.kind]}</span>
        <span style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 9.5, lineHeight: "14px", letterSpacing: "0.02em", color: C.gray,
        }}>{doc.number?.replace(/^RENOBLE-/, "") || "—"}</span>
      </div>
      <div style={{ position: "absolute", right: 40, top: 30 }}><LogoMark size={44} /></div>

      {/* items */}
      <div style={{ position: "absolute", left: 40, top: 111.5, width: 515 }}>
      {/* issued / billed to / from */}
      <div
        style={{
          width: 515, minHeight: 112, marginBottom: 31.5, boxSizing: "border-box",
          borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}`, display: "grid", gridTemplateColumns: "166px 182px 167px", alignItems: "stretch",
        }}
      >
        <div style={{ paddingTop: 15, paddingBottom: 14 }}>
          <div style={{ fontWeight: 500 }}>{isReceipt ? "Received on" : "Issued"}</div>
          <div style={{ marginTop: 4, color: C.gray }}>{formatDate(doc.issueDate)}</div>
          {!isReceipt && (
            <>
              <div style={{ marginTop: 8, fontWeight: 500 }}>{doc.kind === "quotation" ? "Valid until" : "Due"}</div>
              <div style={{ marginTop: 4, color: C.gray }}>{formatDate(doc.dueDate)}</div>
            </>
          )}
        </div>
        <div style={{ paddingTop: 15, paddingBottom: 14, paddingLeft: 16, paddingRight: 8, borderLeft: `1px solid ${C.rule2}` }}>
          <div style={{ fontWeight: 500 }}>{isReceipt ? "Received from" : doc.kind === "quotation" ? "Prepared for" : "Billed to"}</div>
          <div style={{ marginTop: 4 }}>{party(doc.billedTo)}</div>
        </div>
        <div style={{ paddingTop: 15, paddingBottom: 14, paddingLeft: 16, borderLeft: `1px solid ${C.rule2}` }}>
          <div style={{ fontWeight: 500 }}>From</div>
          <div style={{ marginTop: 4 }}>{party(doc.from, false)}</div>
        </div>
      </div>


        <div style={{ minHeight: 130.5 }}>
        <div
          style={{
            display: "grid", gridTemplateColumns: COLS, height: 32.5, boxSizing: "border-box", paddingTop: 8.4,
            borderBottom: `1px solid ${C.rule2}`, fontWeight: 500,
          }}
        >
          <span>{isReceipt ? "Description" : "Service"}</span>
          <span>Qty</span>
          <span style={{ textAlign: "right" }}>Rate</span>
          <span style={{ textAlign: "right" }}>Total</span>
        </div>
        {doc.items.map((it, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: COLS, paddingTop: i === 0 ? 9.5 : 6, color: C.gray, lineHeight: "18px" }}>
            <div style={{ paddingRight: 12 }}>
              <div style={{ fontWeight: 500, color: C.dark }}>{it.title || "Untitled item"}</div>
              {it.description && (
                <div style={{ lineHeight: "16px" }}>
                  {it.description.split("\n").map((line, k) => (isBullet(line)
                    ? <div key={k} style={{ display: "flex", gap: 6, paddingLeft: 6 }}><span style={{ color: C.dot }}>•</span><span>{stripBullet(line)}</span></div>
                    : <div key={k}>{line}</div>))}
                </div>
              )}
            </div>
            <span>{it.qty}</span>
            <span style={{ textAlign: "right" }}>{money(it.rate)}</span>
            <span style={{ textAlign: "right" }}>{money((Number(it.qty) || 0) * (Number(it.rate) || 0))}</span>
          </div>
        ))}
        </div>

      {/* totals (fixed so the rule always sits at the reference position) */}
      <div style={{ width: 515, borderTop: `1px solid ${C.rule}` }}>
        <div style={{ marginLeft: 312, width: 203 }}>
          {row("Subtotal", money(t.subtotal))}
          {row(`Tax (${doc.taxPercent || 0}%)`, money(t.tax), { last: !isInvoice || t.advance <= 0 })}
          {isInvoice && t.advance > 0 && row("Advance Received", money(t.advance), { valueColor: C.dark, last: true })}
          <div
            style={{
              display: "flex", justifyContent: "space-between", boxSizing: "border-box", height: 34, paddingTop: 9.4,
              borderTop: `2px solid ${accentColor}`, borderBottom: `2px solid ${accentColor}`, color: accentColor, fontWeight: 500,
            }}
          >
            <span>{accentLabel}</span>
            <span>{money(accentValue)}</span>
          </div>
        </div>
        {isReceipt && doc.paymentInfo?.method && (
          <div style={{ marginTop: 14, textAlign: "right", color: C.gray }}>
            Paid via {METHOD_LABEL[doc.paymentInfo.method as PaymentMethod] ?? doc.paymentInfo.method}
            {doc.paymentInfo.reference ? ` · Ref: ${doc.paymentInfo.reference}` : ""}
          </div>
        )}
      </div>
      </div>

      {/* closing note + terms: anchored just above the footer rule and growing upward, so long terms never touch the footer */}
      {(doc.thankYou || termLines.length > 0 || validDays !== null || bankLines.length > 0) && (
        <div style={{ position: "absolute", left: 40, right: 40, bottom: SHEET_H - 773 }}>
          {bankLines.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 500 }}>Payment details</div>
              {bankLines.map(([k, v]) => <div key={k} style={{ color: C.gray }}>{k}: {v}</div>)}
            </div>
          )}
          {termLines.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 500, marginBottom: 2 }}>Notes &amp; Terms</div>
              {termLines.map((line, k) => (
                <div key={k} style={{ display: "flex", gap: 6, paddingLeft: 6, color: C.gray }}><span style={{ color: C.dot }}>•</span><span>{line}</span></div>
              ))}
            </div>
          )}
          {doc.thankYou && <div style={{ fontWeight: 500 }}>{doc.thankYou}</div>}
          {validDays !== null && <div style={{ color: C.gray }}>This quotation is valid for {validDays} days from the issue date.</div>}
        </div>
      )}

      {/* footer */}
      <div style={{ position: "absolute", left: 40, top: 781, width: 515, borderTop: `1px solid ${C.rule}` }} />
      <div style={{ position: "absolute", left: 40, top: 794, width: 515, display: "flex", justifyContent: "space-between", color: C.gray }}>
        <span>{doc.from.website || "renoble.agency"}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {doc.from.phone && <span>{doc.from.phone}</span>}
          {doc.from.phone && doc.from.email && <span style={{ width: 1, height: 12, background: C.rule2 }} />}
          {doc.from.email && <span>{doc.from.email}</span>}
        </span>
      </div>
    </div>
  );
}

/** Opens the print dialog (choose "Save as PDF"); the file is named after the document number. */
export function printDocument(number: string) {
  const prev = document.title;
  document.title = number;
  const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
}
