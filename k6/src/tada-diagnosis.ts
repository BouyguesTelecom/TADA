import http from 'k6/http';
import { check } from 'k6';
import { Options } from 'k6/options';

interface DiagnosticEnvironment {
    apiUrl: string;
    bearerToken: string;
    namespace: string;
}

const ENV: DiagnosticEnvironment = {
    apiUrl: __ENV.API_URL || 'http://localhost:3001',
    bearerToken: __ENV.BEARER_TOKEN || 'token',
    namespace: __ENV.NAMESPACE || 'DEV'
};

export const options: Options = {
    vus: 1,
    iterations: 1
};

const file = open('../../local/images/default.webp', 'b');

export default function (): void {
    console.log('🔍 Diagnostic TADA API');
    console.log(`API: ${ENV.apiUrl}`);
    console.log(`Token: ${ENV.bearerToken}`);
    console.log('');

    console.log('🌐 Test 1: Connectivité serveur');
    try {
        const healthResponse = http.get(ENV.apiUrl + '/readiness-check', { timeout: '5s' });
        console.log(`   Status: ${healthResponse.status}`);
        console.log(`   Headers: ${JSON.stringify(healthResponse.headers)}`);

        if (healthResponse.body) {
            const bodyPreview = typeof healthResponse.body === 'string' ? healthResponse.body.substring(0, 200) : String(healthResponse.body).substring(0, 200);
            console.log(`   Body preview: ${bodyPreview}`);
        }
        check(healthResponse, {
            'readiness-check responds': (r) => r.status !== 0,
            'readiness-check not timeout': (r) => r.status !== undefined
        });

    } catch (e) {
        console.log(`   ❌ Erreur de connexion: ${e}`);
    }
    console.log('');

    console.log('📋 Test 2: Endpoint catalog');
    const catalogResponse = http.get(`${ENV.apiUrl}/catalog`, { timeout: '10s' });
    console.log(`   GET /catalog - Status: ${catalogResponse.status}`);

    check(catalogResponse, {
        'catalog status is 200': (r) => r.status === 200,
        'catalog response is JSON array': (r) => {
            if (r.status !== 200) return false;
            try {
                const data = JSON.parse(r.body as string);
                return Array.isArray(data);
            } catch {
                return false;
            }
        },
        'catalog no timeout': (r) => r.status !== undefined
    });

    if (catalogResponse.status === 500) {
        console.log('   ❌ Erreur 500 - Problème serveur interne');
        console.log(`   Error body: ${catalogResponse.body}`);
        const catalogWithHeaders = http.get(`${ENV.apiUrl}/catalog`, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'k6-load-test'
            },
            timeout: '10s'
        });
        console.log(`   GET /catalog (avec headers) - Status: ${catalogWithHeaders.status}`);
    } else if (catalogResponse.status === 200) {
        console.log('   ✅ Catalog accessible');
        try {
            const catalog = JSON.parse(catalogResponse.body as string);
            console.log(`   Items: ${Array.isArray(catalog) ? catalog.length : 'unknown'}`);
        } catch (e) {
            console.log(`   ⚠️  Réponse non-JSON`);
        }
    }
    console.log('');

    console.log('📤 Test 3: Upload sans fichier & 🔐 Authentification');

    const emptyUpload = http.post(
        `${ENV.apiUrl}/file`,
        {
            namespace: ENV.namespace,
            destination: 'test'
        },
        {
            headers: {
                Authorization: `Bearer ${ENV.bearerToken}`
            },
            timeout: '10s'
        }
    );
    console.log(`   POST /file (sans fichier) - Status: ${emptyUpload.status}`);
    console.log(`   Response: ${emptyUpload.body?.toString().substring(0, 200)}`);

    check(emptyUpload, {
        'empty upload fails with 400': (r) => r.status === 400,
        'empty upload has error message': (r) => {
            try {
                const data = JSON.parse(r.body as string);
                return data.errors && Array.isArray(data.errors) && data.errors.length > 0;
            } catch {
                return false;
            }
        }
    });

    const fileUpload = http.post(
        `${ENV.apiUrl}/file`,
        {
            file: http.file(file, 'default.webp', 'image/webp'),
            namespace: ENV.namespace,
            destination: 'diagnosis'
        },
        {
            headers: {
                Authorization: `Bearer ${ENV.bearerToken}`
            },
            timeout: '10s'
        }
    );

    const responseBody = JSON.parse(fileUpload.body as string);
    console.log(typeof fileUpload.body, responseBody);
    console.log(`   POST /file (avec fichier) - Status: ${fileUpload.status}`);
    console.log(`   Response: ${fileUpload.body?.toString().substring(0, 200)}`);

    check(fileUpload, {
        'first upload status is 200': (r) => r.status === 200,
        'first upload has JSON response': (r) => {
            try {
                JSON.parse(r.body as string);
                return true;
            } catch {
                return false;
            }
        },
        'first upload has data and errors keys': (r) => {
            try {
                const data = JSON.parse(r.body as string);
                return data.hasOwnProperty('data') && data.hasOwnProperty('errors');
            } catch {
                return false;
            }
        },
        'first upload has content in data': (r) => {
            try {
                const data = JSON.parse(r.body as string);
                return Array.isArray(data.data) && data.data.length > 0;
            } catch {
                return false;
            }
        },
        'first upload errors array is empty': (r) => {
            try {
                const data = JSON.parse(r.body as string);
                return Array.isArray(data.errors) && data.errors.length === 0;
            } catch {
                return false;
            }
        },
        'first upload has required fields': (r) => {
            try {
                const data = JSON.parse(r.body as string);
                if (!data.data || data.data.length === 0) return false;
                const fileInfo = data.data[0];
                return fileInfo.uuid && fileInfo.public_url && fileInfo.filename;
            } catch {
                return false;
            }
        }
    });

    console.log('');
    const uuidFile = responseBody?.data && responseBody?.data[0]?.uuid;

    const fileUploadBis = http.post(
        `${ENV.apiUrl}/file`,
        {
            file: http.file(file, 'default.webp', 'image/webp'),
            namespace: ENV.namespace,
            destination: 'diagnosis'
        },
        {
            headers: {
                Authorization: `Bearer ${ENV.bearerToken}`
            },
            timeout: '10s'
        }
    );
    console.log(`   POST /file (avec fichier existant) - Status: ${fileUploadBis.status}`);
    console.log(`   Response: ${fileUploadBis.body?.toString().substring(0, 200)}`);

    check(fileUploadBis, {
        'duplicate upload status is 400': (r) => r.status === 400,
        'duplicate upload has JSON response': (r) => {
            try {
                JSON.parse(r.body as string);
                return true;
            } catch {
                return false;
            }
        },
        'duplicate upload has data and errors keys': (r) => {
            try {
                const data = JSON.parse(r.body as string);
                return data.hasOwnProperty('data') && data.hasOwnProperty('errors');
            } catch {
                return false;
            }
        },
        'duplicate upload errors array is not empty': (r) => {
            try {
                const data = JSON.parse(r.body as string);
                return Array.isArray(data.errors) && data.errors.length > 0;
            } catch {
                return false;
            }
        },
        'duplicate upload data array is empty': (r) => {
            try {
                const data = JSON.parse(r.body as string);
                return Array.isArray(data.data) && data.data.length === 0;
            } catch {
                return false;
            }
        }
    });

    console.log('');

    const deleteFile = http.del(
        `${ENV.apiUrl}/file/${uuidFile}`,
        JSON.stringify({
            namespace: ENV.namespace
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${ENV.bearerToken}`
            },
            timeout: '10s'
        }
    );
    console.log(`   DELETE /file (${uuidFile}) - Status: ${deleteFile.status}`);
    console.log(`   Response: ${deleteFile.body?.toString().substring(0, 200)}`);

    check(deleteFile, {
        'delete status is 200': (r) => r.status === 200,
        'delete has JSON response': (r) => {
            try {
                JSON.parse(r.body as string);
                return true;
            } catch {
                return false;
            }
        },
        'delete confirms removal': (r) => {
            try {
                const data = JSON.parse(r.body as string);
                return data.data && Array.isArray(data.data);
            } catch {
                return false;
            }
        }
    });

    console.log('');
    console.log('🏁 Diagnostic terminé');

    check(catalogResponse, {
        'diagnostic completed successfully': (r) => r.status !== undefined
    });
}
