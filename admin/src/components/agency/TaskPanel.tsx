import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTask, deleteTask, listTeam, updateTask } from "@/config/api/agency.api";
import { StatusBadge, errMsg } from "@/components/agency/common";
import { useProfileStore } from "@/config/store/profile";
import { cn } from "@/lib/utils";
import { formatDate, nameOf, type Task } from "@/types/agency";

/** Task list + quick add. If `projectId` is given, tasks are added to that project. */
export function TaskPanel({ tasks, projectId, projects }: { tasks: Task[]; projectId?: string; projects?: { _id: string; name: string }[] }) {
  const qc = useQueryClient();
  const isOwner = useProfileStore((s) => s.profile?.role) === "OWNER";
  const refresh = () => { for (const k of ["tasks", "project", "dashboard"]) qc.invalidateQueries({ queryKey: [k] }); };

  const [title, setTitle] = useState("");
  const myId = useProfileStore((s) => s.profile?.id);
  const team = useQuery({ queryKey: ["team"], queryFn: listTeam, enabled: isOwner });
  const [assignedTo, setAssignedTo] = useState("");
  const who = assignedTo || myId || ""; // default: yourself
  const [due, setDue] = useState("");
  const [project, setProject] = useState(projectId ?? "");

  const add = useMutation({
    mutationFn: () => createTask({ project: projectId ?? project, title, notes: "", assignedTo: who, dueDate: due || null }),
    onSuccess: () => { refresh(); setTitle(""); setDue(""); toast.success("Task added"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const toggle = useMutation({
    mutationFn: (t: Task) => updateTask(t._id, { status: t.status === "pending" ? "completed" : "pending" }),
    onSuccess: refresh, onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => deleteTask(id), onSuccess: refresh, onError: (e) => toast.error(errMsg(e)) });

  const canAdd = title.trim().length >= 2 && (projectId || project) && who;
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className="space-y-4">
      <form
        className={cn("grid gap-2 rounded-lg border p-3 sm:grid-cols-2", projectId ? "lg:grid-cols-[1fr_11rem_10rem_auto]" : "lg:grid-cols-[1fr_14rem_11rem_10rem_auto]")}
        onSubmit={(e) => { e.preventDefault(); if (canAdd) add.mutate(); }}
      >
        <Input className="sm:col-span-2 lg:col-span-1" placeholder="What needs to be done?" value={title} onChange={(e) => setTitle(e.target.value)} />
        {!projectId && (
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>{(projects ?? []).map((p) => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Select value={who} onValueChange={setAssignedTo} disabled={!isOwner}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Assign to" /></SelectTrigger>
          <SelectContent>
            {isOwner
              ? (team.data ?? []).map((m) => <SelectItem key={m._id} value={m._id}>{m._id === myId ? `${m.username} (me)` : m.username}</SelectItem>)
              : <SelectItem value={myId ?? ""}>Me</SelectItem>}
          </SelectContent>
        </Select>
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Button type="submit" disabled={!canAdd || add.isPending}><CirclePlus className="h-4 w-4" /> Add task</Button>
      </form>

      {tasks.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tasks.map((t) => {
            const late = t.status === "pending" && t.dueDate && new Date(t.dueDate) < today;
            return (
              <li key={t._id} className="flex items-center gap-3 p-3">
                <Checkbox checked={t.status === "completed"} onCheckedChange={() => toggle.mutate(t)} />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", t.status === "completed" && "text-muted-foreground line-through")}>{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {!projectId && <>{nameOf(t.project as { name: string })} · </>}
                    <span className={late ? "text-red-600" : ""}>{t.dueDate ? `Due ${formatDate(t.dueDate)}` : "No due date"}</span>
                  </p>
                </div>
                <StatusBadge value={t.assignee === "OWNER" ? "client" : "lead"} label={t.assignedTo?.username ?? (t.assignee === "OWNER" ? "Owner" : "Designer")} />
                <StatusBadge value={t.status} />
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(t._id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
