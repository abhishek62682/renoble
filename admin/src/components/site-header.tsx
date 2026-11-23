import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

type SiteHeaderProps = {
  title: string;
};

/** Live date and time for the top right of every page. */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t); }, []);
  return (
    <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
      <span className="hidden sm:inline">{now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
      <span className="hidden h-3 w-px bg-border sm:inline-block" />
      <span className="font-medium text-foreground">{now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()}</span>
    </div>
  );
}

export function SiteHeader({ title }: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <Clock />
      </div>
    </header>
  );
}