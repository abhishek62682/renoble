import * as React from "react"


import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { BarChart3, CheckSquare, FileText, FolderKanban, LayoutDashboard, Target, Users, ReceiptText, UsersRound, Wallet, FileSignature } from "lucide-react"

import { LogoMark } from "@/components/LogoMark";
import { ROLE_GROUPS } from "@/config/roles";

const data = {
  navMain: [
    { title: "Dashboard",       url: "/dashboard/home",       icon: LayoutDashboard, roles: ROLE_GROUPS.ALL },
    { title: "Leads",           url: "/dashboard/leads",      icon: Target,          roles: ROLE_GROUPS.OWNER },
    { title: "Clients",         url: "/dashboard/clients",    icon: UsersRound,      roles: ROLE_GROUPS.OWNER },
    { title: "Team",            url: "/dashboard/team",       icon: Users,           roles: ROLE_GROUPS.OWNER },
    { title: "Projects",        url: "/dashboard/projects",   icon: FolderKanban,    roles: ROLE_GROUPS.ALL },
    { title: "Tasks",           url: "/dashboard/tasks",      icon: CheckSquare,     roles: ROLE_GROUPS.ALL },
    { title: "Payments",        url: "/dashboard/payments",   icon: Wallet,          roles: ROLE_GROUPS.OWNER },
    { title: "Quotations",      url: "/dashboard/quotations", icon: FileSignature,   roles: ROLE_GROUPS.OWNER },
    { title: "Invoices",        url: "/dashboard/invoices",   icon: FileText,        roles: ROLE_GROUPS.OWNER },
    { title: "Receipts",        url: "/dashboard/receipts",   icon: ReceiptText,     roles: ROLE_GROUPS.OWNER },
    { title: "Reports",         url: "/dashboard/reports",    icon: BarChart3,       roles: ROLE_GROUPS.OWNER },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
           
             
              <a  href="/dashboard/home">
              <LogoMark size={40} />

               
               
              </a>
           
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser  />
      </SidebarFooter>
    </Sidebar>
  )
}
