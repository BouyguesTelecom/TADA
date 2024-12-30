'use strict';
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.options = void 0;
exports.postFile = postFile;
exports.getFile = getFile;
exports.updateFile = updateFile;
exports.deleteFile = deleteFile;
var http_1 = __importDefault(require('k6/http'));
var metrics_1 = require('k6/metrics');
var k6_1 = require('k6');
var errorRate = new metrics_1.Rate('error_rate');
var fileUUID = 'cec5e1dc-7083-43f3-b2e5-ea5ad61ca799';
var filePublicURL = '';
var fileData = open('../../src/api/images/vegecalv.png', 'b');
exports.options = {
    scenarios: {
        scenario_API_postFile: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 1,
            exec: 'postFile',
            startTime: '0s',
            env: {
                REQUEST: '/DEV/testsd/vegecalv.webp',
                URL_API: 'http://localhost:3001/palpatine/file',
                BEARER_TOKEN: 'cooltokenyeah'
            },
            tags: { name: 'Rate Limit Test' }
        },
        scenario_API_getFile: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 15,
            exec: 'getFile',
            startTime: '3s',
            env: {
                URL_PUBLIC: 'http://localhost:8080/palpatine/assets/media/full/DEV/vegecalv.webp',
                BEARER_TOKEN: 'cooltokenyeah'
            },
            tags: { name: 'Rate Limit Test' }
        },
        scenario_API_updateFile: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 15,
            exec: 'updateFile',
            startTime: '10s',
            env: {
                URL_API: 'http://localhost:3001/palpatine/file/<uuid>',
                BEARER_TOKEN: 'cooltokenyeah'
            },
            tags: { name: 'Rate Limit Test' }
        },
        scenario_API_deleteFile: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 15,
            exec: 'deleteFile',
            startTime: '20s',
            env: {
                URL_API: 'http://localhost:3001/palpatine/file/<uuid>',
                BEARER_TOKEN: 'cooltokenyeah'
            },
            tags: { name: 'Rate Limit Test' }
        }
    },
    thresholds: {
        error_rate: ['rate<0.05'],
        'http_req_duration{type:get_rate_limit}': ['p(95)<500']
    }
};
function postFile() {
    (0, k6_1.group)('Post File', function () {
        var payload = {
            file: http_1.default.file(fileData, 'vegecalv.webp', 'image/webp'),
            namespace: 'DEV',
            destination: 'testsd',
            toWebp: 'true',
            expiration_date: '2023-12-31',
            information: 'Test file upload'
        };
        var params = { headers: { Authorization: 'Bearer '.concat(__ENV.BEARER_TOKEN) } };
        var url = ''.concat(__ENV.URL_API);
        var res = http_1.default.post(url, payload, params);
        console.log('Post File Response:', res.body);
        var jsonResponse = JSON.parse(typeof res.body === 'string' ? res.body : '');
        if (jsonResponse && jsonResponse.data && jsonResponse.data.length > 0) {
            fileUUID = jsonResponse.data[0].uuid;
            filePublicURL = jsonResponse.data[0].public_url;
            console.log('File UUID: '.concat(fileUUID));
            console.log('File Public URL: '.concat(filePublicURL));
        } else {
            console.log('Failed to retrieve UUID.');
        }
        (0, k6_1.check)(res, {
            'status is 200': function (r) {
                return r.status === 200;
            }
        });
        errorRate.add(res.status >= 400);
    });
}
function getFile() {
    var params = {
        headers: { Authorization: 'Bearer '.concat(__ENV.BEARER_TOKEN), 'Content-Type': 'application/json' },
        insecureSkipTLSVerify: true
    };
    var res = http_1.default.get(''.concat(__ENV.URL_PUBLIC), params);
    if (res.status === 429) {
        console.log('URL : '.concat(__ENV.REQUEST, ' is banned after 10 requests (per minute): ').concat(res.status));
    }
    console.log('Response: ', res.body);
}
function updateFile() {
    if (!fileUUID) {
        console.log('Invalid UUID: Update operation skipped.');
        return;
    }
    var payload = JSON.stringify({
        data: [{ st: 'CMS', key_name: 'unique_name', key_value: ''.concat(__ENV.REQUEST), changes: { expired: 'true' } }]
    });
    var url = ''.concat(__ENV.URL_API, '/').concat(fileUUID);
    var params = { headers: { Authorization: 'Bearer '.concat(__ENV.BEARER_TOKEN), 'Content-Type': 'application/json' } };
    var res = http_1.default.patch(url, payload, params);
    console.log('Update File Response: ', res.body);
}
function deleteFile() {
    if (!fileUUID) {
        console.log('Invalid UUID: Delete operation skipped.');
        return;
    }
    var url = ''.concat(__ENV.URL_API, '/').concat(fileUUID);
    var params = { headers: { Authorization: 'Bearer '.concat(__ENV.BEARER_TOKEN), 'Content-Type': 'application/json' } };
    var res = http_1.default.del(url, null, params);
    console.log('Delete File Response: ', res.body);
}
