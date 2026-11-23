import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CirclePlus, FolderPlus, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteClient, listClients } from "@/config/api/agency.api";
import { ClientFormDialog } from "@/components/agency/ClientFormDialog";
import { ConfirmDialog, EmptyState, Pager, PageHeader, RowActions, errMsg, useDebounced } from "@/components/agency/common";
import type { Client } from "@/types/agency";

/** Clients only. Leads live on their own page, with their conversation timeline. */
export default function ClientsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const q = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", "client", q, page],
    queryFn: () => listClients({ page, limit: 10, search: q || undefined, type: "client" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => { for (const k of ["clients", "client", "dashboard"]) qc.invalidateQueries({ queryKey: [k] }); toast.success("Deleted"); setToDelete(null); },
    onError: (e) => { toast.error(errMsg(e)); setToDelete(null); },
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        description="People and businesses you work with."
        actions={<Button onClick={() => setOpen(true)}><CirclePlus className="h-4 w-4" /> Add client</Button>}
      />

      <div className="relative sm:w-72">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search name, email, phone…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState text={q ? "Nothing matches this search." : "No clients yet."} action={<Button size="sm" onClick={() => setOpen(true)}>Add the first client</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c._id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell"><div>{c.phone || "—"}</div><div>{c.email}</div></TableCell>
                  <TableCell className="hidden max-w-56 truncate text-sm text-muted-foreground lg:table-cell" title={c.address}>{c.address || "—"}</TableCell>
                  <TableCell>
                    <RowActions actions={[
                      { label: "New project", icon: FolderPlus, onClick: () => navigate(`/dashboard/projects/create?client=${c._id}`) },
                      { label: "Edit", icon: Pencil, onClick: () => setEditing(c) },
                      { label: "Delete", icon: Trash2, danger: true, onClick: () => setToDelete(c) },
                    ]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager pagination={data?.pagination} onPage={setPage} />

      <ClientFormDialog open={open} onOpenChange={setOpen} defaultType="client" />
      <ClientFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} client={editing} />
      <ConfirmDialog
        open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} pending={del.isPending}
        title={`Delete ${toDelete?.name}?`}
        description="This removes the client. Clients that already have projects can't be deleted."
        onConfirm={() => toDelete && del.mutate(toDelete._id)}
      />
    </div>
  );
}
