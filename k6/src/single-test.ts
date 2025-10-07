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

// Fonction helper pour afficher les erreurs
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
    console.log('🧪 Tests Single TADA API');
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

        group('3. Authentification - Route protégée sans token', () => {
            console.log('🔐 Test authentification sans token');
            const noTokenResponse = http.post(`${ENV.apiUrl}/file`, { namespace: ENV.namespace, destination: 'test' }, { timeout: '10s' });

            check(noTokenResponse, {
                'no token returns 401': (r) => r.status === 401
            });

            console.log(`   Status: ${noTokenResponse.status}`);
            if (noTokenResponse.status !== 401) {
                logErrorResponse(noTokenResponse, 'No Token Auth');
            }
        });

        group('4. Authentification - Route protégée avec token mais sans fichier', () => {
            console.log('🔐 Test authentification avec token, sans fichier');
            const noFileResponse = http.post(
                `${ENV.apiUrl}/file`,
                { namespace: ENV.namespace, destination: 'test' },
                {
                    headers: { Authorization: `Bearer ${ENV.bearerToken}` },
                    timeout: '10s'
                }
            );

            check(noFileResponse, {
                'no file returns 400': (r) => r.status === 400,
                'no file has content-type error': (r) => {
                    try {
                        const data = JSON.parse(r.body as string);
                        return data.errors && data.errors.some((err: string) => err.includes('content-type') || err.includes('invalid'));
                    } catch {
                        return false;
                    }
                }
            });

            console.log(`   Status: ${noFileResponse.status}`);
            if (noFileResponse.status !== 400) {
                logErrorResponse(noFileResponse, 'No File Auth');
            }
        });
    });

    group('Routes file.routes.ts (Single File)', () => {
        group('5. POST /file - Upload fichier', () => {
            console.log('📤 Test upload fichier single');
            const uploadResponse = http.post(
                `${ENV.apiUrl}/file`,
                {
                    file: http.file(file, 'test-single.webp', 'image/webp'),
                    namespace: ENV.namespace,
                    destination: 'k6-test-single',
                    information: 'Test K6 single file'
                },
                {
                    headers: { Authorization: `Bearer ${ENV.bearerToken}` },
                    timeout: '30s'
                }
            );

            check(uploadResponse, {
                'single upload status is 200': (r) => r.status === 200,
                'single upload has JSON response': (r) => {
                    try {
                        JSON.parse(r.body as string);
                        return true;
                    } catch {
                        return false;
                    }
                },
                'single upload has data and errors keys': (r) => {
                    try {
                        const data = JSON.parse(r.body as string);
                        return data.hasOwnProperty('data') && data.hasOwnProperty('errors');
                    } catch {
                        return false;
                    }
                },
                'single upload has content in data[0]': (r) => {
                    try {
                        const data = JSON.parse(r.body as string);
                        return data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].uuid;
                    } catch {
                        return false;
                    }
                }
            });

            console.log(`   Status: ${uploadResponse.status}`);

            if (uploadResponse.status === 200) {
                try {
                    const responseData = JSON.parse(uploadResponse.body as string);
                    fileUuid = responseData.data[0].uuid;
                    console.log(`   ✅ Fichier uploadé - UUID: ${fileUuid}`);
                } catch (e) {
                    console.log('   ❌ Erreur parsing réponse upload');
                }
            } else {
                logErrorResponse(uploadResponse, 'Single Upload');
            }
        });

        group('6. PATCH /file/:uuid - Mise à jour fichier', () => {
            if (!fileUuid) {
                console.log("   ⚠️ Pas d'UUID disponible pour le test PATCH");
                return;
            }

            console.log(`📝 Test mise à jour fichier single: ${fileUuid}`);
            const patchResponse = http.patch(
                `${ENV.apiUrl}/file/${fileUuid}`,
                {
                    file: http.file(file, 'test-single-updated.webp', 'image/webp'),
                    namespace: ENV.namespace,
                    information: 'Test K6 single file updated'
                },
                {
                    headers: { Authorization: `Bearer ${ENV.bearerToken}` },
                    timeout: '30s'
                }
            );

            check(patchResponse, {
                'single patch status is 200': (r) => r.status === 200,
                'single patch has JSON response': (r) => {
                    try {
                        JSON.parse(r.body as string);
                        return true;
                    } catch {
                        return false;
                    }
                },
                'single patch has data and errors keys': (r) => {
                    try {
                        const data = JSON.parse(r.body as string);
                        return data.hasOwnProperty('data') && data.hasOwnProperty('errors');
                    } catch {
                        return false;
                    }
                },
                'single patch has content in data[0]': (r) => {
                    try {
                        const data = JSON.parse(r.body as string);
                        return data.data && Array.isArray(data.data) && data.data.length > 0;
                    } catch {
                        return false;
                    }
                }
            });

            console.log(`   Status: ${patchResponse.status}`);
            if (patchResponse.status !== 200) {
                logErrorResponse(patchResponse, 'Single Patch');
            }
        });

        group('7. DELETE /file/:uuid - Suppression fichier', () => {
            if (!fileUuid) {
                console.log("   ⚠️ Pas d'UUID disponible pour le test DELETE");
                return;
            }

            console.log(`🗑️ Test suppression fichier single: ${fileUuid}`);
            const deleteResponse = http.del(`${ENV.apiUrl}/file/${fileUuid}`, JSON.stringify({ namespace: ENV.namespace }), {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${ENV.bearerToken}`
                },
                timeout: '10s'
            });

            check(deleteResponse, {
                'single delete status is 200': (r) => r.status === 200,
                'single delete has JSON response': (r) => {
                    try {
                        JSON.parse(r.body as string);
                        return true;
                    } catch {
                        return false;
                    }
                }
            });

            console.log(`   Status: ${deleteResponse.status}`);
            if (deleteResponse.status !== 200) {
                logErrorResponse(deleteResponse, 'Single Delete');
            }
        });
    });

    console.log('');
    console.log('🏁 Tests single terminés');
}
