import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, CirclePlus, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteProject, listProjects } from "@/config/api/agency.api";
import { ConfirmDialog, EmptyState, PageHeader, Pager, RowActions, StatusBadge, errMsg } from "@/components/agency/common";
import { RoleGuard } from "@/components/RoleGuard";
import { useProfileStore } from "@/config/store/profile";
import { formatINR, nameOf, PROJECT_STATUS_LABEL, type Project, type ProjectStatus } from "@/types/agency";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isOwner = useProfileStore((s) => s.profile?.role) === "OWNER";
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["projects", status, page],
    queryFn: () => listProjects({ page, limit: 10, status: status === "all" ? undefined : status }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => { for (const k of ["projects", "dashboard", "clients"]) qc.invalidateQueries({ queryKey: [k] }); toast.success("Project deleted"); setToDelete(null); },
    onError: (e) => { toast.error(errMsg(e)); setToDelete(null); },
  });
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Projects"
        description="Work progress and payment status are tracked separately."
        actions={
          <>
            <Select value={status} onValueChange={(v) => { setStatus(v as ProjectStatus | "all"); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue>{status === "all" ? "Status" : PROJECT_STATUS_LABEL[status]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <RoleGuard behavior="hide" allowedRoles={["OWNER"]}>
              <Button onClick={() => navigate("/dashboard/projects/create")}><CirclePlus className="h-4 w-4" /> New project</Button>
            </RoleGuard>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState text="No projects here yet." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client / Business</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Progress</TableHead>
                {isOwner && <><TableHead>Pricing</TableHead><TableHead>Invoice</TableHead></>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p._id} className="cursor-pointer" onClick={() => navigate(`/dashboard/projects/${p._id}`)}>
                  <TableCell>
                    <div className="font-medium">{nameOf(p.client)}</div>
                    {p.businessName && <div className="text-xs text-muted-foreground">{p.businessName}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {(p.services ?? []).length ? p.services!.map((s) => <Badge key={s} variant="secondary" className="border-0 font-normal">{s}</Badge>) : <span className="text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge value={p.status} label={PROJECT_STATUS_LABEL[p.status]} /></TableCell>
                  {isOwner && (
                    <>
                      <TableCell>
                        <div className="text-sm font-medium tabular-nums">{formatINR(p.finance?.agreed)}</div>
                        <div className="text-xs text-muted-foreground">{p.pricingType === "one_time" ? "One-time" : p.subscription?.stoppedAt ? "Subscription · stopped" : `Subscription · ${p.subscription?.frequency}`}</div>
                      </TableCell>
                      <TableCell>
                        {p.pricingType === "one_time" && (
                          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {([["advance", "50% invoice"], ["remaining", "Balance invoice"]] as const).map(([part, label]) => {
                              const made = p.invoiceParts?.[part]; // generated: purple, and it opens that invoice instead of making a second one
                              const f = p.finance;
                              const half = (f?.agreed ?? 0) / 2;
                              // green only once the money is in: 50% received for the advance, nothing remaining for the balance
                              const paid = !!f && f.agreed > 0 && (part === "advance" ? f.received >= half : f.remaining <= 0);
                              return (
                                <Button
                                  key={part} size="sm" variant="outline"
                                  className={`h-7 rounded-full px-3 text-xs ${paid ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800" : made ? "border-violet-200 bg-violet-100 text-violet-700 hover:bg-violet-200 hover:text-violet-800" : ""}`}
                                  onClick={() => navigate(made ? `/dashboard/invoices/${made}/edit` : `/dashboard/invoices/create?project=${p._id}&part=${part}`)}
                                >
                                  {paid && <Check className="h-3.5 w-3.5" />} {label}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    <RowActions actions={[
                      { label: "View", icon: Eye, onClick: () => navigate(`/dashboard/projects/${p._id}`) },
                      { label: "Edit", icon: Pencil, hidden: !isOwner, onClick: () => navigate(`/dashboard/projects/${p._id}/edit`) },
                      { label: "Delete", icon: Trash2, danger: true, hidden: !isOwner, onClick: () => setToDelete(p) },
                    ]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager pagination={data?.pagination} onPage={setPage} />
      <ConfirmDialog
        open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} pending={del.isPending} title={`Delete "${toDelete?.name}"?`}
        description="Its tasks, pending payment requests and documents are deleted too. Projects with received payments can't be deleted; mark them cancelled instead."
        onConfirm={() => toDelete && del.mutate(toDelete._id)}
      />
    </div>
  );
}
