import { createLogger } from '../shared/logger.js';

const logger = createLogger('gateway');

class SDKGateway {
  async setup(core) {
    logger.info('Setting up SDK gateway...');
    
    // Generate SDK endpoints
    const routes = core.router.getRoutesForSDK();
    
    // Store for SDK generation
    this.endpoints = routes;
    logger.info(`✅ ${routes.length} endpoints available for SDK`);
  }

  generateSDKCode() {
    const endpoints = this.endpoints || [];
    
    return `
// Auto-generated SDK for Post-Master Pro
class PostMasterSDK {
  constructor(config = {}) {
    this.baseURL = config.baseURL || '${process.env.APP_URL}';
    this.token = config.token || null;
  }

  setToken(token) {
    this.token = token;
    return this;
  }

  async request(method, endpoint, data = null) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = \`Bearer \${this.token}\`;
    }

    const response = await fetch(\`\${this.baseURL}/api/v1\${endpoint}\`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : null
    });

    if (!response.ok) {
      throw new Error(\`API error: \${response.status}\`);
    }

    return await response.json();
  }

  ${this.generateMethods(endpoints)}
}

export default PostMasterSDK;
    `;
  }

  generateMethods(endpoints) {
    return endpoints.map(endpoint => {
      const methodName = this.createMethodName(endpoint);
      
      if (endpoint.method === 'GET' || endpoint.method === 'DELETE') {
        return `
  ${methodName}(params = {}) {
    let url = '${endpoint.path}';
    // Replace path parameters
    Object.keys(params).forEach(key => {
      url = url.replace(\`:\${key}\`, params[key]);
    });
    return this.request('${endpoint.method}', url);
  }`;
      } else {
        return `
  ${methodName}(data) {
    return this.request('${endpoint.method}', '${endpoint.path}', data);
  }`;
      }
    }).join('\n');
  }

  createMethodName(endpoint) {
    const path = endpoint.path.replace(/^\/|\/$/g, '');
    const parts = path.split('/').filter(p => !p.startsWith(':'));
    
    if (parts.length === 0) {
      return endpoint.method.toLowerCase();
    }
    
    return endpoint.method.toLowerCase() + 
           parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  }
}

export default new SDKGateway();