import http from 'k6/http';
import { Rate } from 'k6/metrics';
import { Options } from 'k6/options';

const errorRate = new Rate('error_rate');
let fileUUID = '';

export const options: Options = {
    scenarios: {
        scenario_API_getFile: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 15,
            exec: 'getFile',
            startTime: '0s',
            env: {
                REQUEST: '/DEV/testsd/vegecalv.webp',
                URL_PUBLIC: 'http://localhost:8080/palpatine/assets/media/full/DEV/testsd/vegecalv.webp',
                URL_API: 'http://localhost:3001/file',
                BEARER_TOKEN: 'cooltokenyeah'
            },
            tags: { name: 'Rate Limit Test' }
        },
        scenario_API_postFile: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 15,
            exec: 'postFile',
            startTime: '0s',
            env: {
                REQUEST: '/DEV/testsd/vegecalv.webp',
                URL_PUBLIC: 'http://localhost:8080/palpatine/assets/media/full/DEV/testsd/vegecalv.webp',
                URL_API: 'http://localhost:3001/file',
                BEARER_TOKEN: 'cooltokenyeah'
            },
            tags: { name: 'Rate Limit Test' }
        },
        scenario_API_updateFile: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 15,
            exec: 'updateFile',
            startTime: '0s',
            env: {
                REQUEST: '/DEV/testsd/vegecalv.webp',
                URL_PUBLIC: 'http://localhost:8080/palpatine/assets/media/full/DEV/testsd/vegecalv.webp',
                URL_API: 'http://localhost:3001/file',
                BEARER_TOKEN: 'cooltokenyeah'
            },
            tags: { name: 'Rate Limit Test' }
        },
        scenario_API_deleteFile: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 15,
            exec: 'deleteFile',
            startTime: '0s',
            env: {
                REQUEST: '/DEV/testsd/vegecalv.webp',
                URL_PUBLIC: 'http://localhost:8080/palpatine/assets/media/full/DEV/testsd/vegecalv.webp',
                URL_API: 'http://localhost:3001/file',
                BEARER_TOKEN: 'cooltokenyeah'
            },
            tags: { name: 'Rate Limit Test' }
        }
    },
    thresholds: {
        'http_req_duration{type:get_rate_limit}': [{ threshold: 'p(95) < 500' }]
    }
};

export function getAll(): void {
    const params = {
        headers: { 'Authorization': `Bearer ${__ENV.BEARER_TOKEN}`, 'Content-Type': 'application/json' }
    };
    const res = http.get('http://localhost:3001/catalog', params);
    console.log('Get Catalog Response: ', res.body);
    errorRate.add(res.status >= 400);
}

export function getFile(): void {
    const params = {
        headers: { 'Authorization': `Bearer ${__ENV.BEARER_TOKEN}`, 'Content-Type': 'application/json' },
        insecureSkipTLSVerify: true
    };
    const res = http.get(`${__ENV.URL_PUBLIC}`, params);
    if (res.status === 429) {
        console.log(`URL : ${__ENV.REQUEST} is banned after 10 requests (per minute): ${res.status}`);
    }
    console.log('Response: ', res.body);
}

export function updateFile(): void {
    if (!fileUUID) {
        console.log('Invalid UUID: Update operation skipped.');
        return;
    }

    const payload = JSON.stringify({
        data: [{ st: 'CMS', key_name: 'unique_name', key_value: `${__ENV.REQUEST}`, changes: { expired: 'true' } }]
    });
    const url = `${__ENV.URL_API}/${fileUUID}`;
    const params = { headers: { 'Authorization': `Bearer ${__ENV.BEARER_TOKEN}`, 'Content-Type': 'application/json' } };
    const res = http.patch(url, payload, params);
    console.log('Update File Response: ', res.body);
}

export function deleteFile(): void {
    if (!fileUUID) {
        console.log('Invalid UUID: Delete operation skipped.');
        return;
    }

    const url = `${__ENV.URL_API}/${fileUUID}`;
    const params = { headers: { 'Authorization': `Bearer ${__ENV.BEARER_TOKEN}`, 'Content-Type': 'application/json' } };
    const res = http.del(url, null, params);
    console.log('Delete File Response: ', res.body);
}

export function postFile(): void {
    const payload = JSON.stringify({
        name: 'example_file',
        type: 'text/plain',
        content: 'This is a test file content'
    });
    const params = { headers: { 'Authorization': `Bearer ${__ENV.BEARER_TOKEN}`, 'Content-Type': 'application/json' } };
    const url = `${__ENV.URL_API}`;
    const res = http.post(url, payload, params);
    console.log('Post File Response: ', res.body);

    const jsonResponse = JSON.parse(typeof res.body === 'string' ? res.body : '');
    if (jsonResponse.data && jsonResponse.data.length > 0) {
        fileUUID = jsonResponse.data[0].uuid;
        console.log(`File UUID: ${fileUUID}`);
    } else {
        console.log('Failed to retrieve UUID.');
    }
}
