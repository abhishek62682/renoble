import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listProjects, listTasks } from "@/config/api/agency.api";
import { PageHeader } from "@/components/agency/common";
import { TaskPanel } from "@/components/agency/TaskPanel";
import { useProfileStore } from "@/config/store/profile";

export default function TasksPage() {
  const isOwner = useProfileStore((s) => s.profile?.role) === "OWNER";
  const [filter, setFilter] = useState<"pending" | "completed" | "all">("pending");
  const tasks = useQuery({ queryKey: ["tasks", filter], queryFn: () => listTasks({ status: filter === "all" ? undefined : filter }) });
  const projects = useQuery({ queryKey: ["projects", "options"], queryFn: () => listProjects({ limit: 100 }) });

  return (
    <div className="space-y-4">
      <PageHeader title="Tasks" description={isOwner ? "Create tasks and give them to your team." : "Your tasks across all projects."} />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList><TabsTrigger value="pending">Pending</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList>
      </Tabs>
      {tasks.isLoading ? <Skeleton className="h-40 w-full" /> : <TaskPanel tasks={tasks.data ?? []} projects={(projects.data?.data ?? []).map((p) => ({ _id: p._id, name: p.name }))} />}
    </div>
  );
}
