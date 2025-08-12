import { Options } from 'k6/options';
import { group, sleep } from 'k6';
import { getEnvironment } from '../config/environment';
import { makeRequest, makeMultipartHeaders, checkResponse, logResponse } from '../utils/http';
import { loadTestFiles, createFileFormData, generateRandomDestination } from '../utils/file-utils';
import { customMetrics, recordFileUpload, recordFileDownload, recordCatalogOperation, recordRateLimit } from '../utils/metrics';

const env = getEnvironment();
const testFiles = loadTestFiles();

export const options: Options = {
  scenarios: {
    spike_test_gradual_buildup: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 300 },
        { duration: '2m', target: 10 },
        { duration: '1m', target: 0 }
      ],
      exec: 'spikeGradualTest',
      tags: { test_type: 'spike', pattern: 'gradual' }
    },
    spike_test_instant_traffic: {
      executor: 'ramping-arrival-rate',
      stages: [
        { duration: '30s', target: 10 },
        { duration: '30s', target: 500 },
        { duration: '2m', target: 500 },
        { duration: '30s', target: 10 },
        { duration: '1m', target: 0 }
      ],
      preAllocatedVUs: 50,
      maxVUs: 200,
      exec: 'spikeInstantTest',
      startTime: '1m',
      tags: { test_type: 'spike', pattern: 'instant' }
    },
    spike_test_recovery: {
      executor: 'constant-vus',
      vus: 5,
      duration: '8m',
      exec: 'spikeRecoveryTest',
      startTime: '30s',
      tags: { test_type: 'spike', pattern: 'recovery' }
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<8000', 'p(99)<15000'],
    http_req_failed: ['rate<0.2'],
    error_rate: ['rate<0.15'],
    file_upload_duration: ['p(90)<20000'],
    file_download_duration: ['p(95)<5000'],
    catalog_response_time: ['p(95)<3000']
  }
};

const spikeFilePool: Array<{ uuid: string; publicUrl: string; spikeType: string }> = [];

export function spikeGradualTest() {
  group('Spike Test - Gradual Traffic Increase', () => {
    const operations = ['upload', 'download', 'catalog'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    switch (operation) {
      case 'upload':
        if (Object.keys(testFiles).length > 0) {
          const fileType = Object.keys(testFiles)[Math.floor(Math.random() * Object.keys(testFiles).length)];
          const testFile = testFiles[fileType];
          const formData = createFileFormData(testFile, env.namespace, `spike-gradual-${__VU}`, true, {
            information: `Gradual spike test - VU:${__VU} - ${Date.now()}`
          });
          
          const startTime = Date.now();
          const response = makeRequest(
            'POST', 
            `${env.apiUrl}/file`, 
            formData, 
            { 
              headers: makeMultipartHeaders(),
              timeout: 60000
            }
          );
          const duration = Date.now() - startTime;
          
          const success = checkResponse(response, [200, 429, 503, 504], 'Gradual Spike Upload');
          recordFileUpload(duration, success || [429, 503, 504].includes(response.status));
          
          if (response.status === 429) {
            recordRateLimit();
          } else if (success && response.body) {
            try {
              const responseData = JSON.parse(response.body as string);
              if (responseData.data && responseData.data.length > 0) {
                spikeFilePool.push({
                  uuid: responseData.data[0].uuid,
                  publicUrl: responseData.data[0].public_url,
                  spikeType: 'gradual'
                });
              }
            } catch (e) {
              console.error('Failed to parse gradual spike upload response:', e);
            }
          }
          
          if (response.status >= 500) {
            console.log(`Gradual spike upload server error: ${response.status}`);
          }
        }
        break;
        
      case 'download':
        if (spikeFilePool.length > 0) {
          const file = spikeFilePool[Math.floor(Math.random() * spikeFilePool.length)];
          const startTime = Date.now();
          const response = makeRequest('GET', file.publicUrl, null, { timeout: 15000 });
          const duration = Date.now() - startTime;
          
          recordFileDownload(duration, checkResponse(response, [200, 429, 503, 504], 'Gradual Spike Download'));
          
          if (response.status === 429) {
            recordRateLimit();
          }
        }
        break;
        
      case 'catalog':
        const startTime = Date.now();
        const response = makeRequest('GET', `${env.apiUrl}/catalog`, null, { timeout: 10000 });
        const duration = Date.now() - startTime;
        
        recordCatalogOperation(duration, checkResponse(response, [200, 503, 504], 'Gradual Spike Catalog'));
        break;
    }
    
    sleep(Math.random() * 0.2);
  });
}

export function spikeInstantTest() {
  group('Spike Test - Instant High Traffic', () => {
    customMetrics.activeUploads.add(1);
    
    try {
      if (Math.random() < 0.7 && spikeFilePool.length > 0) {
        const file = spikeFilePool[Math.floor(Math.random() * spikeFilePool.length)];
        
        const startTime = Date.now();
        const response = makeRequest('GET', file.publicUrl, null, { timeout: 8000 });
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, [200, 429, 503, 504, 502], 'Instant Spike Download');
        recordFileDownload(duration, success || [429, 503, 504, 502].includes(response.status));
        
        if (response.status === 429) {
          recordRateLimit();
        } else if ([502, 503, 504].includes(response.status)) {
          console.log(`Instant spike infrastructure issue: ${response.status}`);
        }
      } else if (Object.keys(testFiles).length > 0) {
        const fileType = Object.keys(testFiles)[0];
        const testFile = testFiles[fileType];
        const formData = createFileFormData(testFile, env.namespace, 'spike-instant', false, {
          information: `Instant spike test - ${Date.now()}`
        });
        
        const startTime = Date.now();
        const response = makeRequest(
          'POST', 
          `${env.apiUrl}/file`, 
          formData, 
          { 
            headers: makeMultipartHeaders(),
            timeout: 30000
          }
        );
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, [200, 429, 503, 504, 502], 'Instant Spike Upload');
        recordFileUpload(duration, success || [429, 503, 504, 502].includes(response.status));
        
        if (response.status === 429) {
          recordRateLimit();
        } else if (success && response.body) {
          try {
            const responseData = JSON.parse(response.body as string);
            if (responseData.data && responseData.data.length > 0) {
              spikeFilePool.push({
                uuid: responseData.data[0].uuid,
                publicUrl: responseData.data[0].public_url,
                spikeType: 'instant'
              });
              
              if (spikeFilePool.length > 500) {
                spikeFilePool.splice(0, 100);
              }
            }
          } catch (e) {
            console.error('Failed to parse instant spike upload response:', e);
          }
        }
      }
    } finally {
      customMetrics.activeUploads.add(-1);
    }
    
    if (Math.random() < 0.1) {
      sleep(0.05);
    }
  });
}

export function spikeRecoveryTest() {
  group('Spike Test - Recovery Monitoring', () => {
    const startTime = Date.now();
    const response = makeRequest('GET', `${env.apiUrl}/catalog`, null, { timeout: 5000 });
    const duration = Date.now() - startTime;
    
    const success = checkResponse(response, [200, 503], 'Recovery Monitor');
    recordCatalogOperation(duration, success || response.status === 503);
    
    if (response.status === 200) {
      try {
        const catalog = JSON.parse(response.body as string);
        customMetrics.queueSize.add(Array.isArray(catalog) ? catalog.length : 0);
        console.log(`Recovery monitoring - Catalog size: ${Array.isArray(catalog) ? catalog.length : 'unknown'}`);
      } catch (e) {
        console.log('Recovery monitoring - Could not parse catalog response');
      }
    } else {
      console.log(`Recovery monitoring - Service status: ${response.status}`);
    }
    
    sleep(5);
  });
}

export default function() {
  spikeGradualTest();
}