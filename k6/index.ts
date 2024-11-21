import http from 'k6/http';
import { Rate } from 'k6/metrics';
import { Options } from 'k6/options';

const errorRate = new Rate('error_rate');

export const options: Options = {
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

export function getAll(): void {
    const res = http.get('http://localhost:3001/all');
    errorRate.add(res.status >= 400);
}

export function getFile(): void {
    const params = {
        headers: { 'Content-Type': 'application/json' },
        insecureSkipTLSVerify: true
    };
    const res = http.get(`${__ENV.URL_PUBLIC}`, params);
    if (res.status === 429) {
        console.log(`URL : ${__ENV.REQUEST} is banned after 10 requests (per minute): ${res.status}`);
    }
}

export function updateFile(): void {
    const payload = JSON.stringify({
        data: [{ st: 'CMS', key_name: 'unique_name', key_value: `${__ENV.REQUEST}`, changes: { expired: 'true' } }]
    });
    const params = { headers: { 'Content-Type': 'application/json' } };
    http.patch(`${__ENV.URL_API}`, payload, params);
}

export function deleteFile(): void {
    const payload = JSON.stringify({
        data: [{ st: 'CMS', key_name: 'unique_name', key_value: `${__ENV.REQUEST}` }]
    });
    const params = { headers: { 'Content-Type': 'application/json' } };
    http.del(`${__ENV.URL_API}`, payload, params);
}

export function postFile(): void {
}
