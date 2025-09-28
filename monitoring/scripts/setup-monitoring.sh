#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

MONITORING_NAMESPACE="ecommerce-monitoring"

echo -e "${GREEN}Setting up comprehensive monitoring stack...${NC}"

# Create monitoring namespace
echo -e "${YELLOW}Creating monitoring namespace...${NC}"
kubectl create namespace ${MONITORING_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Deploy Prometheus
echo -e "${YELLOW}Deploying Prometheus...${NC}"
kubectl apply -f monitoring/prometheus/ -n ${MONITORING_NAMESPACE}

# Deploy Alertmanager
echo -e "${YELLOW}Deploying Alertmanager...${NC}"
kubectl apply -f monitoring/alertmanager/ -n ${MONITORING_NAMESPACE}

# Deploy Grafana
echo -e "${YELLOW}Deploying Grafana...${NC}"
kubectl apply -f monitoring/grafana/ -n ${MONITORING_NAMESPACE}

# Deploy ELK Stack
echo -e "${YELLOW}Deploying ELK Stack...${NC}"
kubectl apply -f monitoring/elk/ -n ${MONITORING_NAMESPACE}

# Deploy Jaeger
echo -e "${YELLOW}Deploying Jaeger for distributed tracing...${NC}"
kubectl apply -f monitoring/jaeger/ -n ${MONITORING_NAMESPACE}

# Deploy Node Exporter
echo -e "${YELLOW}Deploying Node Exporter...${NC}"
kubectl apply -f monitoring/node-exporter/ -n ${MONITORING_NAMESPACE}

# Wait for deployments
echo -e "${YELLOW}Waiting for monitoring stack to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/prometheus -n ${MONITORING_NAMESPACE}
kubectl wait --for=condition=available --timeout=300s deployment/grafana -n ${MONITORING_NAMESPACE}
kubectl wait --for=condition=available --timeout=300s deployment/elasticsearch -n ${MONITORING_NAMESPACE}
kubectl wait --for=condition=available --timeout=300s deployment/kibana -n ${MONITORING_NAMESPACE}
kubectl wait --for=condition=available --timeout=300s deployment/jaeger -n ${MONITORING_NAMESPACE}

# Get access URLs
echo -e "\n${GREEN}Monitoring stack deployed successfully!${NC}"
echo -e "\n${GREEN}Access URLs (use kubectl port-forward):${NC}"
echo -e "  Prometheus: ${YELLOW}kubectl port-forward svc/prometheus-service 9090:9090 -n ${MONITORING_NAMESPACE}${NC}"
echo -e "  Grafana: ${YELLOW}kubectl port-forward svc/grafana-service 3000:3000 -n ${MONITORING_NAMESPACE}${NC}"
echo -e "  Kibana: ${YELLOW}kubectl port-forward svc/kibana 5601:5601 -n ${MONITORING_NAMESPACE}${NC}"
echo -e "  Jaeger: ${YELLOW}kubectl port-forward svc/jaeger 16686:16686 -n ${MONITORING_NAMESPACE}${NC}"

echo -e "\n${GREEN}Default credentials:${NC}"
echo -e "  Grafana: admin/admin (change on first login)"

echo -e "\n${GREEN}Useful commands:${NC}"
echo -e "  View monitoring pods: ${YELLOW}kubectl get pods -n ${MONITORING_NAMESPACE}${NC}"
echo -e "  Check Prometheus targets: ${YELLOW}curl http://localhost:9090/api/v1/targets${NC}"
echo -e "  View logs: ${YELLOW}kubectl logs -f deployment/prometheus -n ${MONITORING_NAMESPACE}${NC}"
