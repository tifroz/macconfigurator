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

```bash
npm install macconfigurator
```

### TypeScript Support

Full TypeScript support is included. Types are automatically available when you install the package.

```typescript
import { configManager, createConfigClient, type ConfigManagerOptions } from 'macconfigurator';
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

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `port` | number | Yes | - | Port to run the service on |
| `mountPath` | string | No | `/configurator` | Base path for mounting the service |
| `logger` | object | Yes | - | Logger instance (e.g., `console`) |
| `admin.username` | string | Yes | - | Admin UI username |
| `admin.password` | string | Yes | - | Admin UI password |
| `mongodb` | object | No | - | MongoDB configuration (if not provided, uses in-memory storage) |

## Usage Examples

### 1. Custom Mount Path

Deploy the configurator at different paths based on your needs:

```javascript
// Mount at /api/config
const config = {
  port: 3000,
  mountPath: "/api/config",
  logger: console,
  admin: { username: "admin", password: "secret" }
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
const response = await fetch('http://localhost:4480/configurator/config/my-app/1.0.0');
const config = await response.json();

// Fetch named config (e.g., production)
const prodResponse = await fetch('http://localhost:4480/configurator/config/my-app/1.0.0?name=production');
const prodConfig = await prodResponse.json();
```

### 5. TypeScript Integration

```typescript
import { createConfigClient, type ConfigClient } from 'macconfigurator';

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
const client = createConfigClient('http://localhost:4480/configurator', 'my-app');

// Fetch with type safety
const config = await client.getConfig<MyAppConfig>('1.0.0', 'production');

// TypeScript knows the shape!
console.log(config.apiUrl); // string
console.log(config.features.darkMode); // boolean
```

### 6. JavaScript Integration

```javascript
const { createConfigClient } = require('macconfigurator');

// Create client
const client = createConfigClient('http://localhost:4480/configurator', 'my-app');

// Fetch configuration
const config = await client.getConfig('1.0.0', 'production');
console.log('Config loaded:', config);
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