export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const TITLE_RULES: [RegExp, string][] = [
  [/^\/dashboard\/home$/, "Dashboard"],
  [/^\/dashboard\/clients\/[^/]+$/, "Client"],
  [/^\/dashboard\/clients$/, "Clients & Leads"],
  [/^\/dashboard\/projects\/create$/, "New Project"],
  [/^\/dashboard\/projects\/[^/]+\/edit$/, "Edit Project"],
  [/^\/dashboard\/projects\/[^/]+$/, "Project"],
  [/^\/dashboard\/projects$/, "Projects"],
  [/^\/dashboard\/tasks$/, "Tasks"],
  [/^\/dashboard\/payments$/, "Payments"],
  [/^\/dashboard\/quotations\/create$/, "New Quotation"],
  [/^\/dashboard\/quotations\/[^/]+\/edit$/, "Edit Quotation"],
  [/^\/dashboard\/quotations$/, "Quotations"],
  [/^\/dashboard\/invoices\/create$/, "New Invoice"],
  [/^\/dashboard\/invoices\/[^/]+\/edit$/, "Edit Invoice"],
  [/^\/dashboard\/invoices$/, "Invoices"],
  [/^\/dashboard\/receipts\/[^/]+$/, "Receipt"],
  [/^\/dashboard\/receipts$/, "Receipts"],
  [/^\/dashboard\/reports$/, "Reports"],
  [/^\/dashboard\/settings$/, "Settings"],
];

export const getPageTitle = (pathname: string) =>
  TITLE_RULES.find(([re]) => re.test(pathname))?.[1] ?? "Dashboard";
