import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProject, getProject, listClients, listProjects, updateProject, type ProjectInput } from "@/config/api/agency.api";
import { Field, PageHeader, errMsg } from "@/components/agency/common";
import { ServicePicker } from "@/components/agency/ServicePicker";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_LABEL, toInputDate, type PricingType } from "@/types/agency";
import type { ApiAxiosError } from "@/types/error";

type Form = {
  client: string; name: string; businessName: string; services: string[]; description: string; status: ProjectInput["status"];
  startDate: string; deadline: string; pricingType: PricingType;
  totalPrice: string; advanceAmount: string;
  subAmount: string; frequency: string; subStart: string; nextPayment: string;
};
/** No typed project name: it is the business (or the client) plus the services, e.g. "Acme – Website Development". */
const projectName = (who: string, services: string[]) => [who.trim(), services.join(", ")].filter(Boolean).join(" – ") || "Project";

const EMPTY: Form = {
  client: "", name: "", businessName: "", services: [], description: "", status: "awaiting_approval", startDate: "", deadline: "", pricingType: "one_time",
  totalPrice: "", advanceAmount: "", subAmount: "", frequency: "monthly", subStart: "", nextPayment: "",
};

export default function ProjectFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const [form, setForm] = useState<Form>({ ...EMPTY, client: sp.get("client") ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false); // editing: the saved values are in the form
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const clients = useQuery({ queryKey: ["clients", "all-options"], queryFn: () => listClients({ limit: 100 }) });
  const clientName = clients.data?.data.find((c) => c._id === form.client)?.name ?? "";
  // businesses this client already has projects for (shown as suggestions)
  const prior = useQuery({ queryKey: ["projects", "by-client", form.client], queryFn: () => listProjects({ client: form.client, limit: 100 }), enabled: !!form.client });
  const knownBusinesses = [...new Set((prior.data?.data ?? []).map((p) => p.businessName).filter(Boolean))] as string[];
  const existing = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id!), enabled: editing });

  useEffect(() => {
    const p = existing.data?.project;
    if (!p) return;
    setForm({
      client: p.client._id, name: p.name, businessName: p.businessName ?? "", services: p.services ?? [], description: p.description, status: p.status,
      startDate: toInputDate(p.startDate), deadline: toInputDate(p.deadline), pricingType: p.pricingType,
      totalPrice: String(p.oneTime?.totalPrice ?? ""), advanceAmount: String(p.oneTime?.advanceAmount ?? ""),
      subAmount: String(p.subscription?.amount ?? ""), frequency: p.subscription?.frequency ?? "monthly",
      subStart: toInputDate(p.subscription?.startDate), nextPayment: toInputDate(p.subscription?.nextPaymentDate),
    });
    setLoaded(true);
  }, [existing.data]);

  const save = useMutation({
    mutationFn: () => {
      const body: ProjectInput = {
        client: form.client, name: projectName(form.businessName || clientName, form.services), businessName: form.businessName.trim(), services: form.services, description: form.description, status: form.status,
        startDate: form.startDate || null, deadline: form.deadline || null, pricingType: form.pricingType,
        ...(form.pricingType === "one_time"
          ? { oneTime: { totalPrice: Number(form.totalPrice), advanceAmount: Number(form.advanceAmount) || 0 } }
          : { subscription: { amount: Number(form.subAmount), frequency: form.frequency, startDate: form.subStart || null, nextPaymentDate: form.nextPayment || null } }),
      };
      return editing ? updateProject(id!, body) : createProject(body);
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", p._id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "Project updated" : "Project created");
      navigate(`/dashboard/projects/${p._id}`);
    },
    onError: (e: ApiAxiosError) => {
      const fe = e.response?.data?.fieldErrors;
      if (fe) setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]?.message ?? "Invalid"])));
      toast.error(errMsg(e));
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.client) er.client = "Select a client";
    if (form.pricingType === "one_time") {
      if (!(Number(form.totalPrice) > 0)) er["oneTime.totalPrice"] = "Enter the agreed total price";
      if (Number(form.advanceAmount) > Number(form.totalPrice)) er["oneTime.advanceAmount"] = "Advance can't exceed the total";
    } else {
      if (!(Number(form.subAmount) > 0)) er["subscription.amount"] = "Enter the recurring amount";
      if (!form.subStart) er["subscription.startDate"] = "Start date is required";
      if (!form.nextPayment) er["subscription.nextPaymentDate"] = "Next payment date is required";
    }
    setErrors(er);
    if (Object.keys(er).length === 0) save.mutate();
  };

  const remaining = Math.max((Number(form.totalPrice) || 0) - (Number(form.advanceAmount) || 0), 0);

  // when editing, show the form only once the saved values and the client list are ready, so the dropdowns open with their values filled
  if (editing && (!loaded || !clients.data)) return <Skeleton className="h-96 w-full" />;

  return (
    <form onSubmit={submit} className="w-full space-y-4">
      <Link to={editing ? `/dashboard/projects/${id}` : "/dashboard/projects"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title={editing ? "Edit project" : "New project"} />

      <Card>
        <CardHeader><CardTitle className="text-base">Project details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" required error={errors.client}>
            <Select value={form.client} onValueChange={(v) => set("client", v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select client or lead" /></SelectTrigger>
              <SelectContent>
                {(clients.data?.data ?? []).map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Business name" error={errors.businessName}>
            <Input list="known-businesses" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} placeholder="e.g. Acme Pvt. Ltd." />
            <datalist id="known-businesses">{knownBusinesses.map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
          <Field label="Services" className="sm:col-span-2">
            <ServicePicker value={form.services} onChange={(v) => set("services", v)} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="Start date"><Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
          <Field label="Deadline"><Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v as Form["status"])}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
          <p className="text-sm text-muted-foreground">Choose one. A project uses either a one-time cost or a subscription, never both.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([["one_time", "One-Time Cost"], ["subscription", "Subscription-Based"]] as const).map(([v, label]) => (
              <button
                type="button" key={v} onClick={() => set("pricingType", v)} disabled={editing && existing.data?.payments.some((p) => p.status === "received")}
                className={cn("rounded-lg border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                  form.pricingType === v ? "border-(--color-blue) bg-(--color-blue)/10 text-(--color-blue)" : "hover:bg-muted")}
              >
                {label}
              </button>
            ))}
          </div>

          {form.pricingType === "one_time" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Agreed total price (₹)" required error={errors["oneTime.totalPrice"]}>
                <Input type="number" min={0} value={form.totalPrice} onChange={(e) => set("totalPrice", e.target.value)} />
              </Field>
              <Field label="Advance (₹)" error={errors["oneTime.advanceAmount"]} hint="Agreed advance. Money is only counted once a payment is confirmed.">
                <Input type="number" min={0} value={form.advanceAmount} onChange={(e) => set("advanceAmount", e.target.value)} />
              </Field>
              <p className="text-sm text-muted-foreground sm:col-span-2">Balance after advance: <b className="text-foreground">₹{remaining.toLocaleString("en-IN")}</b></p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Recurring amount (₹)" required error={errors["subscription.amount"]}>
                <Input type="number" min={0} value={form.subAmount} onChange={(e) => set("subAmount", e.target.value)} />
              </Field>
              <Field label="Billing frequency" required>
                <Select value={form.frequency} onValueChange={(v) => set("frequency", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Subscription start date" required error={errors["subscription.startDate"]}>
                <Input type="date" value={form.subStart} onChange={(e) => set("subStart", e.target.value)} />
              </Field>
              <Field label="Next payment date" required error={errors["subscription.nextPaymentDate"]}>
                <Input type="date" value={form.nextPayment} onChange={(e) => set("nextPayment", e.target.value)} />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} {editing ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
