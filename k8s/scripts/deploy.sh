#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="ecommerce"
MONITORING_NAMESPACE="ecommerce-monitoring"
KUBECTL_TIMEOUT="300s"

echo -e "${GREEN}Starting Kubernetes deployment for DevOps E-commerce Platform${NC}"

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}kubectl is not installed or not in PATH${NC}"
        exit 1
    fi
}

# Function to check cluster connectivity
check_cluster() {
    echo -e "${YELLOW}Checking cluster connectivity...${NC}"
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}Cannot connect to Kubernetes cluster${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Connected to cluster${NC}"
}

# Function to create namespaces
create_namespaces() {
    echo -e "${YELLOW}Creating namespaces...${NC}"
    kubectl apply -f k8s/namespaces/
    echo -e "${GREEN}✓ Namespaces created${NC}"
}

# Function to deploy secrets and configmaps
deploy_configs() {
    echo -e "${YELLOW}Deploying secrets and configmaps...${NC}"
    kubectl apply -f k8s/secrets/
    kubectl apply -f k8s/configmaps/
    echo -e "${GREEN}✓ Secrets and configmaps deployed${NC}"
}

# Function to deploy RBAC
deploy_rbac() {
    echo -e "${YELLOW}Deploying RBAC...${NC}"
    kubectl apply -f k8s/rbac/
    echo -e "${GREEN}✓ RBAC deployed${NC}"
}

# Function to deploy databases
deploy_databases() {
    echo -e "${YELLOW}Deploying databases...${NC}"
    kubectl apply -f k8s/deployments/postgres-deployment.yaml
    kubectl apply -f k8s/deployments/redis-deployment.yaml
    
    echo -e "${YELLOW}Waiting for databases to be ready...${NC}"
    kubectl wait --for=condition=available --timeout=${KUBECTL_TIMEOUT} deployment/postgres -n ${NAMESPACE}
    kubectl wait --for=condition=available --timeout=${KUBECTL_TIMEOUT} deployment/redis -n ${NAMESPACE}
    echo -e "${GREEN}✓ Databases deployed and ready${NC}"
}

# Function to deploy microservices
deploy_services() {
    echo -e "${YELLOW}Deploying microservices...${NC}"
    kubectl apply -f k8s/deployments/user-service-deployment.yaml
    kubectl apply -f k8s/deployments/product-service-deployment.yaml
    kubectl apply -f k8s/deployments/order-service-deployment.yaml
    kubectl apply -f k8s/deployments/api-gateway-deployment.yaml
    
    echo -e "${YELLOW}Waiting for services to be ready...${NC}"
    kubectl wait --for=condition=available --timeout=${KUBECTL_TIMEOUT} deployment/user-service -n ${NAMESPACE}
    kubectl wait --for=condition=available --timeout=${KUBECTL_TIMEOUT} deployment/product-service -n ${NAMESPACE}
    kubectl wait --for=condition=available --timeout=${KUBECTL_TIMEOUT} deployment/order-service -n ${NAMESPACE}
    kubectl wait --for=condition=available --timeout=${KUBECTL_TIMEOUT} deployment/api-gateway -n ${NAMESPACE}
    echo -e "${GREEN}✓ Microservices deployed and ready${NC}"
}

# Function to deploy ingress
deploy_ingress() {
    echo -e "${YELLOW}Deploying ingress...${NC}"
    kubectl apply -f k8s/ingress/
    echo -e "${GREEN}✓ Ingress deployed${NC}"
}

# Function to deploy network policies
deploy_network_policies() {
    echo -e "${YELLOW}Deploying network policies...${NC}"
    kubectl apply -f k8s/network-policies/
    echo -e "${GREEN}✓ Network policies deployed${NC}"
}

# Function to deploy monitoring
deploy_monitoring() {
    echo -e "${YELLOW}Deploying monitoring stack...${NC}"
    kubectl apply -f k8s/monitoring/
    echo -e "${GREEN}✓ Monitoring stack deployed${NC}"
}

# Function to show deployment status
show_status() {
    echo -e "${GREEN}Deployment Status:${NC}"
    echo -e "${YELLOW}Namespaces:${NC}"
    kubectl get namespaces | grep -E "(ecommerce|NAME)"
    
    echo -e "\n${YELLOW}Pods in ${NAMESPACE}:${NC}"
    kubectl get pods -n ${NAMESPACE}
    
    echo -e "\n${YELLOW}Services in ${NAMESPACE}:${NC}"
    kubectl get services -n ${NAMESPACE}
    
    echo -e "\n${YELLOW}Ingress:${NC}"
    kubectl get ingress -n ${NAMESPACE}
    
    echo -e "\n${YELLOW}HPA Status:${NC}"
    kubectl get hpa -n ${NAMESPACE}
}

# Function to get external URLs
get_urls() {
    echo -e "\n${GREEN}Getting external URLs...${NC}"
    INGRESS_HOST=$(kubectl get ingress ecommerce-ingress -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    if [ ! -z "$INGRESS_HOST" ]; then
        echo -e "${GREEN}Application URL: https://${INGRESS_HOST}${NC}"
        echo -e "${GREEN}API URL: https://${INGRESS_HOST}/api${NC}"
    else
        echo -e "${YELLOW}Ingress hostname not yet available. Check again in a few minutes.${NC}"
    fi
}

# Main deployment function
main() {
    check_kubectl
    check_cluster
    
    echo -e "${GREEN}Starting deployment...${NC}"
    
    create_namespaces
    deploy_configs
    deploy_rbac
    deploy_databases
    deploy_services
    deploy_ingress
    deploy_network_policies
    deploy_monitoring
    
    echo -e "\n${GREEN}Deployment completed successfully!${NC}"
    
    show_status
    get_urls
    
    echo -e "\n${GREEN}Useful commands:${NC}"
    echo -e "  Monitor pods: ${YELLOW}kubectl get pods -n ${NAMESPACE} -w${NC}"
    echo -e "  View logs: ${YELLOW}kubectl logs -f deployment/api-gateway -n ${NAMESPACE}${NC}"
    echo -e "  Scale service: ${YELLOW}kubectl scale deployment user-service --replicas=5 -n ${NAMESPACE}${NC}"
    echo -e "  Port forward: ${YELLOW}kubectl port-forward service/api-gateway-service 8080:80 -n ${NAMESPACE}${NC}"
}

# Run main function
main "$@"
