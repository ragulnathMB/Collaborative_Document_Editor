import express from "express";
import cors from "cors";
import http from "http";
import { env } from "./config/env";
import authRoutes from "./auth/auth.routes";
import documentRoutes from "./document/document.routes";
import workspaceRoutes from "./workspace/workspace.routes";
import { errorHandler } from "./middleware/errorHandler";
import { setupWebSocketServer } from "./websocket/wsServer";
import { logger } from "./utils/logger";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/workspaces", workspaceRoutes);

app.use(errorHandler);

const server = http.createServer(app);
setupWebSocketServer(server);

server.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port}`);
});
