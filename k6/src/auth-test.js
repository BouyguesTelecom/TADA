import http from 'k6/http';
import { check } from 'k6';

// Configuration pour tests d'authentification
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
  console.log('🔐 Test d\'authentification TADA');
  console.log(`API URL: ${ENV.apiUrl}`);
  console.log(`Token: ${ENV.bearerToken}`);
  console.log(`Namespace: ${ENV.namespace}`);
  console.log('');

  // Test 1: Endpoint public (catalog) - pas d'auth nécessaire
  console.log('📋 Test 1: GET /catalog (public)');
  const catalogResponse = http.get(`${ENV.apiUrl}/catalog`, {
    timeout: '10s'
  });
  
  console.log(`   Status: ${catalogResponse.status}`);
  console.log(`   Duration: ${catalogResponse.timings.duration}ms`);
  
  if (catalogResponse.status !== 200) {
    console.log(`   Error: ${catalogResponse.body}`);
  } else {
    try {
      const catalog = JSON.parse(catalogResponse.body);
      console.log(`   ✅ Catalog récupéré - ${Array.isArray(catalog) ? catalog.length : 'unknown'} items`);
    } catch (e) {
      console.log(`   ⚠️  Réponse non-JSON: ${catalogResponse.body?.substring(0, 100)}`);
    }
  }
  
  console.log('');

  // Test 2: Endpoint protégé (file upload) - auth nécessaire
  console.log('📤 Test 2: POST /file (protégé)');
  const uploadData = {
    namespace: ENV.namespace,
    destination: 'auth-test',
    toWebp: 'true',
    information: 'Test authentification'
  };

  const uploadResponse = http.post(`${ENV.apiUrl}/file`, uploadData, {
    headers: {
      'Authorization': `Bearer ${ENV.bearerToken}`
    },
    timeout: '10s'
  });

  console.log(`   Status: ${uploadResponse.status}`);
  console.log(`   Duration: ${uploadResponse.timings.duration}ms`);

  if (uploadResponse.status === 401) {
    console.log('   ❌ Authentification échouée - Vérifiez le token');
    console.log(`   Error: ${uploadResponse.body}`);
  } else if (uploadResponse.status === 400) {
    console.log('   ⚠️  Requête malformée (normal sans fichier)');
    console.log(`   Body: ${uploadResponse.body?.substring(0, 200)}`);
  } else if (uploadResponse.status === 200) {
    console.log('   ✅ Authentification réussie');
    try {
      const uploadResult = JSON.parse(uploadResponse.body);
      console.log(`   Réponse: ${JSON.stringify(uploadResult).substring(0, 100)}...`);
    } catch (e) {
      console.log(`   Réponse: ${uploadResponse.body?.substring(0, 100)}`);
    }
  } else {
    console.log(`   ⚠️  Statut inattendu: ${uploadResponse.status}`);
    console.log(`   Body: ${uploadResponse.body?.substring(0, 200)}`);
  }

  console.log('');

  // Test 3: Endpoint protégé sans auth
  console.log('📤 Test 3: POST /file sans authentification');
  const noAuthResponse = http.post(`${ENV.apiUrl}/file`, uploadData, {
    timeout: '10s'
  });

  console.log(`   Status: ${noAuthResponse.status}`);
  console.log(`   Duration: ${noAuthResponse.timings.duration}ms`);

  if (noAuthResponse.status === 401) {
    console.log('   ✅ Sécurité OK - 401 sans token');
  } else {
    console.log(`   ⚠️  Sécurité potentielle - Status: ${noAuthResponse.status}`);
    console.log(`   Body: ${noAuthResponse.body?.substring(0, 200)}`);
  }

  console.log('');
  console.log('🏁 Test d\'authentification terminé');

  // Checks K6 pour les métriques
  check(catalogResponse, {
    'catalog accessible': (r) => r.status === 200
  });

  check(uploadResponse, {
    'file endpoint authenticated': (r) => r.status !== 401
  });

  check(noAuthResponse, {
    'security enforced': (r) => r.status === 401
  });
}