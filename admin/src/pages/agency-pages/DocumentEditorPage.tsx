import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRightLeft, Download, Eye, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  convertQuotation, createDocument, getDocument, getNextNumber, getSettings, getProject, listClients, listProjects, setDocumentStatus, updateDocument, type DocumentInput,
} from "@/config/api/agency.api";
import { Field, errMsg } from "@/components/agency/common";
import { PreviewPanel } from "@/components/documents/PreviewPanel";
import { printDocument } from "@/components/documents/DocumentSheet";
import { calcTotals, formatINR, type BankDetails, idOf, KIND_LABEL, KIND_PATH, toInputDate, type DocKind, type LineItem, type Party } from "@/types/agency";
import type { ApiAxiosError } from "@/types/error";

type Kind = "quotation" | "invoice";
const todayStr = () => toInputDate(new Date().toISOString());
const plusDays = (iso: string, d: number) => { const x = new Date(iso + "T00:00:00"); x.setDate(x.getDate() + d); return toInputDate(x.toISOString()); };
const blankItem = (): LineItem => ({ title: "", description: "", qty: 1, rate: 0 });
const emptyParty: Party = { name: "", address: "", phone: "", email: "" };
const DEFAULTS: Record<Kind, { thankYou: string; terms: string; days: number }> = {
  quotation: { thankYou: "Thank you for considering Renoble!", terms: "Payment: 50% advance to start work, remaining 50% on completion.\nIf any third-party service changes its price or policy, the extra cost is paid by the client.", days: 15 },
  invoice: { thankYou: "Thank you for the business!", terms: "", days: 7 },
};

const STEPS = ["Details", "Services & Totals"];
const inp = "h-12 rounded-lg border-neutral-200 bg-white text-[15px] shadow-none focus-visible:ring-1";

export default function DocumentEditorPage() {
  const { id } = useParams();
  const editing = !!id;
  const { pathname } = useLocation();
  const kind: Kind = pathname.includes("/invoices") ? "invoice" : "quotation";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const paymentId = sp.get("payment");
  const part = sp.get("part"); // "advance" = 50% invoice, "remaining" = balance invoice (from the projects list)

  const [step, setStep] = useState(0);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [projectId, setProjectId] = useState(sp.get("project") ?? "");
  const [issueDate, setIssueDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState(plusDays(todayStr(), DEFAULTS[kind].days));
  const [billedTo, setBilledTo] = useState<Party>(emptyParty);
  const [from, setFrom] = useState<Party>(emptyParty);
  const [items, setItems] = useState<LineItem[]>([blankItem()]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [thankYou, setThankYou] = useState(DEFAULTS[kind].thankYou);
  const [terms, setTerms] = useState(DEFAULTS[kind].terms);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadedFor, setLoadedFor] = useState("");
  const [showBank, setShowBank] = useState(false);
  const [bank, setBank] = useState<BankDetails>({ accountName: "", accountNumber: "", ifsc: "", branch: "", upi: "" });
  const bankReady = useRef(false);

  const existing = useQuery({ queryKey: ["document", id], queryFn: () => getDocument(id!), enabled: editing });
  const [clientId, setClientId] = useState(sp.get("client") ?? ""); // quotations: a client or lead, no project needed yet
  const clients = useQuery({ queryKey: ["clients", "options"], queryFn: () => listClients({ limit: 100 }), enabled: !editing && kind === "quotation" });
  // opened from a lead's / client's "Quotation" action: fill the billing details from them
  useEffect(() => {
    const c = clients.data?.data.find((x) => x._id === sp.get("client"));
    if (c && !editing && kind === "quotation" && !billedTo.name) setBilledTo({ name: c.name, address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients.data]);
  const projects = useQuery({ queryKey: ["projects", "options"], queryFn: () => listProjects({ limit: 100 }), enabled: !editing });
  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId), enabled: !!projectId && !editing });

  // "Download PDF" from the list opens this page with ?print=1 and goes straight to the print dialog
  useEffect(() => {
    if (editing && existing.data && sp.get("print")) { const t = setTimeout(() => printDocument(existing.data!.number), 700); return () => clearTimeout(t); }
  }, [editing, existing.data, sp]);

  // the number this document will get when saved (shown straight away, assigned by the server on save)
  const nextNo = useQuery({ queryKey: ["next-number", kind, issueDate.slice(0, 7)], queryFn: () => getNextNumber(kind, issueDate), enabled: !editing && /^\d{4}-\d{2}-\d{2}$/.test(issueDate) });

  // your business details + defaults come from Settings (applied once to a NEW document)
  const settings = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const appliedSettings = useRef(false);
  useEffect(() => {
    const b = settings.data;
    if (editing || !b || appliedSettings.current) return;
    appliedSettings.current = true;
    setFrom({ name: b.businessName, address: b.address, phone: b.phone, email: b.email, website: b.website });
    setTaxPercent(b.taxPercent);
    setDueDate(plusDays(issueDate, kind === "invoice" ? b.invoiceDueDays : b.quotationValidDays));
    setThankYou(kind === "invoice" ? b.invoiceThankYou : b.quotationThankYou);
    setTerms(kind === "invoice" ? b.invoiceTerms : b.quotationTerms);
  }, [settings.data, editing, kind, issueDate]);

  // load a saved document into the form
  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    setProjectId(d.project ? idOf(d.project) : ""); setIssueDate(toInputDate(d.issueDate)); setDueDate(toInputDate(d.dueDate));
    setBilledTo(d.billedTo); setFrom(d.from); setItems(d.items.map((i) => ({ ...i }))); setTaxPercent(d.taxPercent);
    setAdvance(d.advanceReceived); setThankYou(d.thankYou); setTerms(d.terms);
  }, [existing.data]);

  // prefill a NEW document from the chosen project (client details, price, advance already received)
  useEffect(() => {
    if (editing || !project.data || loadedFor === projectId + (paymentId ?? "") + (part ?? "")) return;
    const { project: p, payments } = project.data;
    const client = p.client;
    setBilledTo({ name: p.businessName || client.name || "", address: client.address ?? "", phone: client.phone ?? "", email: client.email ?? "" });
    const received = payments.filter((x) => x.status === "received").reduce((s, x) => s + x.amount, 0);
    const pay = payments.find((x) => x._id === paymentId);
    const lineTitle = p.services?.length ? p.services.join(", ") : p.name; // the services, not the client/business name
    const label = pay ? { advance: "Advance payment", partial: "Part payment", final: "Final payment", subscription: "Subscription payment" }[pay.type] : "";
    if (p.pricingType === "one_time") {
      const total = p.oneTime?.totalPrice ?? 0;
      if (!pay && (part === "advance" || part === "remaining")) {
        if (part === "advance") {
          setItems([{ title: lineTitle, description: `Advance payment (50% of ${formatINR(total)} project)`, qty: 1, rate: Math.round(total / 2) }]);
        } else {
          const paid = received > 0 ? received : Math.round(total / 2); // what is already paid, or the 50% advance
          setItems([{ title: lineTitle, description: "Full project price", qty: 1, rate: total }]);
          setAdvance(paid); // shown as "Advance Received", so Amount due is the balance
        }
        if (part === "advance") setAdvance(0);
      } else if (pay && pay.type !== "final") {
        // invoice for an advance / part payment bills exactly that payment
        setItems([{ title: lineTitle, description: label, qty: 1, rate: pay.amount }]);
        setAdvance(0);
      } else {
        // final balance (or a general invoice): full price, minus what is already received
        setItems([{ title: lineTitle, description: pay ? label : p.description.slice(0, 120), qty: 1, rate: p.oneTime?.totalPrice ?? 0 }]);
        if (kind === "invoice") setAdvance(received);
      }
    } else {
      setItems([{ title: lineTitle, description: `Subscription · ${p.subscription?.frequency}`, qty: 1, rate: pay ? pay.amount : (p.subscription?.amount ?? 0) }]);
    }
    setLoadedFor(projectId + (paymentId ?? "") + (part ?? ""));
  }, [project.data, editing, kind, loadedFor, projectId, paymentId, part]);

  const number = existing.data?.number ?? nextNo.data ?? "…";
  // bank details: start from the saved invoice, else from Settings; editable per invoice, switch hides the block
  useEffect(() => {
    if (kind !== "invoice" || bankReady.current || (editing && !existing.data)) return;
    const b0 = existing.data?.bank;
    const saved = b0 && (b0.accountName || b0.accountNumber || b0.ifsc || b0.branch || b0.upi) ? b0 : undefined; // older invoices have none: use Settings
    const s = settings.data;
    if (saved) { setShowBank(saved.show); setBank({ accountName: saved.accountName, accountNumber: saved.accountNumber, ifsc: saved.ifsc, branch: saved.branch, upi: saved.upi }); bankReady.current = true; }
    else if (s) {
      setBank({ accountName: s.bankAccountName || s.businessName, accountNumber: s.bankAccountNumber, ifsc: s.bankIfsc, branch: s.bankBranch, upi: s.bankUpi });
      setShowBank(!!(s.bankAccountNumber || s.bankUpi || s.bankIfsc));
      bankReady.current = true;
    }
  }, [kind, editing, existing.data, settings.data]);
  const setBankField = (k: keyof BankDetails, v: string) => setBank((b) => ({ ...b, [k]: v }));
  const bankOut = kind === "invoice" && showBank ? bank : undefined;
  const doc = useMemo(() => ({ kind: kind as DocKind, number, issueDate, dueDate: dueDate || null, billedTo, from, items, taxPercent, advanceReceived: advance, thankYou, terms, bank: bankOut }), [kind, number, issueDate, dueDate, billedTo, from, items, taxPercent, advance, thankYou, terms, bankOut]);
  const totals = calcTotals(doc);
  const payload = (): DocumentInput => ({ issueDate, dueDate: dueDate || null, billedTo, from, items, taxPercent, advanceReceived: advance, thankYou, terms, ...(kind === "invoice" ? { bank: { show: showBank, ...bank } } : {}) });
  const createExtra = (): { part?: "advance" | "remaining" } => (kind === "invoice" && (part === "advance" || part === "remaining") ? { part } : {});

  const save = useMutation({
    mutationFn: () => (editing ? updateDocument(id!, payload()) : createDocument({ ...payload(), ...createExtra(), kind, project: projectId || undefined, client: !projectId && clientId ? clientId : undefined, payment: paymentId })),
    onSuccess: (d) => {
      for (const k of ["documents", "document", "project", "next-number"]) qc.invalidateQueries({ queryKey: [k] });
      toast.success(`${KIND_LABEL[kind]} ${d.number} saved`);
      // back to where you came from: the projects list (50% / balance buttons), otherwise the invoices / quotations list
      navigate(part ? "/dashboard/projects" : KIND_PATH[kind], { replace: true });
    },
    onError: (e: ApiAxiosError) => {
      const fe = e.response?.data?.fieldErrors;
      if (fe) setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]?.message ?? "Invalid"])));
      toast.error(errMsg(e));
    },
  });

  const status = useMutation({
    mutationFn: (s: string) => setDocumentStatus(id!, s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["document", id] }); qc.invalidateQueries({ queryKey: ["documents"] }); toast.success("Status updated"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const convert = useMutation({
    mutationFn: () => convertQuotation(id!),
    onSuccess: (inv) => { qc.invalidateQueries({ queryKey: ["documents"] }); toast.success(`Invoice ${inv.number} ready`); navigate(`/dashboard/invoices/${inv._id}/edit`); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const validate = (which: number) => {
    const er: Record<string, string> = {};
    if (which === 0) {
      if (!editing && !projectId && !(kind === "quotation" && clientId)) er.project = kind === "quotation" ? "Select a client or lead" : "Select a project";
      if (!billedTo.name.trim()) er.billedTo = "Client name is required";
      if (!from.name.trim()) er.from = "Your business name is required";
    } else if (items.some((i) => !i.title.trim())) er.items = "Every item needs a title";
    setErrors(er);
    if (Object.keys(er).length) { toast.error(Object.values(er)[0]); return false; }
    return true;
  };

  const next = () => {
    if (step === 0) { if (validate(0)) setStep(1); return; }
    if (validate(0) && validate(1)) save.mutate();
  };

  const setItem = (i: number, patch: Partial<LineItem>) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const party = (p: Party, set: (p: Party) => void, k: keyof Party, label: string, ph = "", required = false, error?: string) => (
    <Field label={label} required={required} error={error}>
      {k === "address"
        ? <Textarea rows={2} className="rounded-lg border-neutral-200 text-[15px] shadow-none" value={p[k]} onChange={(e) => set({ ...p, [k]: e.target.value })} placeholder={ph} />
        : <Input className={inp} value={p[k]} onChange={(e) => set({ ...p, [k]: e.target.value })} placeholder={ph} />}
    </Field>
  );

  const label = KIND_LABEL[kind];
  const statusOptions = kind === "quotation" ? ["sent", "approved", "rejected"] : ["sent"];
  const currentStatus = existing.data?.status;
  const loading = editing && existing.isLoading;

  return (
    <div className="flex h-screen flex-col bg-white lg:flex-row">
      {/* ── left: form ─────────────────────────────────────── */}
      <div className={`${mobilePreview ? "hidden" : "flex"} h-full min-h-0 w-full flex-col lg:flex lg:w-[43%]`}>
        <header className="flex h-16 shrink-0 items-center gap-4 border-b px-5 sm:px-8">
          <Link to={KIND_PATH[kind]} aria-label="Close" className="text-neutral-900 hover:opacity-70"><X className="h-6 w-6" /></Link>
          <span className="h-5 w-px bg-neutral-300" />
          <span className="whitespace-nowrap text-lg font-medium">{editing ? existing.data?.number ?? label : `New ${label.toLowerCase()}`}</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <button key={i} type="button" aria-label={`Step ${i + 1}`} onClick={() => (i === 0 || validate(0)) && setStep(i)}
                  className={`h-2 w-2 rounded-full ${i === step ? "bg-black" : "bg-neutral-300"}`} />
              ))}
            </div>
            <span className="hidden whitespace-nowrap text-[15px] text-neutral-500 xl:inline">Step {step + 1} - {STEPS[step]}</span>
            <Button type="button" variant="outline" size="sm" className="lg:hidden" onClick={() => setMobilePreview(true)}><Eye className="h-4 w-4" /> Preview</Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10">
          {loading ? <div className="space-y-4"><Skeleton className="h-10" /><Skeleton className="h-48" /></div> : step === 0 ? (
            <div className="space-y-6">
              <h1 className="text-xl font-semibold">Tell us about your {label.toLowerCase()}</h1>

              {!editing && kind === "quotation" && !projectId && (
                <Field label="Client / Lead" required error={errors.project}>
                  <Select
                    value={clientId}
                    onValueChange={(v) => {
                      setClientId(v);
                      const c = clients.data?.data.find((x) => x._id === v);
                      if (c) setBilledTo({ name: c.name, address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "" });
                    }}
                  >
                    <SelectTrigger className={`${inp} w-full`}><SelectValue placeholder="Select client or lead" /></SelectTrigger>
                    <SelectContent>{(clients.data?.data ?? []).map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
              {!editing && (kind === "invoice" || !!projectId) && (
                <Field label="Project" required error={errors.project} hint="Client details and price are filled in from the project.">
                  <Select value={projectId} onValueChange={(v) => { setProjectId(v); setLoadedFor(""); }}>
                    <SelectTrigger className={`${inp} w-full`}><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>{(projects.data?.data ?? []).map((p) => <SelectItem key={p._id} value={p._id}>{p.client.name}{p.businessName ? ` (${p.businessName})` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Issue date"><Input type="date" className={inp} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
                <Field label={kind === "quotation" ? "Valid until" : "Due date"}><Input type="date" className={inp} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
              </div>

              <div className="space-y-4 rounded-xl border border-dashed border-neutral-300 p-5">
                <h3 className="font-semibold">{kind === "quotation" ? "Prepared for" : "Billed to"}</h3>
                {party(billedTo, setBilledTo, "name", "Business / client", "Business name", true, errors.billedTo)}
                {party(billedTo, setBilledTo, "address", "Address")}
                <div className="grid grid-cols-2 gap-4">{party(billedTo, setBilledTo, "phone", "Phone")}{party(billedTo, setBilledTo, "email", "Email")}</div>
              </div>

              <div className="space-y-4 rounded-xl border border-dashed border-neutral-300 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">From</h3>
                  <Link to="/dashboard/settings" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Edit in Settings</Link>
                </div>
                {party(from, setFrom, "name", "Business / name", "", true, errors.from)}
                {party(from, setFrom, "address", "Address")}
                <div className="grid grid-cols-2 gap-4">{party(from, setFrom, "phone", "Phone")}{party(from, setFrom, "email", "Email")}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h1 className="text-xl font-semibold">Add your services</h1>
              {errors.items && <p className="text-sm text-destructive">{errors.items}</p>}

              {items.map((it, i) => (
                <div key={i} className="space-y-3 rounded-xl border border-neutral-200 p-4">
                  <div className="flex gap-2">
                    <Input className={inp} placeholder="Service / item" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
                    <Button type="button" size="icon" variant="ghost" className="h-12 w-12" disabled={items.length === 1} onClick={() => setItems((a) => a.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Textarea rows={2} className="rounded-lg border-neutral-200 text-[15px] shadow-none" placeholder={"Short description (optional)\nStart a line with - for a bullet"} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Qty"><Input type="number" min={0} className={inp} value={it.qty || ""} placeholder="0" onChange={(e) => setItem(i, { qty: Number(e.target.value) })} /></Field>
                    <Field label="Rate (₹)"><Input type="number" min={0} className={inp} value={it.rate || ""} placeholder="0" onChange={(e) => setItem(i, { rate: Number(e.target.value) })} /></Field>
                    <Field label="Line total"><div className="flex h-12 items-center text-[15px] tabular-nums">{formatINR((it.qty || 0) * (it.rate || 0))}</div></Field>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="h-11 w-full rounded-lg border-dashed" onClick={() => setItems((a) => [...a, blankItem()])}><Plus className="h-4 w-4" /> Add another service</Button>

              <div className={kind === "invoice" ? "grid grid-cols-2 gap-4" : ""}>
                <Field label="Tax (%)"><Input type="number" min={0} max={100} className={inp} value={taxPercent || ""} placeholder="0" onChange={(e) => setTaxPercent(Number(e.target.value))} /></Field>
                {kind === "invoice" && (
                  <Field label="Advance received (₹)" hint="Filled in from confirmed payments."><Input type="number" min={0} className={inp} value={advance || ""} placeholder="0" onChange={(e) => setAdvance(Number(e.target.value))} /></Field>
                )}
              </div>
              <div className="flex justify-between rounded-lg bg-neutral-100 px-4 py-3 font-medium">
                <span>{kind === "invoice" ? "Amount due" : "Grand total"}</span>
                <span className="tabular-nums">{formatINR(kind === "invoice" ? totals.due : totals.total)}</span>
              </div>

              <Field label="Closing note"><Input className={inp} value={thankYou} onChange={(e) => setThankYou(e.target.value)} /></Field>
              <Field label="Notes & Terms"><Textarea rows={2} className="rounded-lg border-neutral-200 text-[15px] shadow-none" value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>

              {kind === "invoice" && (
                <div className="space-y-3 rounded-lg border border-neutral-200 p-4">
                  <label className="flex cursor-pointer items-center justify-between gap-3 font-medium">
                    Show bank details
                    <Switch checked={showBank} onCheckedChange={setShowBank} />
                  </label>
                  {showBank && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Account name"><Input className={inp} value={bank.accountName} onChange={(e) => setBankField("accountName", e.target.value)} /></Field>
                      <Field label="A/c No"><Input className={inp} value={bank.accountNumber} onChange={(e) => setBankField("accountNumber", e.target.value)} /></Field>
                      <Field label="IFSC"><Input className={inp} value={bank.ifsc} onChange={(e) => setBankField("ifsc", e.target.value)} /></Field>
                      <Field label="Branch"><Input className={inp} value={bank.branch} onChange={(e) => setBankField("branch", e.target.value)} /></Field>
                      <Field label="UPI" className="sm:col-span-2"><Input className={inp} value={bank.upi} onChange={(e) => setBankField("upi", e.target.value)} /></Field>
                    </div>
                  )}
                </div>
              )}

              {editing && (
                <div className="flex flex-wrap items-center gap-3 border-t pt-5">
                  <Field label="Status" className="w-44">
                    <Select value={currentStatus} onValueChange={(v) => status.mutate(v)}>
                      <SelectTrigger className={`${inp} w-full`}><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>)}
                        {currentStatus && !statusOptions.includes(currentStatus) && <SelectItem value={currentStatus} disabled>{currentStatus.replace("_", " ")}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </Field>
                  {kind === "quotation" && (
                    <Button type="button" variant="outline" className="mt-6 h-12 rounded-lg" disabled={convert.isPending} onClick={() => convert.mutate()}><ArrowRightLeft className="h-4 w-4" /> Convert to invoice</Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t px-5 py-4 sm:px-8">
          {step === 1 && <Button type="button" variant="ghost" className="mr-auto h-12 rounded-full px-6" onClick={() => setStep(0)}>Back</Button>}
          {editing && step === 1 && (
            <Button type="button" variant="outline" className="h-12 rounded-full px-6" onClick={() => printDocument(existing.data?.number ?? "document")}><Download className="h-4 w-4" /> PDF</Button>
          )}
          <Button type="button" onClick={next} disabled={save.isPending} className="h-12 rounded-full bg-black px-8 text-base font-medium text-white hover:bg-black/85">
            {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {step === 0 ? "Save and Continue" : editing ? "Save changes" : `Save ${label.toLowerCase()}`}
          </Button>
        </footer>
      </div>

      {/* ── right: live preview ────────────────────────────── */}
      <div className={`${mobilePreview ? "flex" : "hidden"} relative h-full min-h-0 min-w-0 flex-1 flex-col lg:flex print:flex`}>
        <Button type="button" size="sm" variant="secondary" className="absolute right-4 top-16 z-10 lg:hidden" onClick={() => setMobilePreview(false)}>Back to form</Button>
        <PreviewPanel doc={doc} url="renoble.agency" />
      </div>
    </div>
  );
}
