import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createReceipt, listPayments } from "@/config/api/agency.api";
import { EmptyState, PageHeader, Pager, StatusBadge, TextLink, errMsg } from "@/components/agency/common";
import { ConfirmPaymentDialog, useRefreshMoney } from "@/components/agency/PaymentDialogs";
import { toast } from "sonner";
import { docPath, formatDate, formatINR, idOf, METHOD_LABEL, nameOf, PAYMENT_TYPE_LABEL, type Payment } from "@/types/agency";

export default function PaymentsPage() {
  const navigate = useNavigate();
  const refresh = useRefreshMoney();
  const [tab, setTab] = useState<"pending" | "received">("pending");
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<Payment | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["payments", tab, page], queryFn: () => listPayments({ status: tab, page, limit: 10 }) });
  const receipt = useMutation({
    mutationFn: (id: string) => createReceipt(id),
    onSuccess: (doc) => { refresh(); navigate(docPath(doc)); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Payments" description="Payments only count as received once you confirm them. Requests are created from a project." />
      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setPage(1); }}>
        <TabsList><TabsTrigger value="pending">Pending</TabsTrigger><TabsTrigger value="received">Received</TabsTrigger></TabsList>
      </Tabs>
      {isLoading ? <Skeleton className="h-48 w-full" /> : rows.length === 0 ? <EmptyState text={tab === "pending" ? "No pending payments. Nothing is waiting on a client." : "No confirmed payments yet."} /> : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>{tab === "pending" ? "Due" : "Received"}</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p._id}>
                  <TableCell><TextLink to={`/dashboard/projects/${idOf(p.project)}`}>{nameOf(p.project as { name: string })}</TextLink><div className="text-xs text-muted-foreground">{nameOf(p.client as { name: string })}</div></TableCell>
                  <TableCell>{PAYMENT_TYPE_LABEL[p.type]}{p.method && <div className="text-xs text-muted-foreground">{METHOD_LABEL[p.method]}</div>}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(p.amount)}</TableCell>
                  <TableCell>{formatDate(tab === "pending" ? p.dueDate : p.receivedDate)}</TableCell>
                  <TableCell><StatusBadge value={p.status} /></TableCell>
                  <TableCell className="text-right">
                    {p.status === "pending"
                      ? <Button size="sm" onClick={() => setConfirming(p)}><BadgeCheck className="h-4 w-4" /> Confirm received</Button>
                      : <Button size="sm" variant="outline" disabled={receipt.isPending} onClick={() => receipt.mutate(p._id)}><Receipt className="h-4 w-4" /> Receipt</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager pagination={data?.pagination} onPage={setPage} />
      <ConfirmPaymentDialog payment={confirming} onOpenChange={(o) => !o && setConfirming(null)} />
    </div>
  );
}
