import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, FileText, Pencil, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createReceipt, deleteProject, getProject, removePayment, setProjectStatus } from "@/config/api/agency.api";
import { ConfirmDialog, EmptyState, StatCard, StatusBadge, TextLink, errMsg } from "@/components/agency/common";
import { ConfirmPaymentDialog, useRefreshMoney } from "@/components/agency/PaymentDialogs";
import { TaskPanel } from "@/components/agency/TaskPanel";
import { useProfileStore } from "@/config/store/profile";
import {
  docPath, formatDate, formatINR, KIND_LABEL, METHOD_LABEL, nameOf, PAYMENT_TYPE_LABEL, PROJECT_STATUS_LABEL,
  type Payment, type ProjectStatus,
} from "@/types/agency";

export default function ProjectDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const refresh = useRefreshMoney();
  const isOwner = useProfileStore((s) => s.profile?.role) === "OWNER";

  const [confirming, setConfirming] = useState<Payment | null>(null);
  const [delOpen, setDelOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id) });

  const status = useMutation({
    mutationFn: (s: ProjectStatus) => setProjectStatus(id, s),
    onSuccess: () => { refresh(); toast.success("Status updated"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: () => deleteProject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Project deleted"); navigate("/dashboard/projects"); },
    onError: (e) => { toast.error(errMsg(e)); setDelOpen(false); },
  });
  const receipt = useMutation({
    mutationFn: (paymentId: string) => createReceipt(paymentId),
    onSuccess: (doc) => { refresh(); navigate(docPath(doc)); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const cancel = useMutation({
    mutationFn: (paymentId: string) => removePayment(paymentId),
    onSuccess: () => { refresh(); toast.success("Request removed"); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (isError || !data) return <EmptyState text="This project could not be found." action={<Button size="sm" onClick={() => navigate("/dashboard/projects")}>Back to projects</Button>} />;
  const { project: p, payments, documents, tasks } = data;
  const f = p.finance;
  const invoiceFor = (paymentId: string) => documents.find((d) => d.kind === "invoice" && d.payment === paymentId);
  const receiptFor = (paymentId: string) => documents.find((d) => d.kind === "receipt" && d.payment === paymentId);

  return (
    <div className="space-y-4">
      <Link to="/dashboard/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{nameOf(p.client)}</h2>
          {(p.businessName || p.startDate || p.deadline) && (
            <p className="text-sm text-muted-foreground">
              {[p.businessName, p.startDate && `Start ${formatDate(p.startDate)}`, p.deadline && `Deadline ${formatDate(p.deadline)}`].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={p.status} onValueChange={(v) => status.mutate(v as ProjectStatus)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => navigate(`/dashboard/projects/${id}/edit`)}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="outline" size="icon" onClick={() => setDelOpen(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      </div>

      {!!p.services?.length && <div className="flex flex-wrap gap-2">{p.services.map((s) => <span key={s} className="rounded-full border px-3 py-1 text-xs font-medium">{s}</span>)}</div>}
      {p.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{p.description}</p>}

      {isOwner && f && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={p.pricingType === "one_time" ? "Total agreed" : "Per cycle"} value={formatINR(f.agreed)} hint={p.pricingType === "one_time" ? "One-time cost" : `Subscription · ${p.subscription?.frequency}`} />
            <StatCard label="Received" value={formatINR(f.received)} tone="green" />
            <StatCard label={p.pricingType === "one_time" ? "Remaining" : "Requested, unpaid"} value={formatINR(p.pricingType === "one_time" ? f.remaining : f.pendingRequested)} tone="amber" />
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment status</p>
              <div className="mt-2"><StatusBadge value={f.paymentStatus} /></div>
              {p.pricingType === "subscription" && <p className="mt-2 text-xs text-muted-foreground">Next payment {formatDate(p.subscription?.nextPaymentDate)}</p>}
            </div>
          </div>
        </>
      )}

      <Tabs defaultValue={isOwner ? "payments" : "tasks"}>
        <TabsList>
          {isOwner && <TabsTrigger value="payments">Payments</TabsTrigger>}
          {isOwner && <TabsTrigger value="documents">Documents</TabsTrigger>}
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        </TabsList>

        {isOwner && (
          <TabsContent value="payments" className="space-y-3">
            <div className="flex justify-end">
            </div>
            {payments.length === 0 ? <EmptyState text="No payments yet. Request the advance to get started." /> : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {payments.map((pay) => {
                      const inv = invoiceFor(pay._id);
                      const rc = receiptFor(pay._id);
                      return (
                        <TableRow key={pay._id}>
                          <TableCell>
                            <div className="font-medium">{PAYMENT_TYPE_LABEL[pay.type]}</div>
                            {pay.method && <div className="text-xs text-muted-foreground">{METHOD_LABEL[pay.method]}{pay.reference && ` · ${pay.reference}`}</div>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(pay.amount)}</TableCell>
                          <TableCell><StatusBadge value={pay.status} /></TableCell>
                          <TableCell className="text-sm">{pay.status === "received" ? `Received ${formatDate(pay.receivedDate)}` : pay.dueDate ? `Due ${formatDate(pay.dueDate)}` : "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              {pay.status === "pending" && (
                                <>
                                  {inv
                                    ? <Button size="sm" variant="outline" onClick={() => navigate(docPath(inv))}><FileText className="h-4 w-4" /> {inv.number}</Button>
                                    : <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/invoices/create?project=${p._id}&payment=${pay._id}`)}><FileText className="h-4 w-4" /> Invoice</Button>}
                                  <Button size="sm" onClick={() => setConfirming(pay)}><BadgeCheck className="h-4 w-4" /> Confirm received</Button>
                                  <Button size="icon" variant="ghost" onClick={() => cancel.mutate(pay._id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                                </>
                              )}
                              {pay.status === "received" && (rc
                                ? <Button size="sm" variant="outline" onClick={() => navigate(docPath(rc))}><Receipt className="h-4 w-4" /> {rc.number}</Button>
                                : <Button size="sm" variant="outline" disabled={receipt.isPending} onClick={() => receipt.mutate(pay._id)}><Receipt className="h-4 w-4" /> Issue receipt</Button>)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="documents" className="space-y-3">
            {documents.length === 0 ? <EmptyState text="No quotations, invoices or receipts for this project yet." /> : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Issued</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {documents.map((d) => (
                      <TableRow key={d._id}>
                        <TableCell><TextLink to={docPath(d)}>{d.number}</TextLink></TableCell>
                        <TableCell>{KIND_LABEL[d.kind]}</TableCell>
                        <TableCell>{formatDate(d.issueDate)}</TableCell>
                        <TableCell><StatusBadge value={d.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="tasks"><TaskPanel tasks={tasks} projectId={p._id} /></TabsContent>
      </Tabs>

      <ConfirmPaymentDialog payment={confirming} onOpenChange={(o) => !o && setConfirming(null)} />
      <ConfirmDialog
        open={delOpen} onOpenChange={setDelOpen} pending={del.isPending} title={`Delete "${p.name}"?`}
        description="Its tasks, pending payment requests and documents are deleted too. Projects with received payments can't be deleted; mark them cancelled instead."
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}
