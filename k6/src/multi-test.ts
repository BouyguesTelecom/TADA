import http from 'k6/http';
import { check, group } from 'k6';
import { Options } from 'k6/options';

interface TestEnvironment {
    apiUrl: string;
    bearerToken: string;
    namespace: string;
}

const ENV: TestEnvironment = {
    apiUrl: __ENV.API_URL || 'http://localhost:3001',
    bearerToken: __ENV.BEARER_TOKEN || 'token',
    namespace: __ENV.NAMESPACE || 'DEV'
};

export const options: Options = {
    vus: 1,
    iterations: 1
};

const file = open('../../local/images/default.webp', 'b');

function logErrorResponse(response: any, testName: string): void {
    if (response.status >= 400) {
        console.log(`❌ ${testName} - Status: ${response.status}`);
        try {
            const errorData = JSON.parse(response.body as string);
            console.log(`   Error Response: ${JSON.stringify(errorData, null, 2)}`);
        } catch (e) {
            console.log(`   Raw Response: ${response.body?.toString()}`);
        }
    }
}

export default function (): void {
    console.log('🧪 Tests Multi TADA API');
    console.log(`API: ${ENV.apiUrl}`);
    console.log(`Token: ${ENV.bearerToken}`);
    console.log('');

    let fileUuid: string = '';

    group('Routes Classiques', () => {
        group('1. Readiness Check', () => {
            console.log('🌐 Test readiness-check');
            const readinessResponse = http.get(`${ENV.apiUrl}/readiness-check`, { timeout: '5s' });

            check(readinessResponse, {
                'readiness-check status OK': (r) => r.status === 200 || r.status === 204,
                'readiness-check responds': (r) => r.status !== 0,
                'readiness-check no timeout': (r) => r.status !== undefined
            });

            console.log(`   Status: ${readinessResponse.status}`);
            logErrorResponse(readinessResponse, 'Readiness Check');
        });

        group('2. Catalog Public', () => {
            console.log('📋 Test catalog public');
            const catalogResponse = http.get(`${ENV.apiUrl}/catalog`, { timeout: '10s' });

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
                }
            });

            console.log(`   Status: ${catalogResponse.status}`);
            if (catalogResponse.status === 200) {
                try {
                    const catalog = JSON.parse(catalogResponse.body as string);
                    console.log(`   Items: ${catalog.length}`);
                } catch (e) {
                    console.log('   ⚠️ Réponse non-JSON');
                }
            }
            logErrorResponse(catalogResponse, 'Catalog');
        });
    });

    group('Routes files.routes.ts (Multi Files)', () => {
        let multiFileUuids: string[] = [];

        group('8. POST /files - Upload multiple fichiers', () => {
            console.log('📤 Test upload fichiers multiples');

            const multiUploadResponse = http.post(
                `${ENV.apiUrl}/files`,
                {
                    files: http.file(file, 'test-multi-1.webp', 'image/webp'),
                    namespace: ENV.namespace,
                    destination: 'k6-test-multi',
                    information: 'Test K6 multi files'
                },
                {
                    headers: { Authorization: `Bearer ${ENV.bearerToken}` },
                    timeout: '60s'
                }
            );

            check(multiUploadResponse, {
                'multi upload status is 200': (r) => r.status === 200,
                'multi upload has JSON response': (r) => {
                    try {
                        JSON.parse(r.body as string);
                        return true;
                    } catch {
                        return false;
                    }
                },
                'multi upload has data and errors keys': (r) => {
                    try {
                        const data = JSON.parse(r.body as string);
                        return data.hasOwnProperty('data') && data.hasOwnProperty('errors');
                    } catch {
                        return false;
                    }
                },
                'multi upload has multiple items in data': (r) => {
                    try {
                        const data = JSON.parse(r.body as string);
                        return data.data && Array.isArray(data.data) && data.data.length > 0;
                    } catch {
                        return false;
                    }
                }
            });

            console.log(`   Status: ${multiUploadResponse.status}`);

            if (multiUploadResponse.status === 200) {
                try {
                    const responseData = JSON.parse(multiUploadResponse.body as string);
                    multiFileUuids = responseData.data.map((item: any) => item.uuid);
                    console.log(`   ✅ Fichiers uploadés - UUIDs: ${multiFileUuids.join(', ')}`);
                } catch (e) {
                    console.log('   ❌ Erreur parsing réponse upload multi');
                }
            } else {
                logErrorResponse(multiUploadResponse, 'Multi Upload');
            }
        });

        group('9. PATCH /files - Mise à jour multiple fichiers', () => {
            if (multiFileUuids.length === 0) {
                console.log("   ⚠️ Pas d'UUIDs disponibles pour le test PATCH multi");
                return;
            }

            console.log(`📝 Test mise à jour fichiers multiples: ${multiFileUuids.join(', ')}`);

            const multiPatchResponse = http.patch(
                `${ENV.apiUrl}/files`,
                {
                    namespace: ENV.namespace,
                    uuids: multiFileUuids.join(', '),
                    information: 'Test K6 multi files patch',
                    files: http.file(file, 'test-multi-1-updated.webp', 'image/webp')
                },
                {
                    headers: { Authorization: `Bearer ${ENV.bearerToken}` },
                    timeout: '60s'
                }
            );

            check(multiPatchResponse, {
                'multi patch status is 200': (r) => r.status === 200,
                'multi patch has JSON response': (r) => {
                    try {
                        JSON.parse(r.body as string);
                        return true;
                    } catch {
                        return false;
                    }
                },
                'multi patch has data and errors keys': (r) => {
                    try {
                        const data = JSON.parse(r.body as string);
                        return data.hasOwnProperty('data') && data.hasOwnProperty('errors');
                    } catch {
                        return false;
                    }
                }
            });

            console.log(`   Status: ${multiPatchResponse.status}`);
            if (multiPatchResponse.status !== 200) {
                logErrorResponse(multiPatchResponse, 'Multi Patch');
                console.log(`   📋 Payload envoyé:`);
                console.log(`      - UUIDs: ${multiFileUuids.join(', ')}`);
                console.log(`      - Namespace: ${ENV.namespace}`);
                console.log(`      - Files: files[0], files[1]`);
            }
        });

        group('10. DELETE /files - Suppression multiple fichiers', () => {
            if (multiFileUuids.length === 0) {
                console.log("   ⚠️ Pas d'UUIDs disponibles pour le test DELETE multi");
                return;
            }

            console.log(`🗑️ Test suppression fichiers multiples: ${multiFileUuids.join(', ')}`);

            const deletePayload = [{
                uuids: multiFileUuids.join(','),
                namespace: ENV.namespace
            }];

            const multiDeleteResponse = http.del(`${ENV.apiUrl}/files`, JSON.stringify(deletePayload), {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${ENV.bearerToken}`
                },
                timeout: '30s'
            });

            check(multiDeleteResponse, {
                'multi delete status is 200': (r) => r.status === 200,
                'multi delete has JSON response': (r) => {
                    try {
                        JSON.parse(r.body as string);
                        return true;
                    } catch {
                        return false;
                    }
                }
            });

            console.log(`   Status: ${multiDeleteResponse.status}`);
            if (multiDeleteResponse.status !== 200) {
                logErrorResponse(multiDeleteResponse, 'Multi Delete');
                console.log(`   📋 Payload envoyé: ${JSON.stringify(deletePayload, null, 2)}`);
            }
        });
    });

    console.log('');
    console.log('🏁 Tests multi terminés');
}
