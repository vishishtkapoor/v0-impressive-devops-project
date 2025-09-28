#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NAMESPACE="ecommerce"
MONITORING_NAMESPACE="ecommerce-monitoring"

echo -e "${YELLOW}Cleaning up DevOps E-commerce Platform...${NC}"

# Function to delete resources
cleanup_resources() {
    echo -e "${YELLOW}Deleting ingress...${NC}"
    kubectl delete -f k8s/ingress/ --ignore-not-found=true
    
    echo -e "${YELLOW}Deleting services...${NC}"
    kubectl delete -f k8s/deployments/ --ignore-not-found=true
    
    echo -e "${YELLOW}Deleting monitoring...${NC}"
    kubectl delete -f k8s/monitoring/ --ignore-not-found=true
    
    echo -e "${YELLOW}Deleting network policies...${NC}"
    kubectl delete -f k8s/network-policies/ --ignore-not-found=true
    
    echo -e "${YELLOW}Deleting RBAC...${NC}"
    kubectl delete -f k8s/rbac/ --ignore-not-found=true
    
    echo -e "${YELLOW}Deleting configs...${NC}"
    kubectl delete -f k8s/secrets/ --ignore-not-found=true
    kubectl delete -f k8s/configmaps/ --ignore-not-found=true
    
    echo -e "${YELLOW}Deleting namespaces...${NC}"
    kubectl delete namespace ${NAMESPACE} --ignore-not-found=true
    kubectl delete namespace ${MONITORING_NAMESPACE} --ignore-not-found=true
}

# Function to delete persistent volumes
cleanup_storage() {
    echo -e "${YELLOW}Cleaning up persistent volumes...${NC}"
    kubectl delete pvc --all -n ${NAMESPACE} --ignore-not-found=true
    kubectl delete pvc --all -n ${MONITORING_NAMESPACE} --ignore-not-found=true
}

# Main cleanup function
main() {
    echo -e "${RED}WARNING: This will delete all resources for the DevOps E-commerce Platform${NC}"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup_resources
        cleanup_storage
        echo -e "${GREEN}Cleanup completed!${NC}"
    else
        echo -e "${YELLOW}Cleanup cancelled${NC}"
    fi
}

main "$@"
