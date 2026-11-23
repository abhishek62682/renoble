import { useQuery } from "@tanstack/react-query";
import { Clock, FolderKanban, Repeat, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSummary } from "@/config/api/agency.api";
import { MetricCard, PageHeader, TextLink } from "@/components/agency/common";
import { formatDate, formatINR, idOf, nameOf, PAYMENT_TYPE_LABEL, PROJECT_STATUS_LABEL } from "@/types/agency";

const compactINR = (n: number) => (n >= 1e7 ? `₹${+(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${+(n / 1e3).toFixed(1)}k` : `₹${n}`);
const monthName = (ym: string, long = false) => new Date(`${ym}-01T00:00:00`).toLocaleString("en-IN", { month: long ? "long" : "short", ...(long ? { year: "numeric" } : {}) });

export default function ReportsPage() {
  const { data: d, isLoading } = useQuery({ queryKey: ["summary"], queryFn: getSummary });
  if (isLoading || !d) return <Skeleton className="h-72 w-full" />;
  const count = (k: string) => d.projectsByStatus.find((s) => s._id === k)?.count ?? 0;


  const statuses = Object.entries(PROJECT_STATUS_LABEL).map(([k, label]) => ({ k, label, n: count(k) })); // all statuses, so the card fills out and zeros are visible too
  const maxStatus = Math.max(1, ...statuses.map((x) => x.n));
  const months = d.monthlyReceived ?? []; // older backend without this field: show the empty state instead of breaking
  const maxMonth = Math.max(0, ...months.map((m) => m.total));

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Where your money and projects stand." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Received" value={formatINR(d.receivedAmount)} icon={Wallet} tint="bg-emerald-100 text-emerald-700" valueClass="text-emerald-600" />
        <MetricCard label="Still to receive" value={formatINR(d.pendingAmount)} icon={Clock} tint="bg-amber-100 text-amber-700" valueClass="text-amber-600" />
        <MetricCard label="Total project value" value={formatINR(d.projectValue)} icon={FolderKanban} tint="bg-violet-100 text-violet-700" />
        <MetricCard label="Subscriptions / month" value={formatINR(d.recurringPerMonth)} icon={Repeat} tint="bg-sky-100 text-sky-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* money received, month by month */}
        <Card className="gap-3 py-5">
          <CardHeader><CardTitle className="text-base">Received by month</CardTitle></CardHeader>
          <CardContent>
            {maxMonth === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No payments received in the last 6 months.</p> : (
              <div className="flex h-52 items-end gap-3" role="img" aria-label="Money received in each of the last six months">
                {months.map((m) => (
                  <div key={m.month} className="flex h-full flex-1 flex-col justify-end gap-1.5" title={`${monthName(m.month, true)}: ${formatINR(m.total)}`}>
                    <span className="text-center text-xs font-medium tabular-nums text-muted-foreground">{m.total ? compactINR(m.total) : ""}</span>
                    <div className="w-full rounded-t-md bg-emerald-500 transition-all hover:bg-emerald-600" style={{ height: `${Math.max((m.total / maxMonth) * 68, m.total ? 3 : 0)}%` }} />
                    <span className="border-t pt-1.5 text-center text-xs text-muted-foreground">{monthName(m.month)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* projects by status */}
        <Card className="gap-3 py-5">
          <CardHeader><CardTitle className="text-base">Projects by status</CardTitle></CardHeader>
          <CardContent className="flex h-full flex-col justify-between gap-3">
            {statuses.map((x) => (
              <div key={x.k} className="grid grid-cols-[8.5rem_1fr_1.5rem] items-center gap-3 text-sm" title={`${x.label}: ${x.n}`}>
                <span className="truncate text-muted-foreground">{x.label}</span>
                <div className="h-3 rounded-full bg-muted"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(x.n / maxStatus) * 100}%` }} /></div>
                <span className={`text-right tabular-nums ${x.n ? "font-medium" : "text-muted-foreground"}`}>{x.n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {d.pendingRequests.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold">Waiting on clients</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.pendingRequests.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell><TextLink to={`/dashboard/projects/${idOf(p.project)}`}>{nameOf(p.project as { name: string })}</TextLink><div className="text-xs text-muted-foreground">{PAYMENT_TYPE_LABEL[p.type]}</div></TableCell>
                    <TableCell>{formatDate(p.dueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
