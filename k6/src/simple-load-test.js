import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Métriques personnalisées
const errorRate = new Rate('error_rate');
const fileUploadErrors = new Counter('file_upload_errors');
const fileDownloadErrors = new Counter('file_download_errors');
const rateLimitHits = new Counter('rate_limit_hits');
const fileUploadDuration = new Trend('file_upload_duration');
const fileDownloadDuration = new Trend('file_download_duration');

// Configuration dynamique de l'environnement
function getEnvironmentConfig() {
  const envName = __ENV.ENVIRONMENT || 'local';
  
  const environments = {
    local: {
      baseUrl: 'http://localhost:3001',
      apiUrl: 'http://localhost:3001', 
      assetsUrl: 'http://localhost:8080',
      bearerToken: 'token',
      namespace: 'DEV'
    },
    kubernetes: {
      baseUrl: 'http://media-service.tada-api.media',
      apiUrl: 'http://media-service.tada-api.media',
      assetsUrl: 'http://media-service.media', 
      bearerToken: 'token',
      namespace: 'DEV'
    }
  };

  const defaultEnv = environments[envName] || environments.local;
  
  return {
    baseUrl: __ENV.BASE_URL || defaultEnv.baseUrl,
    apiUrl: __ENV.API_URL || defaultEnv.apiUrl,
    assetsUrl: __ENV.ASSETS_URL || defaultEnv.assetsUrl,
    bearerToken: __ENV.BEARER_TOKEN || defaultEnv.bearerToken,
    namespace: __ENV.NAMESPACE || defaultEnv.namespace
  };
}

const ENV = getEnvironmentConfig();

console.log(`🎯 Running load tests against environment: ${__ENV.ENVIRONMENT || 'local'}`);
console.log(`📡 API URL: ${ENV.apiUrl}`);

export const options = {
  scenarios: {
    load_test_upload: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 5 },
        { duration: '5m', target: 10 },
        { duration: '2m', target: 0 }
      ],
      exec: 'uploadTest',
      tags: { test_type: 'load', operation: 'upload' }
    },
    load_test_download: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '8m',
      preAllocatedVUs: 3,
      maxVUs: 10,
      exec: 'downloadTest',
      startTime: '1m',
      tags: { test_type: 'load', operation: 'download' }
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    error_rate: ['rate<0.02'],
    file_upload_duration: ['p(95)<10000'],
    file_download_duration: ['p(95)<2000']
  }
};

// Pool partagé de fichiers
const sharedFilePool = [];

// Fonction utilitaire pour créer les headers d'authentification
function makeAuthHeaders(additionalHeaders = {}) {
  return {
    'Authorization': `Bearer ${ENV.bearerToken}`,
    'Content-Type': 'application/json',
    ...additionalHeaders
  };
}

// Fonction utilitaire pour les headers multipart
function makeMultipartHeaders() {
  return {
    'Authorization': `Bearer ${ENV.bearerToken}`
  };
}

// Fonction utilitaire pour vérifier les réponses
function checkResponse(response, expectedStatus = 200, testName = '') {
  const statusCodes = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const success = statusCodes.includes(response.status);
  
  const checkName = testName ? `${testName} - status is ${statusCodes.join(' or ')}` : `status is ${statusCodes.join(' or ')}`;
  
  const result = check(response, {
    [checkName]: (r) => statusCodes.includes(r.status)
  });
  
  errorRate.add(!success);
  return result && success;
}

export function uploadTest() {
  group('Load Test - File Upload', () => {
    const destinations = ['load-test', 'performance', 'k6-test'];
    const destination = destinations[Math.floor(Math.random() * destinations.length)];
    
    const formData = {
      namespace: ENV.namespace,
      destination: destination,
      toWebp: 'true',
      information: `Load test file - VU:${__VU} - Iter:${__ITER} - ${new Date().toISOString()}`,
      expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    
    const startTime = Date.now();
    const response = http.post(`${ENV.apiUrl}/file`, formData, {
      headers: makeMultipartHeaders(),
      timeout: '60s'
    });
    const duration = Date.now() - startTime;
    
    fileUploadDuration.add(duration);
    const success = checkResponse(response, 200, 'Load Upload');
    
    if (!success) {
      fileUploadErrors.add(1);
    } else if (response.body) {
      try {
        const responseData = JSON.parse(response.body);
        if (responseData.data && responseData.data.length > 0) {
          const fileInfo = {
            uuid: responseData.data[0].uuid,
            publicUrl: responseData.data[0].public_url
          };
          
          sharedFilePool.push(fileInfo);
          
          // Limiter la taille du pool
          if (sharedFilePool.length > 100) {
            sharedFilePool.splice(0, 10);
          }
          
          console.log(`Uploaded file: ${fileInfo.uuid}`);
        }
      } catch (e) {
        console.error('Failed to parse upload response:', e);
      }
    }
    
    sleep(Math.random() * 2 + 1);
  });
}

export function downloadTest() {
  group('Load Test - File Download', () => {
    if (sharedFilePool.length === 0) {
      console.log('No files available for download test, skipping...');
      sleep(1);
      return;
    }
    
    const randomFile = sharedFilePool[Math.floor(Math.random() * sharedFilePool.length)];
    
    const startTime = Date.now();
    const response = http.get(randomFile.publicUrl, {
      timeout: '30s'
    });
    const duration = Date.now() - startTime;
    
    fileDownloadDuration.add(duration);
    const success = checkResponse(response, [200, 429], 'Load Download');
    
    if (response.status === 429) {
      rateLimitHits.add(1);
      console.log(`Rate limit hit for file: ${randomFile.uuid}`);
    } else if (!success) {
      fileDownloadErrors.add(1);
    }
    
    sleep(Math.random() * 0.5);
  });
}

// Fonction par défaut pour les tests simples
export default function() {
  uploadTest();
}