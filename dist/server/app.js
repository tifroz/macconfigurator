// 15 Lines by Claude Opus
// Express server setup for ConfigManager
import express from "express";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import { createBasicAuth } from "./middleware/basicAuth.js";
import { createConfigRoutes } from "./routes/configRoutes.js";
import { createAdminRoutes } from "./routes/adminRoutes.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function createExpressApp(config, service) {
    const app = express();
    // Middleware
    app.use(compression());
    app.use(express.json({ limit: "10mb" }));
    // Log requests
    app.use((req, _res, next) => {
        config.logger.info(`[configurator] ${req.method} ${req.path}`);
        next();
    });
    // Public config API routes
    app.use(createConfigRoutes(service, config.logger));
    // Admin routes (protected)
    const adminAuth = createBasicAuth(config);
    app.use("/api/admin", adminAuth, createAdminRoutes(service, config.logger));
    // Serve React admin UI
    const publicPath = path.join(__dirname, "../../public");
    const mountPath = config.mountPath || '/configurator';
    // Serve static assets
    app.use("/admin", adminAuth, express.static(publicPath));
    // Serve index.html with injected mount path
    app.get("/admin", adminAuth, (_req, res) => {
        const indexPath = path.join(publicPath, "index.html");
        let html = require("fs").readFileSync(indexPath, "utf-8");
        html = html.replace("__MOUNT_PATH__", mountPath);
        res.send(html);
    });
    // Catch-all for React Router
    app.get("/admin/*", adminAuth, (_req, res) => {
        const indexPath = path.join(publicPath, "index.html");
        let html = require("fs").readFileSync(indexPath, "utf-8");
        html = html.replace("__MOUNT_PATH__", mountPath);
        res.send(html);
    });
    // Health check
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", service: "ConfigManager" });
    });
    // Error handling
    app.use((err, _req, res, _next) => {
        config.logger.error("Unhandled error", err);
        res.status(500).json({ error: "Internal server error" });
    });
    return app;
}
//# sourceMappingURL=app.js.map