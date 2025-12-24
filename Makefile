.PHONY: all ask-context use-context start-registry build-image build-image-distant-backend push-image push-image-distant-backend helm-install helm-install-standalone helm-install-s3 helm-install-distant-backend helm-install-distant-backend-2 clean helm-uninstall volume dashboard start start-standalone start-s3 start-distant-backend start-distant-backend-2 deploy-distant-backend-2 stop install-nginx run-tests

PROJECT_ROOT := $(shell git rev-parse --show-toplevel)

# Default target - S3 storage
all: start-registry build-image push-image helm-install run-tests

# Storage-specific deployment targets:
# - make start-standalone    : Deploy with STANDALONE storage (no external dependencies)
# - make start-s3           : Deploy with S3 storage (MinIO)
# - make start-distant-backend : Deploy with DISTANT_BACKEND storage
# - make start-distant-backend-2 : Deploy with DISTANT_BACKEND storage using new Helm configuration
# - make deploy-distant-backend-2 : Deploy only distant-backend-2 service (quick deployment)

start-registry:
	@if [ "$$(docker ps -aq -f name=local-registry)" != "" ]; then docker stop local-registry && docker rm local-registry; fi
	@docker run -d -p 5001:5000 --name local-registry registry:2 || true

build-image:
	@docker build -t localhost:5001/media-api:latest src/api

build-image-distant-backend:
	@docker build -t localhost:5001/distant-backend:latest examples/distant-backend

push-image:
	@docker push localhost:5001/media-api:latest

push-image-distant-backend:
	@docker push localhost:5001/distant-backend:latest

helm-install: helm-install-s3

helm-install-standalone:
	@echo "Installing or upgrading Helm chart with STANDALONE storage..."
	@helm upgrade --install media-release opensource/. -f opensource/values.local-standalone.yaml

helm-install-s3:
	@echo "Installing or upgrading Helm chart with S3 storage..."
	@helm upgrade --install media-release opensource/. -f opensource/values.local-s3.yaml

helm-install-distant-backend:
	@helm dependency update ./examples/distant-backend/helms/Products
	@helm dependency build ./examples/distant-backend/helms/Products
	@echo "Installing or upgrading distant-backend service..."
	@helm upgrade --install distant-backend-release examples/distant-backend/helms/Products/. -f examples/distant-backend/helms/Products/values.yaml

install-nginx:
	@nginx_existence=$$(kubectl get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --ignore-not-found) && \
	if [ -z "$$nginx_existence" ]; then \
		echo "Installation du NGINX Ingress Controller..."; \
		kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml; \
	else \
		echo "NGINX Ingress Controller existe déjà."; \
	fi

clean:
	@docker stop local-registry || true
	@docker rm local-registry || true
	@kubectl delete clusterrolebinding dashboard-user || true
	@kubectl delete serviceaccount dashboard-user -n kubernetes-dashboard || true
	@kubectl delete cronjob backup-and-clean-cronjob-1.0.6 || true
	@echo "🧹 Clean OK. 🧹"

helm-uninstall:
	@echo "Uninstalling Helm release..."
	@helm uninstall media-release; \
	ALL_PODS_GONE=0; \
	for i in {1..30}; do \
		REMAINING_PODS=$$(kubectl get pods --namespace default -o jsonpath='{.items[*].metadata.deletionTimestamp}' --ignore-not-found); \
		if [ "$$REMAINING_PODS" = "" ]; then \
			ALL_PODS_GONE=1; \
			break; \
		fi; \
		echo "Waiting for all pods to be deleted..."; \
		sleep 3; \
	done; \
	if [ "$$ALL_PODS_GONE" -ne 1 ]; then \
		echo "Some pods are still running. Uninstallation incomplete."; \
		exit 1; \
	else \
		echo "All pods have been deleted. Uninstallation complete."; \
	fi

dashboard:
	@read -p "Souhaitez-vous lancer le Kubernetes Dashboard ? (YES/NO) [YES] " response; \
	response=$${response:-YES}; \
	if [ "$$response" = "YES" ]; then \
		echo "Ajout du dépôt Kubernetes Dashboard..."; \
		helm repo add kubernetes-dashboard https://kubernetes.github.io/dashboard/ && \
		echo "Installation du Kubernetes Dashboard..."; \
		helm upgrade --install kubernetes-dashboard kubernetes-dashboard/kubernetes-dashboard --create-namespace --namespace kubernetes-dashboard && \
		if ! kubectl get clusterrolebinding dashboard-user > /dev/null 2>&1; then \
			echo "Création du clusterrolebinding 'dashboard-user'..."; \
			kubectl apply -f local/helms/local-conf/dashboard-clusterrolebinding.yaml; \
		else \
			echo "clusterrolebinding 'dashboard-user' existe déjà."; \
		fi; \
		if ! kubectl get serviceaccount dashboard-user -n kubernetes-dashboard > /dev/null 2>&1; then \
			echo "Création du serviceaccount 'dashboard-user'..."; \
			kubectl apply -f local/helms/local-conf/dashboard-user.yaml; \
		else \
			echo "serviceaccount 'dashboard-user' existe déjà."; \
		fi; \
		echo "Génération du token 'dashboard-user'..."; \
		TOKEN=$$(kubectl -n kubernetes-dashboard create token dashboard-user); \
		echo ""; \
		echo "🔥"; \
		echo "TOKEN ADMIN ⬇️"; \
		echo ""; \
		echo "$$TOKEN"; \
		echo ""; \
		echo "🔥"; \
		echo ""; \
		echo "Ouvrez un autre terminal et lancez la commande suivante : kubectl -n kubernetes-dashboard port-forward svc/kubernetes-dashboard-kong-proxy 8443:443"; \
		echo "Ensuite, rendez-vous sur : https://localhost:8443/ et renseignez le token admin généré ci-dessus."; \
	else \
		echo "Kubernetes Dashboard non lancé."; \
	fi

start: start-s3

start-standalone: install-nginx start-registry build-image push-image helm-install-standalone dashboard run-tests

start-s3: install-nginx start-registry build-image push-image helm-install-s3 dashboard run-tests

start-distant-backend: install-nginx start-registry build-image-distant-backend push-image-distant-backend helm-install-distant-backend dashboard 

deploy-distant-backend-2: start-registry build-image-distant-backend push-image-distant-backend helm-install-distant-backend-2

stop: helm-uninstall

run-tests:
	@echo "Waiting for all pods to be in the 'Ready' status..."
	@kubectl wait --for=condition=Ready pods --all --namespace default --timeout=60s; \
	if [ $$? -ne 0 ]; then \
		echo "Not all pods are ready. Aborting tests."; \
		exit 1; \
	fi
	@echo "Running tests with bru..."
	@sleep 5;
	@cd "$(PROJECT_ROOT)/tests" && npx bru run flows/ --env K8S -r --bail;
	TESTS_EXIT_CODE=$$?; \
	if [ $$TESTS_EXIT_CODE -ne 0 ]; then \
		echo "Tests failed. Aborting."; \
		exit 1; \
	else \
		echo "All tests passed."; \
	fi
