export interface Environment {
  baseUrl: string;
  apiUrl: string;
  assetsUrl: string;
  bearerToken: string;
  namespace: string;
  timeout: number;
}

export const environments: Record<string, Environment> = {
  local: {
    baseUrl: 'http://localhost:3001',
    apiUrl: 'http://localhost:3001',
    assetsUrl: 'http://localhost:8080',
    bearerToken: 'token',
    namespace: 'DEV',
    timeout: 30000
  },
  kubernetes: {
    baseUrl: 'http://media-service.tada-api.media',
    apiUrl: 'http://media-service.tada-api.media',
    assetsUrl: 'http://media-service.media',
    bearerToken: 'token',
    namespace: 'DEV',
    timeout: 30000
  },
  dev: {
    baseUrl: 'https://dev-api.example.com',
    apiUrl: 'https://dev-api.example.com',
    assetsUrl: 'https://dev-assets.example.com',
    bearerToken: 'dev-token',
    namespace: 'DEV',
    timeout: 30000
  },
  staging: {
    baseUrl: 'https://staging-api.example.com',
    apiUrl: 'https://staging-api.example.com',
    assetsUrl: 'https://staging-assets.example.com',
    bearerToken: 'staging-token',
    namespace: 'STAGING',
    timeout: 30000
  }
};

export function getEnvironment(): Environment {
  const envName = __ENV.ENVIRONMENT || 'local';
  const env = environments[envName];
  
  if (!env) {
    throw new Error(`Unknown environment: ${envName}`);
  }

  return {
    ...env,
    bearerToken: __ENV.BEARER_TOKEN || env.bearerToken,
    namespace: __ENV.NAMESPACE || env.namespace,
    baseUrl: __ENV.BASE_URL || env.baseUrl,
    apiUrl: __ENV.API_URL || env.apiUrl,
    assetsUrl: __ENV.ASSETS_URL || env.assetsUrl
  };
}