import httpClient from "@/config/http/httpClient";
import type {
  BankDetails, BusinessSettings, Client, ClientType, DocKind, DocumentRecord, LineItem, Pagination, Party, Payment, PaymentMethod,
  PaymentType, Project, ProjectStatus, Task, TeamMember,
} from "@/types/agency";

type Res<T> = { success: boolean; message: string; data: T; pagination?: Pagination };
const BASE = "agency";
const get = async <T,>(url: string, params?: object) => (await httpClient.get<Res<T>>(`${BASE}${url}`, { params })).data;
const send = async <T,>(method: "post" | "put" | "patch" | "delete", url: string, body?: unknown) =>
  (await httpClient.request<Res<T>>({ method, url: `${BASE}${url}`, data: body })).data;

// ── clients ────────────────────────────────────────────────────────────────
export interface ClientInput {
  type: ClientType; name: string; email: string; phone: string; address: string;
  notes: string; nextFollowUpDate: string | null; followUpNote: string;
}
export const listClients = (p: { type?: ClientType; search?: string; followUp?: "due"; page?: number; limit?: number }) =>
  get<Client[]>("/clients", p);
export const getClient = async (id: string) =>
  (await get<{ client: Client; projects: Project[]; payments: Payment[] }>(`/clients/${id}`)).data;
export const createClient = async (b: ClientInput) => (await send<Client>("post", "/clients", b)).data;
export const updateClient = async (id: string, b: Partial<ClientInput>) => (await send<Client>("patch", `/clients/${id}`, b)).data;
export interface ActivityInput { type: string; note: string; date: string | null; nextFollowUp: string | null }
export const addActivity = async (id: string, b: ActivityInput) => (await send<Client>("post", `/clients/${id}/activities`, b)).data;
export const deleteActivity = async (id: string, activityId: string) => (await send<Client>("delete", `/clients/${id}/activities/${activityId}`)).data;
export const deleteClient = (id: string) => send("delete", `/clients/${id}`);

// ── projects ───────────────────────────────────────────────────────────────
export interface ProjectInput {
  client: string; name: string; businessName: string; services: string[]; description: string; status: ProjectStatus;
  startDate: string | null; deadline: string | null;
  pricingType: "one_time" | "subscription";
  oneTime?: { totalPrice: number; advanceAmount: number };
  subscription?: { amount: number; frequency: string; startDate: string | null; nextPaymentDate: string | null };
}
export const listProjects = (p: { status?: ProjectStatus; client?: string; page?: number; limit?: number }) => get<Project[]>("/projects", p);
export const getProject = async (id: string) =>
  (await get<{ project: Project; payments: Payment[]; documents: DocumentRecord[]; tasks: Task[] }>(`/projects/${id}`)).data;
export const createProject = async (b: ProjectInput) => (await send<Project>("post", "/projects", b)).data;
export const updateProject = async (id: string, b: ProjectInput) => (await send<Project>("put", `/projects/${id}`, b)).data;
export const setProjectStatus = async (id: string, status: ProjectStatus) => (await send<Project>("patch", `/projects/${id}/status`, { status })).data;
export const deleteProject = (id: string) => send("delete", `/projects/${id}`);

// ── payments ───────────────────────────────────────────────────────────────
export const listPayments = (p: { status?: string; project?: string; page?: number; limit?: number }) => get<Payment[]>("/payments", p);
export const createPayment = async (b: { project: string; amount: number; type: PaymentType; dueDate: string | null; note: string }) =>
  (await send<Payment>("post", "/payments", b)).data;
export const confirmPayment = async (id: string, b: { method: PaymentMethod; reference: string; receivedDate: string | null }) =>
  (await send<Payment>("post", `/payments/${id}/confirm`, b)).data;
export const receiptForInvoice = async (id: string, b?: { method: PaymentMethod; reference: string; receivedDate: string | null }) =>
  (await send<DocumentRecord>("post", `/documents/${id}/receipt`, b ?? {})).data;
export const removePayment = (id: string) => send("delete", `/payments/${id}`);

// ── documents ──────────────────────────────────────────────────────────────
export interface DocumentInput {
  issueDate: string; dueDate: string | null; billedTo: Party; from: Party; items: LineItem[];
  taxPercent: number; advanceReceived: number; thankYou: string; terms: string; bank?: BankDetails & { show: boolean }; part?: "advance" | "remaining" | null;
}
export const listDocuments = (p: { kind?: DocKind; project?: string; page?: number; limit?: number }) => get<DocumentRecord[]>("/documents", p);
export const getNextNumber = async (kind: "quotation" | "invoice", date: string) =>
  (await get<{ number: string }>("/documents/next-number", { kind, date })).data.number;
export const getDocument = async (id: string) => (await get<DocumentRecord>(`/documents/${id}`)).data;
export const createDocument = async (b: DocumentInput & { kind: "quotation" | "invoice"; project?: string; client?: string; payment?: string | null }) =>
  (await send<DocumentRecord>("post", "/documents", b)).data;
export const updateDocument = async (id: string, b: DocumentInput) => (await send<DocumentRecord>("put", `/documents/${id}`, b)).data;
export const setDocumentStatus = async (id: string, status: string) => (await send<DocumentRecord>("patch", `/documents/${id}/status`, { status })).data;
export const deleteDocument = (id: string) => send("delete", `/documents/${id}`);
export const convertQuotation = async (id: string) => (await send<DocumentRecord>("post", `/documents/${id}/convert`)).data;
export const projectFromQuotation = async (id: string) => (await send<Project>("post", `/documents/${id}/project`)).data;
export const createReceipt = async (payment: string) => (await send<DocumentRecord>("post", "/documents/receipts", { payment })).data;

// ── tasks ──────────────────────────────────────────────────────────────────
export const listTasks = async (p: { assignee?: string; status?: string; project?: string }) => (await get<Task[]>("/tasks", p)).data;
export const createTask = async (b: { project: string; title: string; notes: string; assignedTo: string; dueDate: string | null }) =>
  (await send<Task>("post", "/tasks", b)).data;
export const updateTask = async (id: string, b: Partial<Pick<Task, "title" | "notes" | "dueDate" | "status">> & { assignedTo?: string }) =>
  (await send<Task>("patch", `/tasks/${id}`, b)).data;
export const listTeam = async () => (await get<TeamMember[]>("/team")).data;
export const addMember = async (b: { username: string; email: string; password: string }) => (await send<TeamMember>("post", "/team", b)).data;
export const removeMember = (id: string) => send("delete", `/team/${id}`);
export const deleteTask = (id: string) => send("delete", `/tasks/${id}`);

// ── reports ────────────────────────────────────────────────────────────────
export interface DashboardData {
  active: number; awaitingApproval: number; awaitingPayment: number; completed: number; pendingTasks: number;
  followUps?: Client[]; followUpsDue?: number;
  projectValue?: number; recurringPerMonth?: number; receivedAmount?: number; pendingAmount?: number;
  recentPayments?: Payment[];
}
export const getDashboard = async () => (await get<DashboardData>("/reports/dashboard")).data;
export interface SummaryData {
  projectValue: number; recurringPerMonth: number; receivedAmount: number; pendingAmount: number;
  projectsByStatus: { _id: ProjectStatus; count: number }[]; monthlyReceived: { month: string; total: number }[]; leads: number; clients: number; pendingRequests: Payment[];
}
export const getSummary = async () => (await get<SummaryData>("/reports/summary")).data;

// ── settings ───────────────────────────────────────────────────────────────
export const getSettings = async () => (await get<BusinessSettings>("/settings")).data;
export const saveSettings = async (b: BusinessSettings) => (await send<BusinessSettings>("put", "/settings", b)).data;
