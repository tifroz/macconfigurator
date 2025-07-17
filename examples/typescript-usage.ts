// Example: Using macconfigurator in a TypeScript project

import { configManager, ConfigClient, createConfigClient, type ConfigManagerOptions } from 'macconfigurator';

// Example 1: Starting the config manager server
async function startConfigServer() {
  const options: ConfigManagerOptions = {
    port: 4480,
    mountPath: '/api/config',
    logger: console,
    admin: {
      username: 'admin',
      password: 'secure-password'
    },
    // Optional MongoDB configuration
    mongodb: {
      host: 'localhost',
      port: 27017,
      collection: 'app_configs',
      auth: {
        database: 'admin',
        user: 'mongouser',
        password: 'mongopass'
      }
    }
  };

  await configManager.start(options);
  console.log('Config manager started!');
}

// Example 2: Using the client to fetch configurations
async function useConfigClient() {
  // Create a client instance
  const client = createConfigClient('http://localhost:4480/api/config', 'my-app');
  
  // Or use the class directly with more control
  const configClient = new ConfigClient({
    baseUrl: 'http://localhost:4480/api/config',
    applicationId: 'my-app'
  });

  try {
    // Fetch default configuration
    const defaultConfig = await client.getConfig('1.0.0');
    console.log('Default config:', defaultConfig);

    // Fetch environment-specific configuration
    const prodConfig = await client.getConfig('1.0.0', 'production');
    console.log('Production config:', prodConfig);

    // With type safety
    interface MyAppConfig {
      apiUrl: string;
      timeout: number;
      features: {
        darkMode: boolean;
        analytics: boolean;
      };
    }

    const typedConfig = await client.getConfig<MyAppConfig>('1.0.0', 'production');
    console.log('API URL:', typedConfig.apiUrl);
    console.log('Dark mode enabled:', typedConfig.features.darkMode);

    // Check if a version is available for a named config
    const isAvailable = await client.checkVersion('2.0.0', 'production');
    console.log('Version 2.0.0 available for production:', isAvailable);

  } catch (error) {
    console.error('Failed to fetch config:', error);
  }
}

// Example 3: Creating a configuration service for your app
class AppConfigService {
  private client: ConfigClient;
  private cache: Map<string, any> = new Map();

  constructor(baseUrl: string, applicationId: string) {
    this.client = createConfigClient(baseUrl, applicationId);
  }

  async getConfig<T = any>(version: string, environment?: string): Promise<T> {
    const cacheKey = `${version}-${environment || 'default'}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const config = await this.client.getConfig<T>(version, environment);
    this.cache.set(cacheKey, config);
    
    return config;
  }

  clearCache() {
    this.cache.clear();
  }
}

// Usage in your application
async function main() {
  const configService = new AppConfigService('http://localhost:4480/api/config', 'my-app');
  
  interface AppConfig {
    apiBaseUrl: string;
    features: {
      enableBetaFeatures: boolean;
      maxUploadSize: number;
    };
  }

  const config = await configService.getConfig<AppConfig>('1.0.0', 'production');
  
  // Use the config in your app
  console.log('Connecting to API:', config.apiBaseUrl);
  console.log('Beta features:', config.features.enableBetaFeatures ? 'Enabled' : 'Disabled');
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}