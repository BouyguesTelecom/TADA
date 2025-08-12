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
    stress_test_uploads: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 5 },
        { duration: '5m', target: 20 },
        { duration: '10m', target: 50 },
        { duration: '5m', target: 80 },
        { duration: '5m', target: 100 },
        { duration: '10m', target: 50 },
        { duration: '5m', target: 0 }
      ],
      exec: 'stressUploadTest',
      tags: { test_type: 'stress', operation: 'upload' }
    },
    stress_test_downloads: {
      executor: 'ramping-arrival-rate',
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 100 },
        { duration: '10m', target: 200 },
        { duration: '5m', target: 300 },
        { duration: '5m', target: 400 },
        { duration: '10m', target: 200 },
        { duration: '5m', target: 0 }
      ],
      preAllocatedVUs: 20,
      maxVUs: 100,
      exec: 'stressDownloadTest',
      startTime: '3m',
      tags: { test_type: 'stress', operation: 'download' }
    },
    stress_test_mixed: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 30 },
        { duration: '10m', target: 60 },
        { duration: '5m', target: 80 },
        { duration: '10m', target: 40 },
        { duration: '5m', target: 0 }
      ],
      exec: 'stressMixedTest',
      startTime: '1m',
      tags: { test_type: 'stress', operation: 'mixed' }
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<5000', 'p(99)<10000'],
    http_req_failed: ['rate<0.1'],
    error_rate: ['rate<0.05'],
    file_upload_duration: ['p(95)<15000', 'p(99)<30000'],
    file_download_duration: ['p(95)<3000', 'p(99)<8000'],
    catalog_response_time: ['p(95)<2000', 'p(99)<5000'],
    rate_limit_hits: ['count<100']
  }
};

const stressFilePool: Array<{ uuid: string; publicUrl: string; created: number }> = [];

export function stressUploadTest() {
  group('Stress Test - Concurrent Uploads', () => {
    if (Object.keys(testFiles).length === 0) {
      console.error('No test files available for stress upload test');
      return;
    }
    
    const fileTypes = Object.keys(testFiles);
    const randomFileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
    const testFile = testFiles[randomFileType];
    
    const destination = `stress-${generateRandomDestination()}`;
    const formData = createFileFormData(testFile, env.namespace, destination, Math.random() > 0.5, {
      information: `Stress test upload - VU:${__VU} - Iter:${__ITER}`
    });
    
    const startTime = Date.now();
    const response = makeRequest(
      'POST', 
      `${env.apiUrl}/file`, 
      formData, 
      { 
        headers: makeMultipartHeaders(),
        timeout: 45000
      }
    );
    const duration = Date.now() - startTime;
    
    const success = checkResponse(response, [200, 429, 503], 'Stress Upload');
    recordFileUpload(duration, success || response.status === 429 || response.status === 503);
    
    if (response.status === 429) {
      recordRateLimit();
      console.log('Rate limit hit during stress upload');
    } else if (response.status === 503) {
      console.log('Service unavailable during stress upload');
    } else if (success && response.body) {
      try {
        const responseData = JSON.parse(response.body as string);
        if (responseData.data && responseData.data.length > 0) {
          const fileInfo = {
            uuid: responseData.data[0].uuid,
            publicUrl: responseData.data[0].public_url,
            created: Date.now()
          };
          
          stressFilePool.push(fileInfo);
          
          if (stressFilePool.length > 200) {
            stressFilePool.splice(0, 50);
          }
        }
      } catch (e) {
        console.error('Failed to parse stress upload response:', e);
      }
    }
    
    if (response.status >= 500) {
      logResponse(response, 'Stress Upload Server Error');
    }
    
    sleep(Math.random() * 0.5);
  });
}

export function stressDownloadTest() {
  group('Stress Test - High-Frequency Downloads', () => {
    if (stressFilePool.length === 0) {
      console.log('No files available for stress download test');
      sleep(0.1);
      return;
    }
    
    const randomFile = stressFilePool[Math.floor(Math.random() * stressFilePool.length)];
    
    const startTime = Date.now();
    const response = makeRequest('GET', randomFile.publicUrl, null, { timeout: 10000 });
    const duration = Date.now() - startTime;
    
    const success = checkResponse(response, [200, 429, 503, 504], 'Stress Download');
    recordFileDownload(duration, success || [429, 503, 504].includes(response.status));
    
    if (response.status === 429) {
      recordRateLimit();
    } else if ([503, 504].includes(response.status)) {
      console.log(`Service issues during stress download: ${response.status}`);
    } else if (response.status >= 500) {
      logResponse(response, 'Stress Download Server Error');
    }
  });
}

export function stressMixedTest() {
  group('Stress Test - Mixed Operations', () => {
    const operations = ['upload', 'download', 'catalog_list', 'catalog_item', 'update'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    switch (operation) {
      case 'upload':
        if (Object.keys(testFiles).length > 0) {
          const fileType = Object.keys(testFiles)[Math.floor(Math.random() * Object.keys(testFiles).length)];
          const testFile = testFiles[fileType];
          const formData = createFileFormData(testFile, env.namespace, 'mixed-stress');
          
          const startTime = Date.now();
          const response = makeRequest('POST', `${env.apiUrl}/file`, formData, {
            headers: makeMultipartHeaders(),
            timeout: 30000
          });
          const duration = Date.now() - startTime;
          
          recordFileUpload(duration, checkResponse(response, [200, 429, 503], 'Mixed Upload'));
        }
        break;
        
      case 'download':
        if (stressFilePool.length > 0) {
          const file = stressFilePool[Math.floor(Math.random() * stressFilePool.length)];
          const startTime = Date.now();
          const response = makeRequest('GET', file.publicUrl);
          const duration = Date.now() - startTime;
          
          recordFileDownload(duration, checkResponse(response, [200, 429, 503], 'Mixed Download'));
        }
        break;
        
      case 'catalog_list':
        const startTime1 = Date.now();
        const response1 = makeRequest('GET', `${env.apiUrl}/catalog`);
        const duration1 = Date.now() - startTime1;
        
        recordCatalogOperation(duration1, checkResponse(response1, [200, 503], 'Mixed Catalog List'));
        break;
        
      case 'catalog_item':
        if (stressFilePool.length > 0) {
          const file = stressFilePool[Math.floor(Math.random() * stressFilePool.length)];
          const startTime2 = Date.now();
          const response2 = makeRequest('GET', `${env.apiUrl}/catalog/${file.uuid}`);
          const duration2 = Date.now() - startTime2;
          
          recordCatalogOperation(duration2, checkResponse(response2, [200, 404, 503], 'Mixed Catalog Item'));
        }
        break;
        
      case 'update':
        if (stressFilePool.length > 0) {
          const file = stressFilePool[Math.floor(Math.random() * stressFilePool.length)];
          const updatePayload = JSON.stringify({
            data: [{
              st: 'CMS',
              key_name: 'unique_name',
              key_value: file.uuid,
              changes: { information: `Stress test update - ${Date.now()}` }
            }]
          });
          
          const startTime3 = Date.now();
          const response3 = makeRequest('PATCH', `${env.apiUrl}/file/${file.uuid}`, updatePayload);
          const duration3 = Date.now() - startTime3;
          
          recordFileUpload(duration3, checkResponse(response3, [200, 404, 503], 'Mixed Update'));
        }
        break;
    }
    
    sleep(Math.random() * 0.1);
  });
}

export default function() {
  stressUploadTest();
}