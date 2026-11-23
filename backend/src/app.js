import express from "express";
import cors from "cors";
import { config } from "./config/config.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.js";
import authRouter from "./router/auth-router.js";
import agencyRouter from "./router/agency-router.js";

const app = express();

app.use(cors({ origin: config.frontendDomainAdmin, credentials: true }));
app.use(express.json());
app.set("trust proxy", true);

app.get("/", (req, res) => res.json({ message: true }));
app.use("/api/auth", authRouter);
app.use("/api/profile", authRouter); // /profile + /profile/change-password (see auth-router)
app.use("/api/agency", agencyRouter);

app.use(globalErrorHandler);

export default app;
