import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 }
    ]
};

export default function() {
    // Récupérer le catalogue
    let catalogRes: any = http.get(`${ __ENV.URL_API }/catalog`);
    check(catalogRes, { 'status est 200': (r) => r.status === 200 });

    if (catalogRes.status !== 200) {
        return;
    }

    let catalog = JSON.parse(catalogRes.body);
    let uuid500ErrorCount = 0;

    // Pour chaque item du catalog tester public_url et /catalog/uuid
    for ( let item of catalog ) {
        // Tester la public_url (en bourrinant)
        for ( let i = 0; i < 5; i++ ) {
            let urlRes = http.get(item.public_url);
            check(urlRes, {
                'status est 200 ou 429': (r) => r.status === 200 || r.status === 429
            });
        }

        // Tester /catalog/uuid (en bourrinant)
        for ( let i = 0; i < 5; i++ ) {
            let uuidRes = http.get(`${ __ENV.URL_API }/catalog/${ item.uuid }`);
            check(uuidRes, {
                'status est 200 ou 429': (r) => r.status === 200 || r.status === 429,
                'status est 500 trop d error': (r) => {
                    var maxError = 10;
                    if (r.status === 500 && uuid500ErrorCount < maxError) {
                        uuid500ErrorCount++;
                    }
                    return r.status === 500 ? false : true;
                }
            });
        }
    }

    sleep(1);
}
