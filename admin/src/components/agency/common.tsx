import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, type LucideIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Pagination } from "@/types/agency";
import type { ApiAxiosError } from "@/types/error";

export const errMsg = (e: unknown, fallback = "Something went wrong. Please try again.") =>
  (e as ApiAxiosError)?.response?.data?.message ?? fallback;

export function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, error, required, hint, children, className }: {
  label: string; error?: string; required?: boolean; hint?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[15px] font-normal text-neutral-700 dark:text-neutral-300">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const TONES: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blue: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  gray: "bg-muted text-muted-foreground",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};
const STATUS_TONE: Record<string, string> = {
  ongoing: "blue", awaiting_approval: "amber", awaiting_payment: "amber", on_hold: "gray", completed: "green", cancelled: "red",
  lead: "violet", client: "green",
  draft: "gray", sent: "blue", approved: "green", rejected: "red", partially_paid: "violet", paid: "green", issued: "green",
  pending: "amber", received: "green",
  unpaid: "red", partial: "violet", recurring: "blue", due: "amber",
};
export const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return (
    <Badge variant="secondary" className={cn("border-0 font-medium", TONES[STATUS_TONE[value] ?? "gray"])}>
      {label ?? humanize(value)}
    </Badge>
  );
}

export function Pager({ pagination, onPage }: { pagination?: Pagination; onPage: (p: number) => void }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground">
      <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} total</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!pagination.hasPrevPage} onClick={() => onPage(pagination.page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" disabled={!pagination.hasNextPage} onClick={() => onPage(pagination.page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Delete", onConfirm, pending }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string;
  confirmLabel?: string; onConfirm: () => void; pending?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
      <p>{text}</p>
      {action}
    </div>
  );
}

export const TextLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="font-medium text-(--color-blue) hover:underline">{children}</Link>
);

/** Clean metric card: label + icon, big number, small hint. Used on Dashboard and Reports. */
export function MetricCard({ label, value, hint, icon: Icon, tint, valueClass }: {
  label: string; value: ReactNode; hint?: string; icon: LucideIcon; tint: string; valueClass?: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", tint)}><Icon className="h-4 w-4" /></span>
      </div>
      <p className={cn("text-2xl font-semibold tabular-nums", valueClass)}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "green" | "amber" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "green" && "text-emerald-600", tone === "amber" && "text-amber-600")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export type RowAction = { label: string; icon: LucideIcon; onClick: () => void; hidden?: boolean; danger?: boolean; disabled?: boolean };

/** "Actions" button for a table row: click it and a dropdown lists everything you can do with the row. */
export function RowActions({ actions }: { actions: RowAction[] }) {
  const items = actions.filter((a) => !a.hidden);
  const normal = items.filter((a) => !a.danger);
  const danger = items.filter((a) => a.danger);
  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Actions" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48" onClick={(e) => e.stopPropagation()}>
          {normal.map((a) => (
            <DropdownMenuItem key={a.label} disabled={a.disabled} onSelect={() => a.onClick()} className="cursor-pointer gap-2">
              <a.icon className="h-4 w-4" /> {a.label}
            </DropdownMenuItem>
          ))}
          {normal.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
          {danger.map((a) => (
            <DropdownMenuItem key={a.label} disabled={a.disabled} onSelect={() => a.onClick()} className="cursor-pointer gap-2 text-red-600 focus:text-red-600">
              <a.icon className="h-4 w-4" /> {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
