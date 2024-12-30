'use strict';
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.options = void 0;
exports.getAll = getAll;
exports.getFile = getFile;
exports.updateFile = updateFile;
exports.deleteFile = deleteFile;
exports.postFile = postFile;
var http_1 = __importDefault(require('k6/http'));
var metrics_1 = require('k6/metrics');
var errorRate = new metrics_1.Rate('error_rate');
exports.options = {
    scenarios: {
        scenario_API: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 15,
            exec: 'updateFile',
            startTime: '0s',
            env: {
                REQUEST: '/CMS/guide-pratique/visuel-de-mere-enfant-regardant-tablette-salon.jpg',
                URL_PUBLIC: 'https://dev.www.apps.ocp-1.pin.prd.mlb.nbyt.fr/assets/media/full/image/CMS/guide-pratique/visuel-de-mere-enfant-regardant-tablette-salon.jpg',
                URL_API: 'https://dev.media-api.www.apps.ocp-1.pin.prd.mlb.nbyt.fr'
            },
            tags: { name: 'Rate Limit Test' }
        },
        scenario_API_2: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 15,
            exec: 'updateFile',
            startTime: '0s',
            env: {
                REQUEST: '/CMS/guide-pratique/no_exist.webp',
                URL_PUBLIC: 'https://dev.www.apps.ocp-1.pin.prd.mlb.nbyt.fr/assets/media/full/image/CMS/guide-pratique/no_exist.webp',
                URL_API: 'https://dev.media-api.www.apps.ocp-1.pin.prd.mlb.nbyt.fr'
            },
            tags: { name: 'Rate Limit Test' }
        },
        scenario_API_3: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 15,
            exec: 'updateFile',
            startTime: '0s',
            env: {
                REQUEST: '/CMS/guide-pratique/comment-fonctionne-la-fibre-optique.webp',
                URL_PUBLIC: 'https://dev.www.apps.ocp-1.pin.prd.mlb.nbyt.fr/assets/media/full/image/CMS/guide-pratique/comment-fonctionne-la-fibre-optique.webp',
                URL_API: 'https://dev.media-api.www.apps.ocp-1.pin.prd.mlb.nbyt.fr'
            },
            tags: { name: 'Rate Limit Test' }
        }
    },
    thresholds: {
        'http_req_duration{type:get_rate_limit}': [{ threshold: 'p(95) < 500' }]
    }
};
function getAll() {
    var res = http_1.default.get('http://localhost:3001/all');
    errorRate.add(res.status >= 400);
}
function getFile() {
    var params = {
        headers: { 'Content-Type': 'application/json' },
        insecureSkipTLSVerify: true
    };
    var res = http_1.default.get(''.concat(__ENV.URL_PUBLIC), params);
    if (res.status === 429) {
        console.log('URL : '.concat(__ENV.REQUEST, ' is banned after 10 requests (per minute): ').concat(res.status));
    }
}
function updateFile() {
    var payload = JSON.stringify({
        data: [{ st: 'CMS', key_name: 'unique_name', key_value: ''.concat(__ENV.REQUEST), changes: { expired: 'true' } }]
    });
    var params = { headers: { 'Content-Type': 'application/json' } };
    http_1.default.patch(''.concat(__ENV.URL_API), payload, params);
}
function deleteFile() {
    var payload = JSON.stringify({
        data: [{ st: 'CMS', key_name: 'unique_name', key_value: ''.concat(__ENV.REQUEST) }]
    });
    var params = { headers: { 'Content-Type': 'application/json' } };
    http_1.default.del(''.concat(__ENV.URL_API), payload, params);
}
function postFile() {}
