#!/usr/bin/env node

// 25 Lines by Claude Sonnet
// Test script to verify all routes work with configurable mount path - converted to TypeScript

const BASE_URL = 'http://localhost:4480';
const MOUNT_PATH = '/configurator'; // This should match what's in configurator.ts
const AUTH = Buffer.from('admin:admin').toString('base64');

interface TestResponse {
  success: boolean;
  data?: any;
  error?: Error;
}

async function testRoute(method: string, path: string, body: any = null): Promise<TestResponse> {
  const url = `${BASE_URL}${MOUNT_PATH}${path}`;
  console.log(`\nTesting ${method} ${url}`);
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    let data: any;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType && contentType.includes('text/html')) {
      data = await response.text();
      // Check if mount path is properly injected
      if (data.includes('__MOUNT_PATH__')) {
        console.log('❌ Mount path not injected in HTML');
      } else if (data.includes(`mountPath: '${MOUNT_PATH}'`)) {
        console.log('✅ Mount path correctly injected in HTML');
      }
      
      // Check if bundle path is relative
      const bundleMatch = data.match(/src="([^"]+bundle[^"]+\.js)"/);
      if (bundleMatch && bundleMatch[1].startsWith('./')) {
        console.log('✅ Bundle path is relative:', bundleMatch[1]);
      } else if (bundleMatch) {
        console.log('❌ Bundle path is not relative:', bundleMatch[1]);
      }
    } else {
      data = await response.text();
    }
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Success');
    } else {
      console.log('❌ Failed');
    }
    
    // Show data for non-HTML responses
    if (!contentType || !contentType.includes('text/html')) {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    
    return { success: response.ok, data };
  } catch (error) {
    console.log('❌ Error:', (error as Error).message);
    return { success: false, error: error as Error };
  }
}

async function runTests(): Promise<void> {
  console.log('=== Testing ConfigManager Routes ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Mount Path: ${MOUNT_PATH}`);
  console.log(`Full URL: ${BASE_URL}${MOUNT_PATH}`);
  
  // Test health check
  await testRoute('GET', '/health');
  
  // Test admin UI
  await testRoute('GET', '/admin');
  
  // Test admin API routes
  await testRoute('GET', '/api/admin/applications');
  
  // Create a test application
  const testApp = {
    applicationId: 'test-app',
    defaultConfig: { data: { testKey: 'testValue' } },
    schema: {},
    namedConfigs: {}
  };
  
  const createResult = await testRoute('POST', '/api/admin/applications', testApp);
  
  if (createResult.success) {
    // Test getting the created application
    await testRoute('GET', '/api/admin/applications/test-app');
    
    // Test public config API
    await testRoute('GET', '/config/test-app/1.0.0');
    
    // Test named config
    const namedConfig = {
      name: 'production',
      data: { env: 'prod' },
      versions: ['1.0.0', '1.1.0']
    };
    await testRoute('POST', '/api/admin/applications/test-app/configs', namedConfig);
    
    // Clean up - archive the test app
    await testRoute('POST', '/api/admin/applications/test-app/archive');
  }
  
  console.log('\n=== Tests Complete ===');
}

runTests().catch(console.error);