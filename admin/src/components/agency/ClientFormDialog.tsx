import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient, updateClient, type ClientInput } from "@/config/api/agency.api";
import { Field, errMsg } from "@/components/agency/common";
import { toInputDate, type Client } from "@/types/agency";
import type { ApiAxiosError } from "@/types/error";

const EMPTY: ClientInput = {
  type: "lead", name: "", email: "", phone: "", address: "", notes: "", nextFollowUpDate: null, followUpNote: "",
};

export function ClientFormDialog({ open, onOpenChange, client, defaultType = "lead", onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; client?: Client | null; defaultType?: "lead" | "client"; onSaved?: (c: Client) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ClientInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(client
      ? { type: client.type, name: client.name, email: client.email, phone: client.phone,
          address: client.address, notes: client.notes, nextFollowUpDate: toInputDate(client.nextFollowUpDate) || null, followUpNote: client.followUpNote }
      : { ...EMPTY, type: defaultType });
  }, [open, client, defaultType]);

  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => (client ? updateClient(client._id, form) : createClient(form)),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", saved._id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(client ? "Details updated" : `${saved.type === "lead" ? "Lead" : "Client"} added`);
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (e: ApiAxiosError) => {
      const fe = e.response?.data?.fieldErrors;
      if (fe) setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]?.message ?? "Invalid"])));
      toast.error(errMsg(e));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{client ? "Edit details" : "Add lead or client"}</DialogTitle>
          <DialogDescription>{form.type === "lead" ? "Contact details, notes and the next follow-up." : "Contact details."}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        >
          <Field label="Client name" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Type">
            <Select value={form.type} onValueChange={(v) => set("type", v as "lead" | "client")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead (potential client)</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" />
          </Field>
          <Field label="Email" error={errors.email} hint="Invoices and quotations are addressed here.">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          {form.type === "lead" && (
            <>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            <Field label="Next follow-up">
              <Input type="date" value={form.nextFollowUpDate ?? ""} onChange={(e) => set("nextFollowUpDate", e.target.value || null)} />
            </Field>
            <Field label="Follow-up note">
              <Input value={form.followUpNote} onChange={(e) => set("followUpNote", e.target.value)} placeholder="e.g. Share quotation" />
            </Field>
            </>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} {client ? "Save changes" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
