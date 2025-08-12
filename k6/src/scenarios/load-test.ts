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
    load_test_upload: {
      executor: 'ramping-vus',
      stages: [
        { duration: '5m', target: 10 },
        { duration: '15m', target: 10 },
        { duration: '5m', target: 0 }
      ],
      exec: 'uploadTest',
      tags: { test_type: 'load', operation: 'upload' }
    },
    load_test_download: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '20m',
      preAllocatedVUs: 5,
      maxVUs: 20,
      exec: 'downloadTest',
      startTime: '2m',
      tags: { test_type: 'load', operation: 'download' }
    },
    load_test_catalog: {
      executor: 'ramping-arrival-rate',
      stages: [
        { duration: '5m', target: 20 },
        { duration: '10m', target: 40 },
        { duration: '5m', target: 20 },
        { duration: '5m', target: 0 }
      ],
      preAllocatedVUs: 10,
      maxVUs: 30,
      exec: 'catalogTest',
      startTime: '1m',
      tags: { test_type: 'load', operation: 'catalog' }
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    error_rate: ['rate<0.02'],
    file_upload_duration: ['p(95)<10000'],
    file_download_duration: ['p(95)<2000'],
    catalog_response_time: ['p(95)<1000']
  }
};

const sharedFilePool: Array<{ uuid: string; publicUrl: string }> = [];

export function uploadTest() {
  group('Load Test - File Upload', () => {
    if (Object.keys(testFiles).length === 0) {
      console.error('No test files available for upload test');
      return;
    }
    
    const fileTypes = Object.keys(testFiles);
    const randomFileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
    const testFile = testFiles[randomFileType];
    
    const destination = generateRandomDestination();
    const formData = createFileFormData(testFile, env.namespace, destination, true, {
      expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    
    const startTime = Date.now();
    const response = makeRequest(
      'POST', 
      `${env.apiUrl}/file`, 
      formData, 
      { headers: makeMultipartHeaders() }
    );
    const duration = Date.now() - startTime;
    
    const success = checkResponse(response, 200, 'Load Upload');
    recordFileUpload(duration, success);
    
    if (success && response.body) {
      try {
        const responseData = JSON.parse(response.body as string);
        if (responseData.data && responseData.data.length > 0) {
          const fileInfo = {
            uuid: responseData.data[0].uuid,
            publicUrl: responseData.data[0].public_url
          };
          
          sharedFilePool.push(fileInfo);
          
          if (sharedFilePool.length > 100) {
            sharedFilePool.splice(0, 10);
          }
        }
      } catch (e) {
        console.error('Failed to parse upload response:', e);
      }
    }
    
    if (response.status >= 400) {
      logResponse(response, 'Upload Error');
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
    const response = makeRequest('GET', randomFile.publicUrl);
    const duration = Date.now() - startTime;
    
    const success = checkResponse(response, [200, 429], 'Load Download');
    recordFileDownload(duration, success);
    
    if (response.status === 429) {
      recordRateLimit();
      console.log(`Rate limit hit for file: ${randomFile.uuid}`);
    } else if (response.status >= 400) {
      logResponse(response, 'Download Error');
    }
    
    sleep(Math.random() * 0.5);
  });
}

export function catalogTest() {
  group('Load Test - Catalog Operations', () => {
    const operations = ['list', 'item'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    let url: string;
    let testName: string;
    
    if (operation === 'list') {
      url = `${env.apiUrl}/catalog`;
      testName = 'Catalog List';
    } else {
      if (sharedFilePool.length === 0) {
        url = `${env.apiUrl}/catalog`;
        testName = 'Catalog List (fallback)';
      } else {
        const randomFile = sharedFilePool[Math.floor(Math.random() * sharedFilePool.length)];
        url = `${env.apiUrl}/catalog/${randomFile.uuid}`;
        testName = 'Catalog Item';
      }
    }
    
    const startTime = Date.now();
    const response = makeRequest('GET', url);
    const duration = Date.now() - startTime;
    
    const success = checkResponse(response, [200, 404], testName);
    recordCatalogOperation(duration, success);
    
    if (response.status >= 400 && response.status !== 404) {
      logResponse(response, 'Catalog Error');
    }
    
    sleep(Math.random() * 0.2);
  });
}

export default function() {
  uploadTest();
}