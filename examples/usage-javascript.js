// Example: Using macconfigurator in a JavaScript project

const { configManager, createConfigClient } = require('macconfigurator');
// or with ES modules:
// import { configManager, createConfigClient } from 'macconfigurator';

// Example 1: Starting the config manager server
async function startServer() {
  await configManager.start({
    port: 4480,
    mountPath: '/config',
    logger: console,
    admin: {
      username: 'admin',
      password: 'admin'
    }
  });
  
  console.log('Config manager running at http://localhost:4480/config');
}

// Example 2: Using the client
async function fetchConfig() {
  const client = createConfigClient('http://localhost:4480/config', 'my-app');
  
  // Get default config
  const config = await client.getConfig('1.0.0');
  console.log('Config:', config);
  
  // Get production config
  const prodConfig = await client.getConfig('1.0.0', 'production');
  console.log('Production config:', prodConfig);
}

// Run the examples
startServer()
  .then(() => fetchConfig())
  .catch(console.error);