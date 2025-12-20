/**
 * Features routes - HTTP API for feature management
 */

import { Router } from "express";
import { FeatureLoader } from "../../services/feature-loader.js";
import { createListHandler } from "./routes/list.js";
import { createGetHandler } from "./routes/get.js";
import { createCreateHandler } from "./routes/create.js";
import { createUpdateHandler } from "./routes/update.js";
import { createDeleteHandler } from "./routes/delete.js";
import { createAgentOutputHandler } from "./routes/agent-output.js";
import { createGenerateTitleHandler } from "./routes/generate-title.js";

export function createFeaturesRoutes(featureLoader: FeatureLoader): Router {
  const router = Router();

  router.post("/list", createListHandler(featureLoader));
  router.post("/get", createGetHandler(featureLoader));
  router.post("/create", createCreateHandler(featureLoader));
  router.post("/update", createUpdateHandler(featureLoader));
  router.post("/delete", createDeleteHandler(featureLoader));
  router.post("/agent-output", createAgentOutputHandler(featureLoader));
  router.post("/generate-title", createGenerateTitleHandler());

  return router;
}
