import http from 'k6/http';
import { check } from 'k6';

const ENV = {
  apiUrl: __ENV.API_URL || 'http://localhost:3001',
  bearerToken: __ENV.BEARER_TOKEN || 'token',
  namespace: __ENV.NAMESPACE || 'DEV'
};

export const options = {
  vus: 1,
  iterations: 1
};

export default function() {
  console.log('🔍 Diagnostic TADA API');
  console.log(`API: ${ENV.apiUrl}`);
  console.log(`Token: ${ENV.bearerToken}`);
  console.log('');

  // Test des différents endpoints pour comprendre l'état de l'API
  
  // 1. Test de base - serveur accessible ?
  console.log('🌐 Test 1: Connectivité serveur');
  try {
    const healthResponse = http.get(ENV.apiUrl, { timeout: '5s' });
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   Headers: ${JSON.stringify(healthResponse.headers)}`);
    
    if (healthResponse.body) {
      const bodyPreview = typeof healthResponse.body === 'string' 
        ? healthResponse.body.substring(0, 200) 
        : String(healthResponse.body).substring(0, 200);
      console.log(`   Body preview: ${bodyPreview}`);
    }
  } catch (e) {
    console.log(`   ❌ Erreur de connexion: ${e}`);
  }
  console.log('');

  // 2. Test catalog avec différentes approches
  console.log('📋 Test 2: Endpoint catalog');
  
  // Test catalog de base
  const catalogResponse = http.get(`${ENV.apiUrl}/catalog`, { timeout: '10s' });
  console.log(`   GET /catalog - Status: ${catalogResponse.status}`);
  
  if (catalogResponse.status === 500) {
    console.log('   ❌ Erreur 500 - Problème serveur interne');
    console.log(`   Error body: ${catalogResponse.body}`);
    
    // Essayons avec des headers différents
    const catalogWithHeaders = http.get(`${ENV.apiUrl}/catalog`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'k6-load-test'
      },
      timeout: '10s'
    });
    console.log(`   GET /catalog (avec headers) - Status: ${catalogWithHeaders.status}`);
  } else if (catalogResponse.status === 200) {
    console.log('   ✅ Catalog accessible');
    try {
      const catalog = JSON.parse(catalogResponse.body);
      console.log(`   Items: ${Array.isArray(catalog) ? catalog.length : 'unknown'}`);
    } catch (e) {
      console.log(`   ⚠️  Réponse non-JSON`);
    }
  }
  console.log('');

  // 3. Test des endpoints avec authentification
  console.log('🔐 Test 3: Endpoints avec authentification');
  
  // Test avec juste les headers d'auth
  const authTestResponse = http.get(`${ENV.apiUrl}/catalog`, {
    headers: {
      'Authorization': `Bearer ${ENV.bearerToken}`,
      'Accept': 'application/json'
    },
    timeout: '10s'
  });
  console.log(`   GET /catalog (avec auth) - Status: ${authTestResponse.status}`);
  console.log('');

  // 4. Test upload minimal
  console.log('📤 Test 4: Upload minimal');
  
  // Test 1: Upload sans fichier
  const emptyUpload = http.post(`${ENV.apiUrl}/file`, {
    namespace: ENV.namespace,
    destination: 'test'
  }, {
    headers: {
      'Authorization': `Bearer ${ENV.bearerToken}`
    },
    timeout: '10s'
  });
  console.log(`   POST /file (sans fichier) - Status: ${emptyUpload.status}`);
  console.log(`   Response: ${emptyUpload.body?.substring(0, 200)}`);

  // Test 2: Upload avec fichier minimal
  const minimalFile = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG header
  const fileUpload = http.post(`${ENV.apiUrl}/file`, {
    file: http.file(minimalFile, 'test.png', 'image/png'),
    namespace: ENV.namespace,
    destination: 'diagnosis'
  }, {
    headers: {
      'Authorization': `Bearer ${ENV.bearerToken}`
    },
    timeout: '10s'
  });
  console.log(`   POST /file (avec fichier) - Status: ${fileUpload.status}`);
  console.log(`   Response: ${fileUpload.body?.substring(0, 200)}`);
  console.log('');

  // 5. Test des routes alternatives
  console.log('🔍 Test 5: Routes alternatives');
  
  const routes = [
    '/health',
    '/status', 
    '/api/catalog',
    '/files',
    '/swagger',
    '/docs'
  ];
  
  routes.forEach(route => {
    try {
      const response = http.get(`${ENV.apiUrl}${route}`, { timeout: '3s' });
      console.log(`   GET ${route} - Status: ${response.status}`);
      
      if (response.status === 200) {
        const contentType = response.headers['Content-Type'] || '';
        console.log(`     Content-Type: ${contentType}`);
      }
    } catch (e) {
      console.log(`   GET ${route} - Timeout/Error`);
    }
  });
  
  console.log('');
  console.log('🏁 Diagnostic terminé');
  
  // Quelques checks de base
  check(catalogResponse, {
    'serveur répond': (r) => r.status !== 0,
    'pas de timeout': (r) => r.status !== undefined
  });
}