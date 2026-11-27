import express from "express";
import { authenticate, authorizeRole } from "../middlewares/authenticate.js";
import validate from "../middlewares/validate.js";
import * as v from "../validators/agency-validator.js";
import * as clients from "../controller/client-controller.js";
import * as projects from "../controller/project-controller.js";
import * as payments from "../controller/payment-controller.js";
import * as docs from "../controller/document-controller.js";
import * as reports from "../controller/report-controller.js";
import * as settings from "../controller/settings-controller.js";
import * as team from "../controller/team-controller.js";

const router = express.Router();
const OWNER = authorizeRole("OWNER");
const BOTH = authorizeRole("OWNER", "DESIGNER"); // owner + designer

router.use(authenticate);

// Dashboard (designer gets work counts only) & reports
router.get("/reports/dashboard", BOTH, reports.dashboard);
router.get("/reports/summary", OWNER, reports.summary);

// Business settings (owner)
router.get("/settings", OWNER, settings.getSettings);
router.put("/settings", OWNER, validate(v.settingsSchema), settings.saveSettings);

// Clients & leads (owner)
router.get("/clients", OWNER, clients.listClients);
router.post("/clients", OWNER, validate(v.createClientSchema), clients.createClient);
router.get("/clients/:id", OWNER, clients.getClient);
router.patch("/clients/:id", OWNER, validate(v.updateClientSchema), clients.updateClient);
router.post("/clients/:id/activities", OWNER, validate(v.addActivitySchema), clients.addActivity);
router.delete("/clients/:id/activities/:activityId", OWNER, validate(v.deleteActivitySchema), clients.deleteActivity);
router.delete("/clients/:id", OWNER, clients.deleteClient);

// Projects (owner writes; both read — designer sees no pricing)
router.get("/projects", BOTH, projects.listProjects);
router.get("/projects/:id", BOTH, projects.getProject);
router.post("/projects", OWNER, validate(v.createProjectSchema), projects.createProject);
router.put("/projects/:id", OWNER, validate(v.updateProjectSchema), projects.updateProject);
router.patch("/projects/:id/status", OWNER, validate(v.projectStatusSchema), projects.setProjectStatus);
router.patch("/projects/:id/subscription", OWNER, validate(v.subscriptionStopSchema), projects.setSubscriptionStopped);
router.delete("/projects/:id", OWNER, projects.deleteProject);

// Team (owner)
router.get("/team", OWNER, team.listTeam);
router.post("/team", OWNER, validate(v.addMemberSchema), team.addMember);
router.delete("/team/:id", OWNER, team.removeMember);

// Tasks (both)
router.get("/tasks", BOTH, projects.listTasks);
router.post("/tasks", BOTH, validate(v.createTaskSchema), projects.createTask);
router.patch("/tasks/:id", BOTH, validate(v.updateTaskSchema), projects.updateTask);
router.delete("/tasks/:id", BOTH, projects.deleteTask);

// Payments (owner)
router.get("/payments", OWNER, payments.listPayments);
router.post("/payments", OWNER, validate(v.createPaymentSchema), payments.createPayment);
router.post("/payments/:id/confirm", OWNER, validate(v.confirmPaymentSchema), payments.confirmPayment);
router.delete("/payments/:id", OWNER, payments.cancelPayment);

// Quotations, invoices, receipts (owner)
router.get("/documents", OWNER, docs.listDocuments);
router.get("/documents/next-number", OWNER, docs.nextNumber);
router.post("/documents/receipts", OWNER, validate(v.createReceiptSchema), docs.createReceipt);
router.post("/documents/:id/receipt", OWNER, validate(v.invoiceReceiptSchema), docs.receiptForInvoice);
router.post("/documents", OWNER, validate(v.createDocSchema), docs.createDocument);
router.get("/documents/:id", OWNER, docs.getDocument);
router.put("/documents/:id", OWNER, validate(v.updateDocSchema), docs.updateDocument);
router.patch("/documents/:id/status", OWNER, docs.setDocumentStatus);
router.post("/documents/:id/project", OWNER, docs.projectFromQuotation);
router.post("/documents/:id/convert", OWNER, docs.convertQuotation);
router.delete("/documents/:id", OWNER, docs.deleteDocument);

export default router;
