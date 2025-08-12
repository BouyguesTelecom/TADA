#!/bin/bash

echo "🚀 TADA K6 Load Testing Suite"
echo "============================="

# Vérifier si k6 est installé
if ! command -v k6 &> /dev/null; then
    echo "❌ K6 n'est pas installé. Installez-le avec : brew install k6"
    exit 1
fi

# Construire le projet
echo "📦 Building TypeScript files..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Choix de l'environnement
echo "🌍 Choisissez l'environnement cible :"
echo "1) Local (http://localhost:3001)"
echo "2) Kubernetes Ingress (http://media-service.tada-api.media)"
echo "3) Custom URLs (vous spécifiez manuellement)"

read -p "Environnement (1-3): " env_choice

case $env_choice in
    1)
        ENVIRONMENT="local"
        BASE_URL="http://localhost:3001"
        API_URL="http://localhost:3001"
        echo "🏠 Environnement local sélectionné"
        ;;
    2)
        ENVIRONMENT="kubernetes"
        BASE_URL="http://media-service.tada-api.media"
        API_URL="http://media-service.tada-api.media"
        echo "☸️ Environnement Kubernetes sélectionné"
        ;;
    3)
        ENVIRONMENT="custom"
        read -p "URL de base (ex: http://localhost:3001): " BASE_URL
        read -p "URL API (ex: http://localhost:3001): " API_URL
        echo "🔧 URLs personnalisées configurées"
        ;;
    *)
        echo "❌ Choix invalide, utilisation de l'environnement local par défaut"
        ENVIRONMENT="local"
        BASE_URL="http://localhost:3001"
        API_URL="http://localhost:3001"
        ;;
esac

echo ""
read -p "Bearer Token (défaut: 'token'): " BEARER_TOKEN
BEARER_TOKEN=${BEARER_TOKEN:-token}

echo ""
echo "📋 Configuration :"
echo "   Environnement: $ENVIRONMENT"
echo "   API URL: $API_URL"
echo "   Bearer Token: $BEARER_TOKEN"
echo ""

# Menu des tests
echo "Choisissez un test à exécuter :"
echo "1) Smoke Test (validation fonctionnelle)"
echo "2) Load Test (performance normale)"
echo "3) Stress Test (limites système)"
echo "4) Spike Test (pics de trafic)"
echo "5) Catalog Test (operations catalog)"
echo "6) Test rapide avec 1 VU pendant 30s"

read -p "Votre choix (1-6): " choice

case $choice in
    1)
        echo "🔥 Exécution du Smoke Test..."
        k6 run src/simple-smoke-test.js \
            --env ENVIRONMENT="$ENVIRONMENT" \
            --env BASE_URL="$BASE_URL" \
            --env API_URL="$API_URL" \
            --env BEARER_TOKEN="$BEARER_TOKEN"
        ;;
    2)
        echo "⚡ Exécution du Load Test..."
        k6 run src/simple-load-test.js \
            --env ENVIRONMENT="$ENVIRONMENT" \
            --env BASE_URL="$BASE_URL" \
            --env API_URL="$API_URL" \
            --env BEARER_TOKEN="$BEARER_TOKEN"
        ;;
    3)
        echo "💪 Exécution du Stress Test..."
        k6 run dist/scenarios/stress-test.js \
            --env ENVIRONMENT="$ENVIRONMENT" \
            --env BASE_URL="$BASE_URL" \
            --env API_URL="$API_URL" \
            --env BEARER_TOKEN="$BEARER_TOKEN"
        ;;
    4)
        echo "🌊 Exécution du Spike Test..."
        k6 run dist/scenarios/spike-test.js \
            --env ENVIRONMENT="$ENVIRONMENT" \
            --env BASE_URL="$BASE_URL" \
            --env API_URL="$API_URL" \
            --env BEARER_TOKEN="$BEARER_TOKEN"
        ;;
    5)
        echo "📋 Exécution du Catalog Test..."
        k6 run dist/scenarios/catalog-test.js \
            --env ENVIRONMENT="$ENVIRONMENT" \
            --env BASE_URL="$BASE_URL" \
            --env API_URL="$API_URL" \
            --env BEARER_TOKEN="$BEARER_TOKEN"
        ;;
    6)
        echo "🏃‍♂️ Test rapide avec 1 VU pendant 30s..."
        k6 run --vus 1 --duration 30s src/simple-smoke-test.js \
            --env ENVIRONMENT="$ENVIRONMENT" \
            --env BASE_URL="$BASE_URL" \
            --env API_URL="$API_URL" \
            --env BEARER_TOKEN="$BEARER_TOKEN"
        ;;
    *)
        echo "❌ Choix invalide"
        exit 1
        ;;
esac