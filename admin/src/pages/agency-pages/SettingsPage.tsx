import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { getSettings, saveSettings } from "@/config/api/agency.api";
import { Field, PageHeader, errMsg } from "@/components/agency/common";
import { DEFAULT_ACCENT, DEFAULT_PANEL } from "@/config/useBrand";
import type { BusinessSettings } from "@/types/agency";
import type { ApiAxiosError } from "@/types/error";

/** One place for your own business details. Every quotation, invoice and receipt picks these up. */
export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [form, setForm] = useState<BusinessSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (data) setForm({ ...data }); }, [data]);

  const save = useMutation({
    mutationFn: () => saveSettings(form!),
    onSuccess: (s) => { qc.setQueryData(["settings"], s); toast.success("Settings saved", { description: "New quotations, invoices and receipts will use these details." }); setErrors({}); },
    onError: (e: ApiAxiosError) => {
      const fe = e.response?.data?.fieldErrors;
      if (fe) setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]?.message ?? "Invalid"])));
      toast.error(errMsg(e));
    },
  });

  if (isLoading || !form) return <Skeleton className="h-96 w-full" />;
  const set = <K extends keyof BusinessSettings>(k: K, v: BusinessSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <form
      className="w-full space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (form.businessName.trim().length < 2) return setErrors({ businessName: "Business name is required" }); save.mutate(); }}
    >
      <PageHeader title="Settings" description="Your details are saved once and used on every document." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your business</CardTitle>
          <CardDescription>Shown in the “From” block and the footer of quotations, invoices and receipts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" required error={errors.businessName} className="sm:col-span-2">
            <Input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
          </Field>
          <Field label="Phone" error={errors.phone}><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" /></Field>
          <Field label="Email" error={errors.email}><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Website" hint="Printed at the bottom-left of every document." error={errors.website}>
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="renoble.agency" />
          </Field>
          <Field label="Address" className="sm:col-span-2" error={errors.address}>
            <Textarea rows={3} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder={"Street, area\nCity, State – PIN"} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank details</CardTitle>
          <CardDescription>Printed at the bottom of every invoice.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Account holder name"><Input value={form.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} /></Field>
          <Field label="Account number"><Input value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} /></Field>
          <Field label="IFSC code"><Input value={form.bankIfsc} onChange={(e) => set("bankIfsc", e.target.value)} /></Field>
          <Field label="Branch"><Input value={form.bankBranch} onChange={(e) => set("bankBranch", e.target.value)} /></Field>
          <Field label="UPI ID" className="sm:col-span-2"><Input value={form.bankUpi} onChange={(e) => set("bankUpi", e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Colours used by the quotation / invoice preview and the documents themselves.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Preview panel colour" hint="Background behind the document preview." value={form.panelColor} fallback={DEFAULT_PANEL} error={errors.panelColor} onChange={(v) => set("panelColor", v)} />
          <ColorField label="Document accent colour" hint="The highlighted total (e.g. “Amount due”) line." value={form.accentColor} fallback={DEFAULT_ACCENT} error={errors.accentColor} onChange={(v) => set("accentColor", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults for new documents</CardTitle>
          <CardDescription>You can still change these on any single quotation or invoice.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Tax (%)"><Input type="number" min={0} max={100} value={form.taxPercent} onChange={(e) => set("taxPercent", num(e.target.value))} /></Field>
          <Field label="Invoice due in (days)"><Input type="number" min={0} value={form.invoiceDueDays} onChange={(e) => set("invoiceDueDays", num(e.target.value))} /></Field>
          <Field label="Quotation valid for (days)"><Input type="number" min={0} value={form.quotationValidDays} onChange={(e) => set("quotationValidDays", num(e.target.value))} /></Field>
          <Field label="Invoice closing note" className="sm:col-span-3"><Input value={form.invoiceThankYou} onChange={(e) => set("invoiceThankYou", e.target.value)} /></Field>
          <Field label="Invoice terms" className="sm:col-span-3"><Textarea rows={2} value={form.invoiceTerms} onChange={(e) => set("invoiceTerms", e.target.value)} /></Field>
          <Field label="Quotation closing note" className="sm:col-span-3"><Input value={form.quotationThankYou} onChange={(e) => set("quotationThankYou", e.target.value)} /></Field>
          <Field label="Quotation terms" className="sm:col-span-3"><Textarea rows={2} value={form.quotationTerms} onChange={(e) => set("quotationTerms", e.target.value)} /></Field>
          <Field label="Quotation terms (subscription projects)" className="sm:col-span-3"><Textarea rows={4} value={form.quotationSubscriptionTerms ?? ""} onChange={(e) => set("quotationSubscriptionTerms", e.target.value)} /></Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending} className="h-11 rounded-full bg-black px-8 text-white hover:bg-black/85">
          {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} Save settings
        </Button>
      </div>
    </form>
  );
}

function ColorField({ label, hint, value, fallback, error, onChange }: { label: string; hint: string; value: string; fallback: string; error?: string; onChange: (v: string) => void }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color" aria-label={label} value={valid ? value : fallback} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="max-w-32 font-mono uppercase" maxLength={7} />
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(fallback)}>Reset</Button>
      </div>
    </Field>
  );
}
