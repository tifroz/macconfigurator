// 10 Lines by Claude Opus
// Public API routes for config retrieval
import { Router } from "express";
import { Effect, Exit } from "effect";
import type { ConfigStorageService } from "../../core/services/ConfigStorageService.js";
import * as semver from "semver";

export function createConfigRoutes(service: ConfigStorageService, logger: any): Router {
  const router = Router();

  // GET /
  router.get("/", async (req, res) => {
    res.send("This is the swishly config manager service");
  });

  // GET /config/:applicationId/:version
  router.get("/config/:applicationId/:version", async (req, res) => {
    const { applicationId, version } = req.params;

    // Validate semver
    if (!semver.valid(version)) {
      res.status(400).json({ error: "Invalid semver version" });
      return;
    }

    const effect = service.getConfig({ applicationId, version });
    const exit = await Effect.runPromiseExit(effect);

    if (Exit.isFailure(exit)) {
      logger.error("Failed to get config", exit.cause);
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    const result = exit.value;
    if (!result) {
      res.status(404).json({ error: "Application not found or archived" });
      return;
    }

    res.set("Cache-Control", result.cacheControl);
    res.json(result.data);
  });

  return router;
}
