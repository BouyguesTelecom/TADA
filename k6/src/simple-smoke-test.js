import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Métriques personnalisées
const errorRate = new Rate('error_rate');
const fileUploadErrors = new Counter('file_upload_errors');
const fileUploadDuration = new Trend('file_upload_duration');

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

console.log(`🎯 Running tests against environment: ${__ENV.ENVIRONMENT || 'local'}`);
console.log(`📡 API URL: ${ENV.apiUrl}`);

export const options = {
  scenarios: {
    smoke_test: {
      executor: 'constant-vus',
      vus: 1,
      duration: '2m',
      tags: { test_type: 'smoke' }
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
    error_rate: ['rate<0.05']
  }
};

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
    // Note: Ne pas définir Content-Type pour multipart, K6 le fait automatiquement
  };
}

// Fonction utilitaire pour vérifier les réponses
function checkResponse(response, expectedStatus = 200, testName = '') {
  const statusCodes = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const success = statusCodes.includes(response.status);
  
  const checkName = testName ? `${testName} - status is ${statusCodes.join(' or ')}` : `status is ${statusCodes.join(' or ')}`;
  
  if (response.status >= 400) {
    console.log(`Error ${response.status}: ${response.body}`);
  }
  
  const result = check(response, {
    [checkName]: (r) => statusCodes.includes(r.status)
  });
  
  errorRate.add(!success);
  return result && success;
}

let uploadedFiles = [];

export default function smokeTest() {
  group('Smoke Test - Basic API Health Check', () => {
    
    group('1. Health Check - Catalog List', () => {
      console.log('Testing catalog list endpoint...');
      const response = http.get(`${ENV.apiUrl}/catalog`, {
        timeout: '30s'
      });
      
      const success = checkResponse(response, 200, 'Catalog List');
      console.log(`Catalog List - Status: ${response.status}, Duration: ${response.timings.duration}ms`);
      
      if (success) {
        try {
          const catalog = JSON.parse(response.body);
          console.log(`Catalog contains ${Array.isArray(catalog) ? catalog.length : 'unknown'} items`);
        } catch (e) {
          console.log('Could not parse catalog response');
        }
      }
    });
    
    group('2. File Upload Test', () => {
      console.log('Testing file upload...');
      
      // Créer un petit fichier PNG valide (1x1 transparent) en créant directement les bytes
      // PNG header + IHDR + IDAT + IEND 
      const pngBytes = [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk header
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, // RGBA, CRC
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, // IDAT chunk header  
        0x78, 0x9C, 0x63, 0xF8, 0xFF, 0x9F, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, // compressed data
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82 // IEND chunk
      ];
      
      // Convertir en ArrayBuffer compatible K6
      const pngBuffer = new ArrayBuffer(pngBytes.length);
      const pngView = new Uint8Array(pngBuffer);
      pngBytes.forEach((byte, index) => {
        pngView[index] = byte;
      });
      
      const formData = {
        file: http.file(pngBuffer, 'test-smoke.png', 'image/png'),
        namespace: ENV.namespace,
        destination: 'smoke-test',
        toWebp: 'true',
        information: `Smoke test file - ${new Date().toISOString()}`
      };
      
      const startTime = Date.now();
      const response = http.post(`${ENV.apiUrl}/file`, formData, {
        headers: makeMultipartHeaders(),
        timeout: '60s'
      });
      const duration = Date.now() - startTime;
      
      fileUploadDuration.add(duration);
      const success = checkResponse(response, 200, 'File Upload');
      
      if (!success) {
        fileUploadErrors.add(1);
      }
      
      console.log(`File Upload - Status: ${response.status}, Duration: ${duration}ms`);
      
      if (success && response.body) {
        try {
          const responseData = JSON.parse(response.body);
          if (responseData.data && responseData.data.length > 0) {
            uploadedFiles.push({
              uuid: responseData.data[0].uuid,
              publicUrl: responseData.data[0].public_url
            });
            console.log(`Uploaded file UUID: ${responseData.data[0].uuid}`);
          }
        } catch (e) {
          console.error('Failed to parse upload response:', e);
        }
      }
    });
    
    if (uploadedFiles.length > 0) {
      group('3. File Download Test', () => {
        const file = uploadedFiles[0];
        console.log(`Testing file download: ${file.uuid}`);
        
        const response = http.get(file.publicUrl, {
          headers: makeAuthHeaders(),
          timeout: '30s'
        });
        
        const success = checkResponse(response, [200, 429], 'File Download');
        console.log(`File Download - Status: ${response.status}, Duration: ${response.timings.duration}ms`);
        
        if (response.status === 429) {
          console.log('Rate limit hit during download test');
        }
      });
      
      group('4. Catalog Item Retrieval', () => {
        const file = uploadedFiles[0];
        console.log(`Testing catalog item retrieval: ${file.uuid}`);
        
        const response = http.get(`${ENV.apiUrl}/catalog/${file.uuid}`, {
          timeout: '30s'
        });
        
        const success = checkResponse(response, 200, 'Catalog Item');
        console.log(`Catalog Item - Status: ${response.status}, Duration: ${response.timings.duration}ms`);
      });
      
      group('5. File Update Test', () => {
        const file = uploadedFiles[0];
        console.log(`Testing file update: ${file.uuid}`);
        
        const updatePayload = JSON.stringify({
          data: [{
            st: 'CMS',
            key_name: 'unique_name',
            key_value: file.uuid,
            changes: { expired: 'false', information: 'Smoke test updated file' }
          }]
        });
        
        const response = http.patch(`${ENV.apiUrl}/file/${file.uuid}`, updatePayload, {
          headers: makeAuthHeaders(),
          timeout: '30s'
        });
        
        const success = checkResponse(response, 200, 'File Update');
        console.log(`File Update - Status: ${response.status}, Duration: ${response.timings.duration}ms`);
      });
      
      group('6. Cleanup - File Deletion', () => {
        const file = uploadedFiles[0];
        console.log(`Cleaning up file: ${file.uuid}`);
        
        const response = http.del(`${ENV.apiUrl}/file/${file.uuid}`, null, {
          headers: makeAuthHeaders(),
          timeout: '30s'
        });
        
        const success = checkResponse(response, 200, 'File Delete');
        console.log(`File Delete - Status: ${response.status}, Duration: ${response.timings.duration}ms`);
        
        if (success) {
          console.log(`Successfully cleaned up file: ${file.uuid}`);
        }
      });
    }
    
    sleep(1);
  });
}