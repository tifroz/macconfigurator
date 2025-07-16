// 25 Lines by Claude Opus
// Admin API routes for config management
import { Router } from "express";
import { Effect, Exit } from "effect";
export function createAdminRoutes(service, logger) {
    const router = Router();
    // Helper to handle Effect results
    async function handleEffect(effect, res, successStatus = 200) {
        const exit = await Effect.runPromiseExit(effect);
        if (Exit.isFailure(exit)) {
            // Extract the actual error from the Exit cause
            const failureValue = Exit.causeOption(exit);
            if (failureValue._tag === "Some") {
                const cause = failureValue.value;
                // The cause might be wrapped, so we need to extract the actual error
                let actualError = cause;
                // If it's a Die or Fail cause, extract the error
                if (cause._tag === "Fail") {
                    actualError = cause.error;
                }
                else if (cause._tag === "Die") {
                    actualError = cause.defect;
                }
                // Check if it's validation errors
                if (Array.isArray(actualError) && actualError.length > 0 && "field" in actualError[0]) {
                    logger.error("Validation errors", actualError);
                    return res.status(400).json({ errors: actualError });
                }
                // Regular error
                const error = actualError instanceof Error ? actualError : new Error(String(actualError));
                logger.error("Admin route error", error);
                if (error.message.includes("not found")) {
                    return res.status(404).json({ error: error.message });
                }
                if (error.message.includes("already exists")) {
                    return res.status(409).json({ error: error.message });
                }
                // Check if the error message contains validation errors
                if (error.message.includes("[{") && error.message.includes('"field"')) {
                    try {
                        // Try to parse validation errors from the error message
                        const match = error.message.match(/\[{.*}\]/);
                        if (match) {
                            const errors = JSON.parse(match[0]);
                            return res.status(400).json({ errors });
                        }
                    }
                    catch (e) {
                        // If parsing fails, continue with generic error
                    }
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
        const config = req.body;
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
//# sourceMappingURL=adminRoutes.js.map