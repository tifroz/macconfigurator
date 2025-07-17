// 10 Lines by Claude Opus
// Public API routes for config retrieval
import { Router } from "express";
import { Effect, Exit } from "effect";
import type { ConfigStorageService } from "../../core/services/ConfigStorageService.js";
import type { Logger } from "../../core/types.js";
import * as semver from "semver";

export function createConfigRoutes(service: ConfigStorageService, logger: Logger): Router {
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
      // Extract the actual error from the Exit cause
      const failureValue = Exit.causeOption(exit);
      
      if (failureValue._tag === "Some") {
        const cause = failureValue.value;
        let actualError: any = cause;

        // If it's a Die or Fail cause, extract the error
        if (cause._tag === "Fail") {
          actualError = cause.error;
        } else if (cause._tag === "Die") {
          actualError = cause.defect;
        }

        // Handle tagged errors with specific messaging
        if (actualError && typeof actualError === "object" && actualError._tag) {
          const errorTag = actualError._tag;
          logger.error(`Tagged error in config route: ${errorTag}`, actualError);

          switch (errorTag) {
            case "MongoNetworkError":
            case "MongoAuthError":
            case "PoolExhaustedError":
            case "UnexpectedServerError":
              res.status(503).json({ error: "Service temporarily unavailable", tag: errorTag });
              return;
            
            default:
              res.status(500).json({ error: "Internal server error", tag: errorTag });
              return;
          }
        }
      }

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
