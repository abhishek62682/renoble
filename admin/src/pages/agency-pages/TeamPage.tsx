import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addMember, listTeam, removeMember } from "@/config/api/agency.api";
import { ConfirmDialog, Field, PageHeader, errMsg } from "@/components/agency/common";
import type { TeamMember } from "@/types/agency";

/** Your team: each member signs in with their own email and sees only the tasks given to them. */
export default function TeamPage() {
  const qc = useQueryClient();
  const team = useQuery({ queryKey: ["team"], queryFn: listTeam });
  const [open, setOpen] = useState(false);
  const [toRemove, setToRemove] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const refresh = () => { for (const k of ["team", "tasks"]) qc.invalidateQueries({ queryKey: [k] }); };

  const add = useMutation({
    mutationFn: () => addMember(form),
    onSuccess: () => { refresh(); toast.success("Member added"); setOpen(false); setForm({ username: "", email: "", password: "" }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeMember(id),
    onSuccess: () => { refresh(); toast.success("Member removed"); setToRemove(null); },
    onError: (e) => { toast.error(errMsg(e)); setToRemove(null); },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team"
        description="People you can assign tasks to."
        actions={<Button onClick={() => setOpen(true)}><CirclePlus className="h-4 w-4" /> Add member</Button>}
      />

      {team.isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(team.data ?? []).map((m) => (
                <TableRow key={m._id}>
                  <TableCell className="font-medium">{m.username}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>{m.role === "OWNER" ? "Owner" : "Team member"}</TableCell>
                  <TableCell className="text-right">
                    {m.role !== "OWNER" && <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setToRemove(m)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>They sign in with this email and password, and see only their own tasks and projects (no prices).</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <Field label="Name" required><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Password" required hint="At least 8 characters. Share it with them yourself."><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={add.isPending}>{add.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)} pending={remove.isPending} confirmLabel="Remove"
        title={`Remove ${toRemove?.username}?`}
        description="They can no longer sign in. Their tasks stay, unassigned."
        onConfirm={() => toRemove && remove.mutate(toRemove._id)}
      />
    </div>
  );
}
