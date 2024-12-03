"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = void 0;
exports.getAll = getAll;
exports.getFile = getFile;
exports.updateFile = updateFile;
exports.deleteFile = deleteFile;
exports.postFile = postFile;
var http_1 = __importDefault(require("k6/http"));
var metrics_1 = require("k6/metrics");
var errorRate = new metrics_1.Rate('error_rate');
var fileUUID = '';
exports.options = {
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
function getAll() {
    var params = {
        headers: { 'Authorization': "Bearer ".concat(__ENV.BEARER_TOKEN), 'Content-Type': 'application/json' }
    };
    var res = http_1.default.get('http://localhost:3001/catalog', params);
    console.log('Get Catalog Response: ', res.body);
    errorRate.add(res.status >= 400);
}
function getFile() {
    var params = {
        headers: { 'Authorization': "Bearer ".concat(__ENV.BEARER_TOKEN), 'Content-Type': 'application/json' },
        insecureSkipTLSVerify: true
    };
    var res = http_1.default.get("".concat(__ENV.URL_PUBLIC), params);
    if (res.status === 429) {
        console.log("URL : ".concat(__ENV.REQUEST, " is banned after 10 requests (per minute): ").concat(res.status));
    }
    console.log('Response: ', res.body);
}
function updateFile() {
    if (!fileUUID) {
        console.log('Invalid UUID: Update operation skipped.');
        return;
    }
    var payload = JSON.stringify({
        data: [{ st: 'CMS', key_name: 'unique_name', key_value: "".concat(__ENV.REQUEST), changes: { expired: 'true' } }]
    });
    var url = "".concat(__ENV.URL_API, "/").concat(fileUUID);
    var params = { headers: { 'Authorization': "Bearer ".concat(__ENV.BEARER_TOKEN), 'Content-Type': 'application/json' } };
    var res = http_1.default.patch(url, payload, params);
    console.log('Update File Response: ', res.body);
}
function deleteFile() {
    if (!fileUUID) {
        console.log('Invalid UUID: Delete operation skipped.');
        return;
    }
    var url = "".concat(__ENV.URL_API, "/").concat(fileUUID);
    var params = { headers: { 'Authorization': "Bearer ".concat(__ENV.BEARER_TOKEN), 'Content-Type': 'application/json' } };
    var res = http_1.default.del(url, null, params);
    console.log('Delete File Response: ', res.body);
}
function postFile() {
    var payload = JSON.stringify({
        name: 'example_file',
        type: 'text/plain',
        content: 'This is a test file content'
    });
    var params = { headers: { 'Authorization': "Bearer ".concat(__ENV.BEARER_TOKEN), 'Content-Type': 'application/json' } };
    var url = "".concat(__ENV.URL_API);
    var res = http_1.default.post(url, payload, params);
    console.log('Post File Response: ', res.body);
    var jsonResponse = JSON.parse(typeof res.body === 'string' ? res.body : '');
    if (jsonResponse.data && jsonResponse.data.length > 0) {
        fileUUID = jsonResponse.data[0].uuid;
        console.log("File UUID: ".concat(fileUUID));
    }
    else {
        console.log('Failed to retrieve UUID.');
    }
}
