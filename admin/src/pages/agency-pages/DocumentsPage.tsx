import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRightLeft, CirclePlus, FolderPlus, Download, Eye, Pencil, Receipt, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { convertQuotation, deleteDocument, projectFromQuotation, receiptForInvoice, listDocuments, setDocumentStatus } from "@/config/api/agency.api";
import { InvoiceReceiptDialog } from "@/components/agency/PaymentDialogs";
import { ConfirmDialog, EmptyState, PageHeader, Pager, RowActions, StatusBadge, errMsg } from "@/components/agency/common";
import { calcTotals, docPath, formatDate, formatINR, KIND_LABEL, KIND_PATH, nameOf, type DocKind, type DocumentRecord } from "@/types/agency";

export default function DocumentsPage() {
  const { pathname } = useLocation();
  const kind: DocKind = pathname.includes("/invoices") ? "invoice" : pathname.includes("/receipts") ? "receipt" : "quotation";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<DocumentRecord | null>(null);
  const [receiptFor, setReceiptFor] = useState<DocumentRecord | null>(null); // invoice whose receipt dialog is open

  const { data, isLoading } = useQuery({ queryKey: ["documents", kind, page], queryFn: () => listDocuments({ kind, page, limit: 10 }) });
  const del = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents"] }); qc.invalidateQueries({ queryKey: ["project"] }); toast.success("Deleted"); setToDelete(null); },
    onError: (e) => { toast.error(errMsg(e)); setToDelete(null); },
  });
  const convert = useMutation({
    mutationFn: (id: string) => convertQuotation(id),
    onSuccess: (inv) => { qc.invalidateQueries({ queryKey: ["documents"] }); toast.success(`Invoice ${inv.number} ready`); navigate(docPath(inv)); },
    onError: (e) => toast.error(errMsg(e)),
  });
  // a paid invoice already has its receipt: just open it; otherwise ask for the payment details first
  const openReceipt = useMutation({
    mutationFn: (id: string) => receiptForInvoice(id),
    onSuccess: (r) => navigate(docPath(r)),
    onError: (e) => toast.error(errMsg(e)),
  });
  const makeProject = useMutation({
    mutationFn: (id: string) => projectFromQuotation(id),
    onSuccess: (p) => { for (const k of ["documents", "projects", "clients", "dashboard"]) qc.invalidateQueries({ queryKey: [k] }); toast.success("Project created"); navigate(`/dashboard/projects/${p._id}/edit`); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const markSent = useMutation({
    mutationFn: (id: string) => setDocumentStatus(id, "sent"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents"] }); toast.success("Marked as sent"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const rows = data?.data ?? [];
  const label = KIND_LABEL[kind];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${label}s`}
        description={kind === "receipt" ? "Receipts are issued from a confirmed payment on the project page." : kind === "invoice" ? "Invoices and payment requests." : "Quotations you have sent to clients."}
        actions={kind !== "receipt" && <Button onClick={() => navigate(`${KIND_PATH[kind]}/create`)}><CirclePlus className="h-4 w-4" /> New {label.toLowerCase()}</Button>}
      />
      {isLoading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        : rows.length === 0 ? <EmptyState text={`No ${label.toLowerCase()}s yet.`} />
        : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Client / project</TableHead><TableHead className="hidden sm:table-cell">Issued</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((d) => {
                  const t = calcTotals(d);
                  return (
                    <TableRow key={d._id} className="cursor-pointer" onClick={() => navigate(docPath(d))}>
                      <TableCell className="font-medium">{d.number}</TableCell>
                      <TableCell><div>{d.billedTo?.name || nameOf(d.client)}</div><div className="text-xs text-muted-foreground">{d.project ? nameOf(d.project as { name: string }) : "No project yet"}</div></TableCell>
                      <TableCell className="hidden sm:table-cell">{formatDate(d.issueDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(kind === "invoice" ? t.due : t.total)}{kind === "invoice" && <div className="text-xs text-muted-foreground">due</div>}</TableCell>
                      <TableCell><StatusBadge value={d.status} /></TableCell>
                      <TableCell>
                        <RowActions actions={[
                          { label: kind === "receipt" ? "View / download" : "Edit", icon: kind === "receipt" ? Eye : Pencil, onClick: () => navigate(docPath(d)) },
                          { label: "Download PDF", icon: Download, onClick: () => navigate(`${docPath(d)}?print=1`) },
                          { label: "Mark as sent", icon: Send, hidden: kind === "receipt" || d.status !== "draft", disabled: markSent.isPending, onClick: () => markSent.mutate(d._id) },
                          { label: "Create project", icon: FolderPlus, hidden: kind !== "quotation" || !!d.project, disabled: makeProject.isPending, onClick: () => makeProject.mutate(d._id) },
                          { label: "Convert to invoice", icon: ArrowRightLeft, hidden: kind !== "quotation" || !d.project, disabled: convert.isPending, onClick: () => convert.mutate(d._id) },
                          { label: d.status === "paid" ? "View receipt" : "Generate receipt", icon: Receipt, hidden: kind !== "invoice", disabled: openReceipt.isPending, onClick: () => (d.status === "paid" ? openReceipt.mutate(d._id) : setReceiptFor(d)) },
                          { label: "Delete", icon: Trash2, danger: true, hidden: kind === "receipt", onClick: () => setToDelete(d) },
                        ]} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      <Pager pagination={data?.pagination} onPage={setPage} />
      <InvoiceReceiptDialog invoice={receiptFor} onOpenChange={(o) => !o && setReceiptFor(null)} onDone={(r) => navigate(docPath(r))} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} pending={del.isPending} title={`Delete ${toDelete?.number}?`} description="This can't be undone." onConfirm={() => toDelete && del.mutate(toDelete._id)} />
    </div>
  );
}
