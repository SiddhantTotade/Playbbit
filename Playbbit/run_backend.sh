#!/bin/bash
export PLAYBBIT_DB="playbbit_db"
export DB_USER="admin"
export DB_PASSWORD="root"
export MINIO_ENDPOINT="http://localhost:9000"
export MINIO_ACCESS_KEY="admin"
export MINIO_SECRET_KEY="SonOfAnton"
export MINIO_REGION="us-east-1"
export MINIO_EXTERNAL_URL="http://localhost:9000"
export MINIO_BUCKET="live-streams"
export JWT_SECRET="HQU/Hm4/QO2gDvGAcwrX7+DaSnygKHEMuWQoEtDpOd4="

# Override datasource URL to localhost for local execution
export SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/playbbit_db"

echo "Stopping any running backend on port 8085..."
fuser -k 8085/tcp || true

echo "Starting backend on port 8085..."
nohup ./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8085 > backend_run.log 2>&1 &
echo "Backend started in background on 8085. Check backend_run.log for status."
