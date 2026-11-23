import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRightCircle, CirclePlus, FileSignature, FolderPlus, History, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteClient, listClients, updateClient } from "@/config/api/agency.api";
import { ClientFormDialog } from "@/components/agency/ClientFormDialog";
import { LeadActivitySheet } from "@/components/agency/LeadActivitySheet";
import { ConfirmDialog, EmptyState, Pager, PageHeader, RowActions, errMsg, useDebounced } from "@/components/agency/common";
import { formatDate, type Client } from "@/types/agency";

/** Potential clients and the story of each: every contact, what was said, when to follow up. */
export default function LeadsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [active, setActive] = useState<Client | null>(null); // lead whose timeline is open
  const q = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", "lead", q, page],
    queryFn: () => listClients({ page, limit: 10, search: q || undefined, type: "lead" }),
  });

  const refresh = () => { for (const k of ["clients", "client", "dashboard"]) qc.invalidateQueries({ queryKey: [k] }); };
  const del = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => { refresh(); toast.success("Deleted"); setToDelete(null); },
    onError: (e) => { toast.error(errMsg(e)); setToDelete(null); },
  });
  const convert = useMutation({
    mutationFn: (id: string) => updateClient(id, { type: "client", nextFollowUpDate: null, followUpNote: "" }),
    onSuccess: (c) => { refresh(); toast.success(`${c.name} is now a client`); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const rows = data?.data ?? [];
  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads"
        description="Track every conversation until a lead becomes a client."
        actions={<Button onClick={() => setOpen(true)}><CirclePlus className="h-4 w-4" /> Add lead</Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, email, phone…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState text={q ? "Nothing matches this view." : "No leads yet."} action={<Button size="sm" onClick={() => setOpen(true)}>Add the first lead</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead>Next follow-up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                return (
                  <TableRow key={c._id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell"><div>{c.phone || "—"}</div><div>{c.email}</div></TableCell>
                    <TableCell className="hidden max-w-56 truncate text-sm text-muted-foreground lg:table-cell" title={c.address}>{c.address || "—"}</TableCell>
                    <TableCell>
                      {c.nextFollowUpDate ? (
                        <div className={new Date(c.nextFollowUpDate) <= endOfToday ? "text-amber-600" : ""}>
                          <div className="text-sm font-medium">{formatDate(c.nextFollowUpDate)}</div>
                          {c.followUpNote && <div className="max-w-48 truncate text-xs text-muted-foreground">{c.followUpNote}</div>}
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setActive(c)}><History className="h-4 w-4" /> Timeline</Button>
                        <RowActions actions={[
                          { label: "Convert to client", icon: ArrowRightCircle, disabled: convert.isPending, onClick: () => convert.mutate(c._id) },
                          { label: "New quotation", icon: FileSignature, onClick: () => navigate(`/dashboard/quotations/create?client=${c._id}`) },
                          { label: "New project", icon: FolderPlus, onClick: () => navigate(`/dashboard/projects/create?client=${c._id}`) },
                          { label: "Edit", icon: Pencil, onClick: () => setEditing(c) },
                          { label: "Delete", icon: Trash2, danger: true, onClick: () => setToDelete(c) },
                        ]} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager pagination={data?.pagination} onPage={setPage} />

      <LeadActivitySheet lead={active} onOpenChange={(o) => !o && setActive(null)} onChange={setActive} />
      <ClientFormDialog open={open} onOpenChange={setOpen} defaultType="lead" onSaved={(c) => c.type === "lead" && setActive(c)} />
      <ClientFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} client={editing} />
      <ConfirmDialog
        open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} pending={del.isPending}
        title={`Delete ${toDelete?.name}?`}
        description="This removes the lead and its whole timeline."
        onConfirm={() => toDelete && del.mutate(toDelete._id)}
      />
    </div>
  );
}
