import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { confirmPayment, createPayment, receiptForInvoice } from "@/config/api/agency.api";
import { Field, errMsg } from "@/components/agency/common";
import {
  formatINR, METHOD_LABEL, nameOf, PAYMENT_TYPE_LABEL, toInputDate,
  calcTotals, type DocumentRecord, type Payment, type PaymentMethod, type PaymentType, type Project,
} from "@/types/agency";

export const useRefreshMoney = () => {
  const qc = useQueryClient();
  return () => {
    for (const k of ["project", "projects", "payments", "client", "documents", "dashboard", "summary"]) qc.invalidateQueries({ queryKey: [k] });
  };
};

export function RequestPaymentDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project: Project }) {
  const refresh = useRefreshMoney();
  const isSub = project.pricingType === "subscription";
  const types: PaymentType[] = isSub ? ["subscription"] : ["advance", "partial", "final"];
  const suggest = (t: PaymentType) =>
    t === "advance" ? project.oneTime?.advanceAmount ?? 0
    : t === "final" ? project.finance?.remaining ?? 0
    : t === "subscription" ? project.subscription?.amount ?? 0 : 0;

  const [type, setType] = useState<PaymentType>(types[0]);
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = isSub ? "subscription" : (project.finance?.received ?? 0) > 0 || (project.finance?.pendingRequested ?? 0) > 0 ? "final" : "advance";
    setType(t);
    setAmount(String(suggest(t) || ""));
    setDue(isSub ? toInputDate(project.subscription?.nextPaymentDate) : "");
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMutation({
    mutationFn: () => createPayment({ project: project._id, type, amount: Number(amount), dueDate: due || null, note }),
    onSuccess: () => { refresh(); toast.success("Payment request saved", { description: "It is pending until you confirm the money was received." }); onOpenChange(false); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a payment</DialogTitle>
          <DialogDescription>
            {project.name}
            {!isSub && <> · Remaining {formatINR(project.finance?.remaining)}</>}. This does not count as received yet.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (Number(amount) > 0) save.mutate(); else toast.error("Enter an amount"); }}>
          <Field label="Payment type">
            <Select value={type} onValueChange={(v) => { setType(v as PaymentType); setAmount(String(suggest(v as PaymentType) || "")); }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{PAYMENT_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)" required><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Due date"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
          <Field label="Note"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} Save request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** From the invoices list: confirm the invoice's money has arrived, and get its receipt in one step. */
export function InvoiceReceiptDialog({ invoice, onOpenChange, onDone }: { invoice: DocumentRecord | null; onOpenChange: (o: boolean) => void; onDone: (receipt: DocumentRecord) => void }) {
  const refresh = useRefreshMoney();
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (invoice) { setMethod(""); setReference(""); setDate(toInputDate(new Date().toISOString())); }
  }, [invoice]);

  const save = useMutation({
    mutationFn: () => receiptForInvoice(invoice!._id, { method: method as PaymentMethod, reference, receivedDate: date || null }),
    onSuccess: (receipt) => { refresh(); toast.success(`Receipt ${receipt.number} ready`); onOpenChange(false); onDone(receipt); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate receipt</DialogTitle>
          <DialogDescription>{invoice && <>{invoice.number} · {formatINR(calcTotals(invoice).due)}</>}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          This records the payment as received and marks the invoice paid. Only continue if the money has actually arrived.
        </div>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!method) return toast.error("Select how it was paid"); save.mutate(); }}>
          <Field label="Received via" required>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>{Object.entries(METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Received on"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Reference / UTR"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} Money received, generate receipt</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmPaymentDialog({ payment, onOpenChange }: { payment: Payment | null; onOpenChange: (o: boolean) => void }) {
  const refresh = useRefreshMoney();
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (payment) { setMethod(""); setReference(""); setDate(toInputDate(new Date().toISOString())); }
  }, [payment]);

  const save = useMutation({
    mutationFn: () => confirmPayment(payment!._id, { method: method as PaymentMethod, reference, receivedDate: date || null }),
    onSuccess: () => { refresh(); toast.success("Payment confirmed", { description: "You can now issue a receipt for it." }); onOpenChange(false); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm payment received</DialogTitle>
          <DialogDescription>
            {payment && <>{formatINR(payment.amount)} · {PAYMENT_TYPE_LABEL[payment.type]} · {nameOf(payment.project as { name: string })}</>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Only confirm after the money has actually reached your account or hand. This can't be undone.
        </div>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!method) return toast.error("Select how it was paid"); save.mutate(); }}>
          <Field label="Received via" required>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>{Object.entries(METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Received on"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Reference / UTR"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} Yes, money received</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
