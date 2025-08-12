import { Options } from 'k6/options';
import { group, sleep } from 'k6';
import { getEnvironment } from '../config/environment';
import { makeRequest, makeMultipartHeaders, checkResponse, logResponse } from '../utils/http';
import { loadTestFiles, createFileFormData } from '../utils/file-utils';
import { customMetrics, recordFileUpload, recordFileDownload, recordCatalogOperation } from '../utils/metrics';

const env = getEnvironment();
const testFiles = loadTestFiles();

export const options: Options = {
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

let uploadedFiles: Array<{ uuid: string; publicUrl: string }> = [];

export default function smokeTest() {
  group('Smoke Test - Basic API Health Check', () => {
    
    group('1. Health Check - Catalog List', () => {
      const startTime = Date.now();
      const response = makeRequest('GET', `${env.apiUrl}/catalog`);
      const duration = Date.now() - startTime;
      
      const success = checkResponse(response, 200, 'Catalog List');
      recordCatalogOperation(duration, success);
      logResponse(response, 'Catalog List');
    });
    
    if (Object.keys(testFiles).length > 0) {
      group('2. File Upload Test', () => {
        const fileType = Object.keys(testFiles)[0];
        const testFile = testFiles[fileType];
        
        const formData = createFileFormData(testFile, env.namespace, 'smoke-test');
        
        const startTime = Date.now();
        const response = makeRequest(
          'POST', 
          `${env.apiUrl}/file`, 
          formData, 
          { headers: makeMultipartHeaders() }
        );
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, 200, 'File Upload');
        recordFileUpload(duration, success);
        logResponse(response, 'File Upload');
        
        if (success && response.body) {
          try {
            const responseData = JSON.parse(response.body as string);
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
    }
    
    if (uploadedFiles.length > 0) {
      group('3. File Download Test', () => {
        const file = uploadedFiles[0];
        
        const startTime = Date.now();
        const response = makeRequest('GET', file.publicUrl);
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, [200, 429], 'File Download');
        recordFileDownload(duration, success);
        logResponse(response, 'File Download');
        
        if (response.status === 429) {
          console.log('Rate limit hit during download test');
        }
      });
      
      group('4. Catalog Item Retrieval', () => {
        const file = uploadedFiles[0];
        
        const startTime = Date.now();
        const response = makeRequest('GET', `${env.apiUrl}/catalog/${file.uuid}`);
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, 200, 'Catalog Item');
        recordCatalogOperation(duration, success);
        logResponse(response, 'Catalog Item');
      });
      
      group('5. File Update Test', () => {
        const file = uploadedFiles[0];
        const updatePayload = JSON.stringify({
          data: [{
            st: 'CMS',
            key_name: 'unique_name',
            key_value: file.uuid,
            changes: { expired: 'false', information: 'Smoke test updated file' }
          }]
        });
        
        const startTime = Date.now();
        const response = makeRequest('PATCH', `${env.apiUrl}/file/${file.uuid}`, updatePayload);
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, 200, 'File Update');
        recordFileUpload(duration, success);
        logResponse(response, 'File Update');
      });
      
      group('6. Cleanup - File Deletion', () => {
        const file = uploadedFiles[0];
        
        const startTime = Date.now();
        const response = makeRequest('DELETE', `${env.apiUrl}/file/${file.uuid}`, null);
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, 200, 'File Delete');
        recordFileUpload(duration, success);
        logResponse(response, 'File Delete');
        
        if (success) {
          uploadedFiles = uploadedFiles.filter(f => f.uuid !== file.uuid);
          console.log(`Cleaned up file: ${file.uuid}`);
        }
      });
    }
    
    sleep(1);
  });
}