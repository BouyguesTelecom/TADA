.PHONY: all ask-context use-context start-registry build-image push-image helm-install helm-install-standalone helm-install-s3 helm-install-distant-backend clean helm-uninstall volume dashboard start start-standalone start-s3 start-distant-backend stop install-nginx run-tests

PROJECT_ROOT := $(shell git rev-parse --show-toplevel)

# Default target - S3 storage
all: start-registry build-image push-image helm-install run-tests

# Storage-specific deployment targets:
# - make start-standalone    : Deploy with STANDALONE storage (no external dependencies)
# - make start-s3           : Deploy with S3 storage (MinIO)
# - make start-distant-backend : Deploy with DISTANT_BACKEND storage

start-registry:
	@if [ $$(docker ps -aq -f name=local-registry) != "" ]; then docker stop local-registry && docker rm local-registry; fi
	@docker run -d -p 5001:5000 --name local-registry registry:2 || true

build-image:
	@docker build -t localhost:5001/media-api:latest src/api

push-image:
	@docker push localhost:5001/media-api:latest

helm-install: helm-install-s3

helm-install-standalone:
	@echo "Installing or upgrading Helm chart with STANDALONE storage..."
	@helm upgrade --install media-release opensource/. -f opensource/values.local-standalone.yaml

helm-install-s3:
	@echo "Installing or upgrading Helm chart with S3 storage..."
	@helm upgrade --install media-release opensource/. -f opensource/values.local-s3.yaml

helm-install-distant-backend:
	@echo "Installing or upgrading Helm chart with DISTANT_BACKEND storage..."
	@helm upgrade --install media-release opensource/. -f opensource/values.local-distant-backend.yaml

install-nginx:
	@nginx_existence=$$(kubectl get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --ignore-not-found) && \
	if [ -z "$$nginx_existence" ]; then \
		echo "Installing the NGINX Ingress Controller..."; \
		kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml; \
	else \
		echo "NGINX Ingress Controller already exists."; \
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
	@read -p "Do you want to launch the Kubernetes Dashboard? (YES/NO) [YES] " response; \
	response=$${response:-YES}; \
	if [ "$$response" = "YES" ]; then \
		echo "Adding the Kubernetes Dashboard repository..."; \
		helm repo add kubernetes-dashboard https://kubernetes.github.io/dashboard/ && \
		echo "Installing the Kubernetes Dashboard..."; \
		helm upgrade --install kubernetes-dashboard kubernetes-dashboard/kubernetes-dashboard --create-namespace --namespace kubernetes-dashboard && \
		if ! kubectl get clusterrolebinding dashboard-user > /dev/null 2>&1; then \
			echo "Creating the clusterrolebinding 'dashboard-user'..."; \
			kubectl apply -f local/helms/local-conf/dashboard-clusterrolebinding.yaml; \
		else \
			echo "clusterrolebinding 'dashboard-user' already exists."; \
		fi; \
		if ! kubectl get serviceaccount dashboard-user -n kubernetes-dashboard > /dev/null 2>&1; then \
			echo "Creating the serviceaccount 'dashboard-user'..."; \
			kubectl apply -f local/helms/local-conf/dashboard-user.yaml; \
		else \
			echo "serviceaccount 'dashboard-user' already exists."; \
		fi; \
		echo "Generating the 'dashboard-user' token..."; \
		TOKEN=$$(kubectl -n kubernetes-dashboard create token dashboard-user); \
		echo ""; \
		echo "🔥"; \
		echo "ADMIN TOKEN ⬇️"; \
		echo ""; \
		echo "$$TOKEN"; \
		echo ""; \
		echo "🔥"; \
		echo ""; \
		echo "Open another terminal and run the following command: kubectl -n kubernetes-dashboard port-forward svc/kubernetes-dashboard-kong-proxy 8443:443"; \
		echo "Then go to: https://localhost:8443/ and enter the admin token generated above."; \
	else \
		echo "Kubernetes Dashboard not launched."; \
	fi

start: start-s3

start-standalone: install-nginx start-registry build-image push-image helm-install-standalone dashboard run-tests

start-s3: install-nginx start-registry build-image push-image helm-install-s3 dashboard run-tests

start-distant-backend: install-nginx start-registry build-image push-image helm-install-distant-backend dashboard run-tests

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
	@cd "$(PROJECT_ROOT)/tests" && bru run flows/ --env K8S -r --bail;
	TESTS_EXIT_CODE=$$?; \
	if [ $$TESTS_EXIT_CODE -ne 0 ]; then \
		echo "Tests failed. Aborting."; \
		exit 1; \
	else \
		echo "All tests passed."; \
	fi
