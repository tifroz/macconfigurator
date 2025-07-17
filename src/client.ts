// 15 Lines by Claude Opus
// Client utilities for consuming the Config Manager API

export interface ConfigClientOptions {
  baseUrl: string;
  applicationId: string;
}

export class ConfigClient {
  private baseUrl: string;
  private applicationId: string;

  constructor(options: ConfigClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.applicationId = options.applicationId;
  }

  /**
   * Fetch configuration for a specific version
   * @param version - Semantic version string (e.g., "1.0.0")
   * @param configName - Optional named configuration (e.g., "production", "staging")
   */
  async getConfig<T = any>(version: string, configName?: string): Promise<T> {
    const url = `${this.baseUrl}/config/${this.applicationId}/${version}`;
    const queryParams = configName ? `?name=${encodeURIComponent(configName)}` : '';
    
    const response = await fetch(url + queryParams);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Check if a specific version matches the semver range for a named config
   */
  async checkVersion(version: string, configName: string): Promise<boolean> {
    try {
      await this.getConfig(version, configName);
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Create a config client instance
 */
export function createConfigClient(baseUrl: string, applicationId: string): ConfigClient {
  return new ConfigClient({ baseUrl, applicationId });
}