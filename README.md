# Readiness

This is internally tested software, not designed to public consumption, not designed to run in any productions environement of any kind. Use at your own risk.

# Mac Configurator

A flexible configuration management service with a web-based admin UI, designed to serve application configurations with version control and named environment support.

## Features

- 🚀 **Dynamic Configuration Management** - Manage configurations for multiple applications
- 🔌 **Flexible Mount Path** - Deploy at any URL path (`/configurator`, `/config`, `/api/config`, etc.)
- 📝 **Version Control** - Semantic versioning support for configurations
- 🌍 **Named Environments** - Support for multiple environments (dev, staging, production)
- 🛡️ **Basic Auth Protection** - Secure admin interface
- 💾 **Multiple Storage Options** - In-memory for testing, MongoDB for production
- 🎨 **Modern Admin UI** - React-based interface with JSON editor

## Installation

Install directly from GitHub:

```bash
npm install tifroz/macconfigurator
```

Or in your package.json:

```json
{
  "dependencies": {
    "macconfigurator": "tifroz/macconfigurator"
  }
}
```

### TypeScript Support

Full TypeScript support is included. The package includes pre-built JavaScript files and TypeScript declarations, so it works immediately after installation.

```typescript
import { configManager, createConfigClient, type ConfigManagerOptions } from "macconfigurator";
```

## Quick Start

### In-Memory Configuration (Development/Testing)

```javascript
import { configManager } from "./index.js";

const inMemoryParams = {
  port: 4480,
  mountPath: "/configurator", // Optional, defaults to "/configurator"
  logger: console,
  admin: {
    username: "admin",
    password: "admin",
  },
  cacheControl: {
    maxAgeSeconds: 60,        // Cache duration for named configs
    defaultMaxAgeSeconds: 300 // Cache duration for default configs
  },
};

await configManager.start(inMemoryParams);
```

After starting, access:

- Admin UI: `http://localhost:4480/configurator/admin`
- Config API: `http://localhost:4480/configurator/config/{applicationId}/{version}`

### MongoDB Configuration (Production)

```javascript
import { configManager } from "./index.js";

const mongoConfig = {
  port: 4480,
  mountPath: "/config", // Custom mount path
  logger: console,
  admin: {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  },
  cacheControl: {
    maxAgeSeconds: 60,        // Cache duration for named configs
    defaultMaxAgeSeconds: 300 // Cache duration for default configs
  },
  mongodb: {
    host: "localhost",
    port: 27017,
    collection: "app_configs",
    auth: {
      database: "admin",
      user: process.env.MONGO_USER,
      password: process.env.MONGO_PASSWORD,
    },
  },
};

await configManager.start(mongoConfig);
```

## Configuration Options

| Option                            | Type   | Required | Default         | Description                                                     |
| --------------------------------- | ------ | -------- | --------------- | --------------------------------------------------------------- |
| `port`                            | number | Yes      | -               | Port to run the service on                                      |
| `mountPath`                       | string | No       | `/configurator` | Base path for mounting the service                              |
| `logger`                          | object | Yes      | -               | Logger instance (e.g., `console`)                               |
| `admin.username`                  | string | Yes      | -               | Admin UI username                                               |
| `admin.password`                  | string | Yes      | -               | Admin UI password                                               |
| `cacheControl.maxAgeSeconds`      | number | No       | 60              | Cache-Control header duration for named configurations (seconds) |
| `cacheControl.defaultMaxAgeSeconds` | number | No       | 300             | Cache-Control header duration for default configurations (seconds) |
| `mongodb`                         | object | No       | -               | MongoDB configuration (if not provided, uses in-memory storage) |

## Usage Examples

### 1. Custom Mount Path

Deploy the configurator at different paths based on your needs:

```javascript
// Mount at /api/config
const config = {
  port: 3000,
  mountPath: "/api/config",
  logger: console,
  admin: { username: "admin", password: "secret" },
  cacheControl: {
    maxAgeSeconds: 60,        // Cache duration for named configs
    defaultMaxAgeSeconds: 300 // Cache duration for default configs
  },
};

// Access at:
// - Admin: http://localhost:3000/api/config/admin
// - API: http://localhost:3000/api/config/config/{appId}/{version}
```

### 2. Creating Application Configurations

Use the Admin UI or API to create configurations:

```bash
# Create a new application config via API
curl -X POST http://localhost:4480/configurator/api/admin/applications \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "my-app",
    "defaultConfig": {
      "data": {
        "apiUrl": "https://api.example.com",
        "timeout": 5000,
        "features": {
          "darkMode": false,
          "analytics": true
        }
      }
    },
    "schema": {}
  }'
```

### 3. Named Configurations for Environments

Create environment-specific configurations:

```bash
# Add a production config
curl -X POST http://localhost:4480/configurator/api/admin/applications/my-app/configs \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production",
    "data": {
      "apiUrl": "https://api.production.com",
      "timeout": 3000,
      "features": {
        "darkMode": true,
        "analytics": true,
        "debug": false
      }
    },
    "versions": ["1.0.0", "1.1.0", "2.0.0"]
  }'
```

### 4. Fetching Configurations

Applications can fetch their configurations:

```javascript
// Fetch default config
const response = await fetch("http://localhost:4480/configurator/config/my-app/1.0.0");
const config = await response.json();

// Fetch named config (e.g., production)
const prodResponse = await fetch("http://localhost:4480/configurator/config/my-app/1.0.0?name=production");
const prodConfig = await prodResponse.json();
```

### 5. TypeScript Integration

```typescript
import { createConfigClient, type ConfigClient } from "macconfigurator";

// Define your config shape
interface MyAppConfig {
  apiUrl: string;
  timeout: number;
  features: {
    darkMode: boolean;
    analytics: boolean;
    debugMode: boolean;
  };
}

// Create a typed client
const client = createConfigClient("http://localhost:4480/configurator", "my-app");

// Fetch with type safety
const config = await client.getConfig<MyAppConfig>("1.0.0", "production");

// TypeScript knows the shape!
console.log(config.apiUrl); // string
console.log(config.features.darkMode); // boolean
```

### 6. JavaScript Integration

```javascript
const { createConfigClient } = require("macconfigurator");

// Create client
const client = createConfigClient("http://localhost:4480/configurator", "my-app");

// Fetch configuration
const config = await client.getConfig("1.0.0", "production");
console.log("Config loaded:", config);
```

## Cache Control

The configurator supports HTTP caching to improve performance and reduce server load. Cache durations are configurable:

```javascript
const config = {
  port: 4480,
  logger: console,
  admin: { username: "admin", password: "admin" },
  cacheControl: {
    maxAgeSeconds: 60,        // Cache duration for named configurations
    defaultMaxAgeSeconds: 300 // Cache duration for default configurations
  }
};
```

### Cache Behavior

- **Named Configurations**: When a specific named configuration is matched (e.g., `production`, `staging`), the response includes `Cache-Control: max-age={maxAgeSeconds}`
- **Default Configurations**: When no named configuration matches and the default configuration is returned, the response includes `Cache-Control: max-age={defaultMaxAgeSeconds}`
- **Different Cache Durations**: You can set different cache durations for named vs default configs. For example, default configs might be cached longer (300 seconds) while named configs change more frequently (60 seconds)

### Cache Headers Example

```bash
# Named config response
curl -I "http://localhost:4480/configurator/config/my-app/1.0.0"
# HTTP/1.1 200 OK
# Cache-Control: max-age=60
# Content-Type: application/json

# Default config response (no named config matches)
curl -I "http://localhost:4480/configurator/config/my-app/2.0.0"
# HTTP/1.1 200 OK  
# Cache-Control: max-age=300
# Content-Type: application/json
```

## API Endpoints

### Public Endpoints

- `GET /config/{applicationId}/{version}` - Fetch configuration

  - Query params: `?name={configName}` for named configurations

- `GET /health` - Health check endpoint

### Admin Endpoints (Basic Auth Required)

- `GET /api/admin/applications` - List all applications
- `POST /api/admin/applications` - Create new application
- `GET /api/admin/applications/{applicationId}` - Get application details
- `PUT /api/admin/applications/{applicationId}` - Update application
- `POST /api/admin/applications/{applicationId}/archive` - Archive application
- `POST /api/admin/applications/{applicationId}/unarchive` - Unarchive application
- `POST /api/admin/applications/{applicationId}/configs` - Create named config
- `PUT /api/admin/applications/{applicationId}/configs/{configName}` - Update named config

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Testing

The project includes comprehensive test scripts that validate the entire configuration management workflow:

#### Main Test Suite (`npm test`)

The main test script creates a complete end-to-end test scenario:

1. **Server Setup**: Starts a configurator server using InMemoryService with admin/admin credentials
2. **Application Creation**: Creates 'app-test' with a JSON schema and default configuration
3. **Default Config Validation**: Verifies that the default configuration is properly returned
4. **Named Configuration**: Creates a named version 'test' with different configuration data
5. **Version Association**: Associates the named config with version "1.0.0"
6. **Configuration Override**: Verifies that named configs override default configs for specific versions

**Test Data Used:**
- **Schema**: Flexible JSON schema allowing any properties
- **Default Config**: `{"foo": "default config"}`
- **Named Config**: `{"foo": "named config"}`
- **Version**: `"1.0.0"`

**Test Flow:**
```bash
npm test
# [TEST] Starting configurator server...
# [TEST] Creating application 'app-test' with schema and default config...
# [TEST] Application created successfully with schema-valid default configuration
# [TEST] Querying config for http://localhost:4481/configurator/config/app-test/1.0.0...
# [TEST] Default configuration verified successfully
# [TEST] Creating named configuration 'test' with config...
# [TEST] Named configuration created successfully
# [TEST] Querying config for http://localhost:4481/configurator/config/app-test/1.0.0 (should return named config)...
# [TEST] Named configuration verified successfully
# [TEST] 🎉 All tests passed successfully!
```

#### Additional Test Scripts

- **`test-routes.ts`**: Tests all API endpoints and admin interface routing
- **`test-config-validation-error.ts`**: Comprehensive validation error testing
- **`test-error-details.ts`**: Detailed error analysis and reporting
- **`test-client-config.html`**: Frontend client configuration testing

All tests use TypeScript and are located in the `/tests` directory.

## Environment Variables

For production deployments:

```env
# Admin credentials
ADMIN_USERNAME=your-admin-user
ADMIN_PASSWORD=your-secure-password

# MongoDB credentials
MONGO_USER=your-mongo-user
MONGO_PASSWORD=your-mongo-password
MONGO_HOST=mongodb.example.com
MONGO_PORT=27017
MONGO_DATABASE=configs
```

## Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4480
CMD ["node", "dist/configurator.js"]
```

## License

MIT
