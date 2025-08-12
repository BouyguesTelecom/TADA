import { Options } from 'k6/options';
import { group, sleep } from 'k6';
import { getEnvironment } from '../config/environment';
import { makeRequest, makeMultipartHeaders, checkResponse, logResponse } from '../utils/http';
import { loadTestFiles, createFileFormData } from '../utils/file-utils';
import { customMetrics, recordCatalogOperation, recordFileUpload } from '../utils/metrics';

const env = getEnvironment();
const testFiles = loadTestFiles();

export const options: Options = {
  scenarios: {
    catalog_operations_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 5 },
        { duration: '8m', target: 15 },
        { duration: '2m', target: 0 }
      ],
      exec: 'catalogOperationsTest',
      tags: { test_type: 'catalog', operation: 'full_cycle' }
    },
    catalog_heavy_read: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 10,
      maxVUs: 25,
      exec: 'catalogHeavyReadTest',
      startTime: '1m',
      tags: { test_type: 'catalog', operation: 'heavy_read' }
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    http_req_failed: ['rate<0.02'],
    error_rate: ['rate<0.01'],
    catalog_response_time: ['p(95)<1500', 'p(99)<3000']
  }
};

const catalogFilePool: Array<{ uuid: string; publicUrl: string; namespace: string; destination: string }> = [];

export function catalogOperationsTest() {
  group('Catalog Test - Full CRUD Operations', () => {
    
    group('1. Setup - Create test files', () => {
      if (Object.keys(testFiles).length > 0 && catalogFilePool.length < 20) {
        const fileType = Object.keys(testFiles)[Math.floor(Math.random() * Object.keys(testFiles).length)];
        const testFile = testFiles[fileType];
        
        const destinations = ['catalog-test', 'crud-test', 'operations-test'];
        const destination = destinations[Math.floor(Math.random() * destinations.length)];
        
        const formData = createFileFormData(testFile, env.namespace, destination, true, {
          information: `Catalog test file - ${__VU}-${__ITER}`,
          expiration_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
        
        const startTime = Date.now();
        const response = makeRequest(
          'POST', 
          `${env.apiUrl}/file`, 
          formData, 
          { headers: makeMultipartHeaders() }
        );
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, 200, 'Catalog Setup Upload');
        recordFileUpload(duration, success);
        
        if (success && response.body) {
          try {
            const responseData = JSON.parse(response.body as string);
            if (responseData.data && responseData.data.length > 0) {
              catalogFilePool.push({
                uuid: responseData.data[0].uuid,
                publicUrl: responseData.data[0].public_url,
                namespace: env.namespace,
                destination: destination
              });
              console.log(`Created test file: ${responseData.data[0].uuid}`);
            }
          } catch (e) {
            console.error('Failed to parse catalog setup response:', e);
          }
        }
      }
    });
    
    group('2. Catalog List Operations', () => {
      const startTime = Date.now();
      const response = makeRequest('GET', `${env.apiUrl}/catalog`);
      const duration = Date.now() - startTime;
      
      const success = checkResponse(response, 200, 'Catalog List');
      recordCatalogOperation(duration, success);
      
      if (success) {
        try {
          const catalog = JSON.parse(response.body as string);
          console.log(`Catalog contains ${Array.isArray(catalog) ? catalog.length : 'unknown'} items`);
          customMetrics.queueSize.add(Array.isArray(catalog) ? catalog.length : 0);
        } catch (e) {
          console.error('Failed to parse catalog list response:', e);
        }
      }
    });
    
    if (catalogFilePool.length > 0) {
      group('3. Individual Catalog Item Retrieval', () => {
        const file = catalogFilePool[Math.floor(Math.random() * catalogFilePool.length)];
        
        const startTime = Date.now();
        const response = makeRequest('GET', `${env.apiUrl}/catalog/${file.uuid}`);
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, [200, 404], 'Catalog Item Get');
        recordCatalogOperation(duration, success || response.status === 404);
        
        if (success) {
          try {
            const itemData = JSON.parse(response.body as string);
            console.log(`Retrieved catalog item: ${file.uuid} - Status: ${itemData.expired ? 'expired' : 'active'}`);
          } catch (e) {
            console.error('Failed to parse catalog item response:', e);
          }
        }
      });
      
      group('4. Catalog Item Update Operations', () => {
        const file = catalogFilePool[Math.floor(Math.random() * catalogFilePool.length)];
        
        const updates = [
          { expired: 'false', information: `Updated by catalog test - ${Date.now()}` },
          { expired: 'true' },
          { information: 'Catalog test information update' }
        ];
        const update = updates[Math.floor(Math.random() * updates.length)];
        
        const updatePayload = JSON.stringify({
          data: [{
            st: 'CMS',
            key_name: 'unique_name',
            key_value: file.uuid,
            changes: update
          }]
        });
        
        const startTime = Date.now();
        const response = makeRequest('PATCH', `${env.apiUrl}/catalog/${file.uuid}`, updatePayload);
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, [200, 404], 'Catalog Item Update');
        recordCatalogOperation(duration, success || response.status === 404);
        
        if (success) {
          console.log(`Updated catalog item: ${file.uuid} with changes:`, update);
        }
      });
      
      if (Math.random() < 0.1 && catalogFilePool.length > 10) {
        group('5. Catalog Item Deletion', () => {
          const fileIndex = Math.floor(Math.random() * catalogFilePool.length);
          const file = catalogFilePool[fileIndex];
          
          const startTime = Date.now();
          const response = makeRequest('DELETE', `${env.apiUrl}/catalog/${file.uuid}`, null);
          const duration = Date.now() - startTime;
          
          const success = checkResponse(response, [200, 404], 'Catalog Item Delete');
          recordCatalogOperation(duration, success || response.status === 404);
          
          if (success) {
            catalogFilePool.splice(fileIndex, 1);
            console.log(`Deleted catalog item: ${file.uuid}`);
          }
        });
      }
    }
    
    if (Math.random() < 0.05) {
      group('6. Catalog Dump Operations', () => {
        console.log('Testing catalog dump creation...');
        
        const startTime = Date.now();
        const response = makeRequest('POST', `${env.apiUrl}/catalog/create-dump`, null);
        const duration = Date.now() - startTime;
        
        const success = checkResponse(response, [200, 201], 'Catalog Dump Create');
        recordCatalogOperation(duration, success);
        
        if (success) {
          console.log('Catalog dump creation successful');
          
          sleep(2);
          
          const getDumpStart = Date.now();
          const getDumpResponse = makeRequest('GET', `${env.apiUrl}/catalog/get-dump`);
          const getDumpDuration = Date.now() - getDumpStart;
          
          const getDumpSuccess = checkResponse(getDumpResponse, 200, 'Catalog Dump Get');
          recordCatalogOperation(getDumpDuration, getDumpSuccess);
          
          if (getDumpSuccess) {
            console.log('Catalog dump retrieval successful');
          }
        }
      });
    }
    
    sleep(Math.random() * 2 + 1);
  });
}

export function catalogHeavyReadTest() {
  group('Catalog Test - Heavy Read Operations', () => {
    const operations = ['list', 'item', 'dump_get'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    switch (operation) {
      case 'list':
        const listStart = Date.now();
        const listResponse = makeRequest('GET', `${env.apiUrl}/catalog`);
        const listDuration = Date.now() - listStart;
        
        recordCatalogOperation(listDuration, checkResponse(listResponse, 200, 'Heavy Read List'));
        break;
        
      case 'item':
        if (catalogFilePool.length > 0) {
          const file = catalogFilePool[Math.floor(Math.random() * catalogFilePool.length)];
          const itemStart = Date.now();
          const itemResponse = makeRequest('GET', `${env.apiUrl}/catalog/${file.uuid}`);
          const itemDuration = Date.now() - itemStart;
          
          recordCatalogOperation(itemDuration, checkResponse(itemResponse, [200, 404], 'Heavy Read Item'));
        }
        break;
        
      case 'dump_get':
        const dumpStart = Date.now();
        const dumpResponse = makeRequest('GET', `${env.apiUrl}/catalog/get-dump`);
        const dumpDuration = Date.now() - dumpStart;
        
        recordCatalogOperation(dumpDuration, checkResponse(dumpResponse, 200, 'Heavy Read Dump'));
        break;
    }
    
    sleep(Math.random() * 0.3);
  });
}

export default function() {
  catalogOperationsTest();
}