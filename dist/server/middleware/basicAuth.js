import basicAuth from "express-basic-auth";
export function createBasicAuth(config) {
    return basicAuth({
        users: {
            [config.admin.username]: config.admin.password
        },
        challenge: true,
        realm: "ConfigManager Admin"
    });
}
//# sourceMappingURL=basicAuth.js.map