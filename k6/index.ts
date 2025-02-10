import http from 'k6/http';
import { check } from 'k6';
import { Options } from 'k6/options';

interface AuthResponse {
    data: {
        access_token: string;
    };
}

interface CatalogResponse {
    data: CatalogItem[];
}

interface CatalogItem {
    id: string;
    public_url: string;
    [key: string]: any;
}

function ensureHttpProtocol(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }
    return url;
}

const MEDIA_CATALOG_URL = ensureHttpProtocol(__ENV.CATALOG_URL);
const CONTENT_EDITOR_URL = ensureHttpProtocol(__ENV.MEDIA_LIBRARY_URL);

let IMAGES: string[] = [];

async function getAuthToken() {
    console.log("🔑 Tentative d'authentification...");
    try {
        const response = http.post(
            `${CONTENT_EDITOR_URL}/auth/login`,
            JSON.stringify({
                email: __ENV.ADMIN_EMAIL,
                password: __ENV.ADMIN_PASSWORD
            }),
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status !== 200) {
            const errorMessage = `Échec de l'authentification (${response.status}): ${response.status_text}`;
            console.error('❌', errorMessage);
            throw new Error(errorMessage);
        }

        const responseData = response.json();
        const data = responseData as unknown as AuthResponse;
        console.log('✅ Authentification réussie');
        return data.data.access_token;
    } catch (error) {
        console.error("❌ Erreur d'authentification:", error instanceof Error ? error.message : String(error));
        throw error;
    }
}

async function fetchCatalog(): Promise<CatalogItem[]> {
    console.log('📚 Récupération du catalogue...');
    try {
        const token = await getAuthToken();
        const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        const response = http.get(`${MEDIA_CATALOG_URL}`, {
            headers: headers
        });

        if (response.status !== 200) {
            const errorMessage = `Échec de la récupération du catalogue (${response.status}): ${response.status_text}`;
            console.error('❌', errorMessage);
            throw new Error(errorMessage);
        }

        const responseData = response.json();
        const data = responseData as unknown as CatalogResponse;
        console.log(`✅ Catalog récupéré avec succès (${data.data.length} éléments), ${MEDIA_CATALOG_URL}`);
        return data.data;
    } catch (error) {
        console.error('❌ Erreur lors de la récupération du catalogue:', error instanceof Error ? error.message : String(error));
        throw error;
    }
}

export const options: Options = {
    scenarios: {
        load_test_images: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 50 }, // Montée progressive à 50 VUs
                { duration: '1m', target: 50 }, // Maintien à 50 VUs pendant 1 minute
                { duration: '30s', target: 0 } // Descente progressive
            ]
        }
    },
    thresholds: {
        http_req_duration: ['p(95)<1000'], // 95% des requêtes doivent être sous 1s
        http_req_failed: ['rate<0.01'] // Moins de 1% d'erreurs
    }
};

export async function setup() {
    const catalogItems = await fetchCatalog();
    IMAGES = catalogItems.map((item: CatalogItem) => item.public_url);
    console.log(`🌐 URLs des images récupérées: ${IMAGES}`);
}

export default function () {
    // Faire toutes les requêtes en parallèle
    const responses = http.batch(
        IMAGES.map((url) => ({
            method: 'GET',
            url: url
        }))
    );

    // Vérifier chaque réponse
    responses.forEach((response, index) => {
        check(response, {
            [`status is 200 for image ${index + 1}`]: (r) => r.status === 200,
            [`response time < 1000ms for image ${index + 1}`]: (r) => r.timings.duration < 1000
        });
    });
}
