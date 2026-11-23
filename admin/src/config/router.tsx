import { RoleGuard } from "@/components/RoleGuard";
import { ROLE_GROUPS } from "@/config/roles";
import AuthLayout from "@/layouts/AuthLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import FullScreenLayout from "@/layouts/FullScreenLayout";
import LoginPage from "@/pages/auth-pages/LoginPage";
import TeamPage from "@/pages/agency-pages/TeamPage";
import LeadsPage from "@/pages/agency-pages/LeadsPage";
import ClientsPage from "@/pages/agency-pages/ClientsPage";
import ProjectsPage from "@/pages/agency-pages/ProjectsPage";
import ProjectFormPage from "@/pages/agency-pages/ProjectFormPage";
import ProjectDetailPage from "@/pages/agency-pages/ProjectDetailPage";
import PaymentsPage from "@/pages/agency-pages/PaymentsPage";
import DocumentsPage from "@/pages/agency-pages/DocumentsPage";
import DocumentEditorPage from "@/pages/agency-pages/DocumentEditorPage";
import ReceiptViewPage from "@/pages/agency-pages/ReceiptViewPage";
import TasksPage from "@/pages/agency-pages/TasksPage";
import OverviewPage from "@/pages/agency-pages/OverviewPage";
import ReportsPage from "@/pages/agency-pages/ReportsPage";
import SettingsPage from "@/pages/agency-pages/SettingsPage";
import { createBrowserRouter, Navigate } from "react-router-dom";

// helpers keep the agency routes short: [path, element] pairs wrapped in the right role guard
const guarded = (roles: typeof ROLE_GROUPS.ALL | typeof ROLE_GROUPS.OWNER, routes: [string, React.ReactElement][]) =>
  routes.map(([path, element]) => ({
    path,
    element: <RoleGuard behavior="redirect" allowedRoles={roles}>{element}</RoleGuard>,
  }));
const ownerRoutes = (r: [string, React.ReactElement][]) => guarded(ROLE_GROUPS.OWNER, r);
const allRoutes = (r: [string, React.ReactElement][]) => guarded(ROLE_GROUPS.ALL, r);

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard/home" />,
  },
  {
    path: "auth",
    element: <AuthLayout />,
    children: [{ path: "login", element: <LoginPage /> }],
  },
  {
    // full-screen builder, no sidebar
    element: <FullScreenLayout />,
    children: ownerRoutes([
      ["dashboard/quotations/create", <DocumentEditorPage />],
      ["dashboard/quotations/:id/edit", <DocumentEditorPage />],
      ["dashboard/invoices/create", <DocumentEditorPage />],
      ["dashboard/invoices/:id/edit", <DocumentEditorPage />],
    ]),
  },
  {
    path: "dashboard",
    element: <DashboardLayout />,
    children: [
      // ✅ Both roles
      {
        path: "home",
        element: (
          <RoleGuard behavior="redirect" allowedRoles={ROLE_GROUPS.ALL}>
            <OverviewPage />
          </RoleGuard>
        ),
      },

      // ── Renoble agency modules ─────────────────────────────────────────
      ...ownerRoutes([
        ["leads", <LeadsPage />],
        ["clients", <ClientsPage />],
        ["team", <TeamPage />],
        ["projects/create", <ProjectFormPage />],
        ["projects/:id/edit", <ProjectFormPage />],
        ["payments", <PaymentsPage />],
        ["quotations", <DocumentsPage />],
        ["invoices", <DocumentsPage />],
        ["receipts", <DocumentsPage />],
        ["receipts/:id", <ReceiptViewPage />],
        ["reports", <ReportsPage />],
        ["settings", <SettingsPage />],
      ]),
      // owner + designer
      ...allRoutes([
        ["projects", <ProjectsPage />],
        ["projects/:id", <ProjectDetailPage />],
        ["tasks", <TasksPage />],
      ]),

    ],
  },
]);

export default router;