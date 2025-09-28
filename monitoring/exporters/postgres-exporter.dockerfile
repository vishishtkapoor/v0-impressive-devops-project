FROM quay.io/prometheuscommunity/postgres-exporter:v0.13.2

# Add custom queries
COPY postgres_queries.yml /etc/postgres_exporter/

ENV PG_EXPORTER_EXTEND_QUERY_PATH=/etc/postgres_exporter/postgres_queries.yml

EXPOSE 9187

CMD ["postgres_exporter"]
