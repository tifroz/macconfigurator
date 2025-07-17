// 25 Lines by Claude Opus
// Admin API routes for config management
import { Router } from "express";
import { Effect, Exit } from "effect";
import type { ConfigStorageService } from "../../core/services/ConfigStorageService.js";
import type { AppConfig, ConfigServiceError, Logger } from "../../core/types.js";

export function createAdminRoutes(service: ConfigStorageService, logger: Logger): Router {
  const router = Router();

  // 35 Lines by Claude Sonnet
  // Helper to handle Effect results with tagged error support
  async function handleEffect<T>(effect: Effect.Effect<T, ConfigServiceError>, res: any, successStatus = 200) {
    const exit = await Effect.runPromiseExit(effect);

    if (Exit.isFailure(exit)) {
      // Extract the actual error from the Exit cause
      const failureValue = Exit.causeOption(exit);

      if (failureValue._tag === "Some") {
        const cause = failureValue.value;

        // The cause might be wrapped, so we need to extract the actual error
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
          logger.error(`Tagged error: ${errorTag}`, actualError);

          switch (errorTag) {
            case "ConfigValidationError":
              const context = actualError.context ? ` in ${actualError.context}` : "";
              return res.status(400).json({ 
                error: `Validation failed${context}`, 
                errors: actualError.errors,
                context: actualError.context,
                tag: errorTag 
              });
            
            case "SemverValidationError":
              return res.status(400).json({ 
                error: `Semver validation failed`, 
                errors: actualError.errors,
                tag: errorTag 
              });

            case "ApplicationNotFoundError":
              return res.status(404).json({ 
                error: `Application '${actualError.applicationId}' not found`, 
                tag: errorTag 
              });

            case "ApplicationAlreadyExistsError":
              return res.status(409).json({ 
                error: `Application '${actualError.applicationId}' already exists`, 
                tag: errorTag 
              });

            case "NamedConfigNotFoundError":
              return res.status(404).json({ 
                error: `Named config '${actualError.configName}' not found in application '${actualError.applicationId}'`, 
                tag: errorTag 
              });

            case "NamedConfigAlreadyExistsError":
              return res.status(409).json({ 
                error: `Named config '${actualError.configName}' already exists in application '${actualError.applicationId}'`, 
                tag: errorTag 
              });

            case "VersionConflictError":
              return res.status(409).json({ 
                error: `Version '${actualError.version}' already used by config '${actualError.existingConfigName}' (attempted to use in '${actualError.newConfigName}')`, 
                tag: errorTag 
              });

            case "MongoNetworkError":
              return res.status(503).json({ 
                error: `Database connection failed: ${actualError.message}`, 
                tag: errorTag 
              });

            case "MongoAuthError":
              return res.status(503).json({ 
                error: `Database authentication failed: ${actualError.message}`, 
                tag: errorTag 
              });

            case "WriteConflictError":
              return res.status(409).json({ 
                error: `Write conflict: ${actualError.message}`, 
                tag: errorTag 
              });

            case "PoolExhaustedError":
              return res.status(503).json({ 
                error: `Database connection pool exhausted: ${actualError.message}`, 
                tag: errorTag 
              });

            case "UnexpectedServerError":
              return res.status(500).json({ 
                error: `Server error: ${actualError.message}`, 
                tag: errorTag 
              });

            default:
              return res.status(500).json({ 
                error: `Unknown error type: ${errorTag}`, 
                tag: errorTag 
              });
          }
        }

        // Fallback for non-tagged errors (legacy support)
        const error = actualError instanceof Error ? actualError : new Error(String(actualError));
        logger.error("Admin route error (non-tagged)", error);

        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("already exists")) {
          return res.status(409).json({ error: error.message });
        }

        res.status(500).json({ error: error.message || "Internal server error" });
        return;
      }

      // Fallback for unexpected exit structure
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    res.status(successStatus).json(exit.value);
  }

  // List all applications
  router.get("/applications", async (_req, res) => {
    await handleEffect(service.listApplications(), res);
  });

  // Get single application
  router.get("/applications/:applicationId", async (req, res) => {
    const effect = service.getApplication(req.params.applicationId);
    const exit = await Effect.runPromiseExit(effect);

    if (Exit.isSuccess(exit)) {
      if (!exit.value) {
        res.status(404).json({ error: "Application not found" });
        return;
      }
      res.json(exit.value);
      return;
    }

    logger.error("Failed to get application", exit.cause);
    res.status(500).json({ error: "Internal server error" });
  });

  // Create application
  router.post("/applications", async (req, res) => {
    const config: AppConfig = req.body;
    await handleEffect(service.createApplication(config), res, 201);
  });

  // Update application
  router.put("/applications/:applicationId", async (req, res) => {
    const { applicationId } = req.params;
    const update = req.body;
    logger.info(`PUT /applications/${applicationId}`, { body: update });
    await handleEffect(service.updateApplication(applicationId, update), res);
  });

  // Archive application
  router.post("/applications/:applicationId/archive", async (req, res) => {
    await handleEffect(service.archiveApplication(req.params.applicationId), res, 204);
  });

  // Unarchive application
  router.post("/applications/:applicationId/unarchive", async (req, res) => {
    await handleEffect(service.unarchiveApplication(req.params.applicationId), res, 204);
  });

  // Create named config
  router.post("/applications/:applicationId/configs", async (req, res) => {
    const { applicationId } = req.params;
    const { name, data, versions = [] } = req.body;
    await handleEffect(service.createNamedConfig(applicationId, name, data, versions), res, 201);
  });

  // Update named config
  router.put("/applications/:applicationId/configs/:name", async (req, res) => {
    const { applicationId, name } = req.params;
    const { data, versions = [] } = req.body;
    logger.info(`PUT /applications/${applicationId}/configs/${name}`, { body: req.body });
    await handleEffect(service.updateNamedConfig(applicationId, name, data, versions), res);
  });

  // Delete named config
  router.delete("/applications/:applicationId/configs/:name", async (req, res) => {
    const { applicationId, name } = req.params;
    await handleEffect(service.deleteNamedConfig(applicationId, name), res, 204);
  });

  return router;
}
