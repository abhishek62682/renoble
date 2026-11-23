import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, FolderKanban, Hourglass, ListTodo, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { getDashboard } from "@/config/api/agency.api";
import { MetricCard, PageHeader } from "@/components/agency/common";
import { useProfileStore } from "@/config/store/profile";
import { formatDate, formatINR, nameOf, PAYMENT_TYPE_LABEL } from "@/types/agency";

export default function OverviewPage() {
  const profile = useProfileStore((s) => s.profile);
  const isOwner = profile?.role === "OWNER";
  const { data: d, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  if (isLoading || !d) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;

  const tiles = isOwner
    ? [
        { label: "Active projects", value: d.active, icon: FolderKanban, tint: "bg-violet-100 text-violet-700" },
        { label: "Waiting for approval", value: d.awaitingApproval, icon: Clock, tint: "bg-amber-100 text-amber-700" },
        { label: "Payments received", value: formatINR(d.receivedAmount), icon: Wallet, tint: "bg-emerald-100 text-emerald-700", valueClass: "text-emerald-600" },
        { label: "Payments pending", value: formatINR(d.pendingAmount), icon: Hourglass, tint: "bg-sky-100 text-sky-700", valueClass: "text-amber-600" },
      ]
    : [
        { label: "Active projects", value: d.active, icon: FolderKanban, tint: "bg-violet-100 text-violet-700" },
        { label: "Waiting for approval", value: d.awaitingApproval, icon: Clock, tint: "bg-amber-100 text-amber-700" },
        { label: "Completed", value: d.completed, icon: CheckCircle2, tint: "bg-emerald-100 text-emerald-700" },
        { label: "My pending tasks", value: d.pendingTasks, icon: ListTodo, tint: "bg-sky-100 text-sky-700" },
      ];

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome${profile?.username ? `, ${profile.username}` : ""}`} description="Here's where everything stands today." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => <MetricCard key={t.label} {...t} />)}
      </div>

      {isOwner && (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="border-b px-5 py-4"><h2 className="text-base font-semibold">Recent payments</h2></div>
          {(d.recentPayments ?? []).length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">No confirmed payments yet.</p> : (
            <ul className="divide-y">
              {d.recentPayments!.map((p) => (
                <li key={p._id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                    {nameOf(p.client as { name: string }).charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{nameOf(p.client as { name: string })}</span>
                    <span className="block text-xs text-muted-foreground">{PAYMENT_TYPE_LABEL[p.type]} · {formatDate(p.receivedDate)}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-emerald-600">+ {formatINR(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {!isOwner && <p className="text-sm text-muted-foreground">See your work in <Link className="text-(--color-blue) underline" to="/dashboard/tasks">Tasks</Link> and <Link className="text-(--color-blue) underline" to="/dashboard/projects">Projects</Link>.</p>}
    </div>
  );
}
