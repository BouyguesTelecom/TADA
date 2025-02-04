.PHONY: all ask-context use-context start-registry build-image push-image helm-install clean helm-uninstall volume dashboard start stop install-nginx run-tests

PROJECT_ROOT := $(shell git rev-parse --show-toplevel)

all: start-registry build-image push-image helm-install run-tests

helm-install:
	@echo "Installing or upgrading Helm chart..."
	@helm upgrade --install media-release opensource/. -f opensource/values.local.yaml

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
	end; \
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
			kubectl apply -f opensource/local-conf/dashboard-clusterrolebinding.yaml; \
		else \
			echo "clusterrolebinding 'dashboard-user' existe déjà."; \
		fi; \
		if ! kubectl get serviceaccount dashboard-user -n kubernetes-dashboard > /dev/null 2>&1; then \
			echo "Création du serviceaccount 'dashboard-user'..."; \
			kubectl apply -f opensource/local-conf/dashboard-user.yaml; \
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

start: install-nginx start-registry build-image push-image helm-install dashboard run-tests

stop: helm-uninstall


ask-context:
	@./select-context.sh

use-context:
	@selected_context=$$(cat .selected_context); \
	echo "Using selected context: $$selected_context"; \
	helm upgrade --install media-release $$selected_context -f $$selected_context/values.local.yaml

start-context: ask-context use-context start