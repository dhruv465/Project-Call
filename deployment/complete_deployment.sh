#!/bin/bash
# Complete deployment script for Voice AI system
# This script automates the full deployment process including:
# - Environment setup
# - Database setup and migration
# - Model deployment
# - Monitoring setup
# - Security configuration

set -e  # Exit on any error

# Text colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="voice-ai"
APP_DIR="/opt/voice-ai"
MODELS_DIR="${APP_DIR}/models"
LOG_DIR="${APP_DIR}/logs"
MONITORING_DIR="${APP_DIR}/monitoring"
DOCKER_COMPOSE_FILE="${APP_DIR}/docker-compose.yml"
ENV_FILE="${APP_DIR}/.env.production"

# Banner
echo -e "${BLUE}"
echo "=========================================================="
echo "  Voice AI Production Deployment"
echo "  Version: 1.0"
echo "  $(date)"
echo "=========================================================="
echo -e "${NC}"

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root or with sudo privileges${NC}"
  exit 1
fi

# Create necessary directories
echo -e "${YELLOW}Creating application directories...${NC}"
mkdir -p ${APP_DIR}
mkdir -p ${MODELS_DIR}
mkdir -p ${LOG_DIR}
mkdir -p ${MONITORING_DIR}
mkdir -p ${APP_DIR}/backups
mkdir -p ${APP_DIR}/config

# Copy production environment files
echo -e "${YELLOW}Setting up environment configuration...${NC}"
if [ -f "${ENV_FILE}.template" ]; then
  cp ${ENV_FILE}.template ${ENV_FILE}
  echo -e "${YELLOW}Copied environment template. Please edit ${ENV_FILE} with your production values.${NC}"
else
  echo -e "${RED}Environment template not found. Please create ${ENV_FILE} manually.${NC}"
fi

# Deploy Docker Compose configuration
echo -e "${YELLOW}Setting up Docker Compose configuration...${NC}"
cat > ${DOCKER_COMPOSE_FILE} << EOF
version: '3.8'

services:
  server:
    image: voiceai/server:latest
    container_name: voiceai-server
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - ${APP_DIR}/logs:/app/logs
      - ${APP_DIR}/uploads:/app/uploads
      - ${MODELS_DIR}:/app/models
    env_file:
      - ${ENV_FILE}
    depends_on:
      - postgres
      - redis
    networks:
      - voiceai-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  client:
    image: voiceai/client:latest
    container_name: voiceai-client
    restart: always
    ports:
      - "80:80"
    env_file:
      - ${ENV_FILE}
    depends_on:
      - server
    networks:
      - voiceai-network

  postgres:
    image: postgres:15
    container_name: voiceai-postgres
    restart: always
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: \${DATABASE_USER}
      POSTGRES_PASSWORD: \${DATABASE_PASSWORD}
      POSTGRES_DB: \${DATABASE_NAME}
    networks:
      - voiceai-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DATABASE_USER} -d \${DATABASE_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    container_name: voiceai-redis
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - voiceai-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Monitoring stack
  prometheus:
    image: prom/prometheus:latest
    container_name: voiceai-prometheus
    restart: always
    volumes:
      - ${MONITORING_DIR}/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - voiceai-network
    depends_on:
      - server

  grafana:
    image: grafana/grafana:latest
    container_name: voiceai-grafana
    restart: always
    volumes:
      - grafana-data:/var/lib/grafana
      - ${MONITORING_DIR}/grafana/provisioning:/etc/grafana/provisioning
      - ${MONITORING_DIR}/grafana/dashboards:/var/lib/grafana/dashboards
    ports:
      - "3001:3000"
    networks:
      - voiceai-network
    depends_on:
      - prometheus

networks:
  voiceai-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
  prometheus-data:
  grafana-data:
EOF

echo -e "${GREEN}Docker Compose configuration created.${NC}"

# Setup Prometheus configuration
echo -e "${YELLOW}Setting up Prometheus configuration...${NC}"
mkdir -p ${MONITORING_DIR}/prometheus
cat > ${MONITORING_DIR}/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'voice-ai-server'
    static_configs:
      - targets: ['server:3000']
        labels:
          service: 'voice-ai-api'
          environment: 'production'
EOF

# Setup Grafana dashboards
echo -e "${YELLOW}Setting up Grafana dashboards...${NC}"
mkdir -p ${MONITORING_DIR}/grafana/provisioning/datasources
mkdir -p ${MONITORING_DIR}/grafana/provisioning/dashboards
mkdir -p ${MONITORING_DIR}/grafana/dashboards

# Create Grafana datasource configuration
cat > ${MONITORING_DIR}/grafana/provisioning/datasources/datasource.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF

# Create Grafana dashboard provisioning
cat > ${MONITORING_DIR}/grafana/provisioning/dashboards/dashboards.yml << EOF
apiVersion: 1

providers:
  - name: 'Voice AI Dashboards'
    folder: 'Voice AI'
    type: file
    options:
      path: /var/lib/grafana/dashboards
EOF

# Setup Voice AI dashboard JSON
echo -e "${YELLOW}Creating Voice AI performance dashboard...${NC}"
cat > ${MONITORING_DIR}/grafana/dashboards/voice_ai_performance.json << EOF
{
  "annotations": {
    "list": []
  },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": 1,
  "links": [],
  "liveNow": false,
  "panels": [
    {
      "datasource": {
        "type": "prometheus",
        "uid": "PBFA97CFB590B2093"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "palette-classic"
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "value": null
              },
              {
                "color": "red",
                "value": 80
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "id": 1,
      "options": {
        "orientation": "auto",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        },
        "showThresholdLabels": false,
        "showThresholdMarkers": true
      },
      "pluginVersion": "9.5.1",
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "PBFA97CFB590B2093"
          },
          "expr": "voice_ai_system_health",
          "refId": "A"
        }
      ],
      "title": "System Health",
      "type": "gauge"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "PBFA97CFB590B2093"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "palette-classic"
          },
          "custom": {
            "axisCenteredZero": false,
            "axisColorMode": "text",
            "axisLabel": "",
            "axisPlacement": "auto",
            "barAlignment": 0,
            "drawStyle": "line",
            "fillOpacity": 0,
            "gradientMode": "none",
            "hideFrom": {
              "legend": false,
              "tooltip": false,
              "viz": false
            },
            "lineInterpolation": "linear",
            "lineWidth": 1,
            "pointSize": 5,
            "scaleDistribution": {
              "type": "linear"
            },
            "showPoints": "auto",
            "spanNulls": false,
            "stacking": {
              "group": "A",
              "mode": "none"
            },
            "thresholdsStyle": {
              "mode": "off"
            }
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "value": null
              },
              {
                "color": "red",
                "value": 80
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 0
      },
      "id": 2,
      "options": {
        "legend": {
          "calcs": [],
          "displayMode": "list",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": {
          "mode": "single",
          "sort": "none"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "PBFA97CFB590B2093"
          },
          "expr": "rate(voice_ai_calls_total[5m])",
          "refId": "A"
        }
      ],
      "title": "Call Rate (5m)",
      "type": "timeseries"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "PBFA97CFB590B2093"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "palette-classic"
          },
          "custom": {
            "hideFrom": {
              "legend": false,
              "tooltip": false,
              "viz": false
            }
          },
          "mappings": []
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 8
      },
      "id": 3,
      "options": {
        "legend": {
          "displayMode": "list",
          "placement": "bottom",
          "showLegend": true
        },
        "pieType": "pie",
        "reduceOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "fields": "",
          "values": false
        },
        "tooltip": {
          "mode": "single",
          "sort": "none"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "PBFA97CFB590B2093"
          },
          "expr": "voice_ai_call_outcomes",
          "refId": "A"
        }
      ],
      "title": "Call Outcomes",
      "type": "piechart"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "PBFA97CFB590B2093"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "palette-classic"
          },
          "custom": {
            "axisCenteredZero": false,
            "axisColorMode": "text",
            "axisLabel": "",
            "axisPlacement": "auto",
            "fillOpacity": 80,
            "gradientMode": "none",
            "hideFrom": {
              "legend": false,
              "tooltip": false,
              "viz": false
            },
            "lineWidth": 1,
            "scaleDistribution": {
              "type": "linear"
            },
            "thresholdsStyle": {
              "mode": "off"
            }
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "value": null
              },
              {
                "color": "red",
                "value": 80
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 8
      },
      "id": 4,
      "options": {
        "barRadius": 0,
        "barWidth": 0.97,
        "fullHighlight": false,
        "groupWidth": 0.7,
        "legend": {
          "calcs": [],
          "displayMode": "list",
          "placement": "bottom",
          "showLegend": true
        },
        "orientation": "auto",
        "showValue": "auto",
        "stacking": "none",
        "tooltip": {
          "mode": "single",
          "sort": "none"
        },
        "xTickLabelRotation": 0,
        "xTickLabelSpacing": 0
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "PBFA97CFB590B2093"
          },
          "expr": "voice_ai_emotion_detection_accuracy",
          "refId": "A"
        }
      ],
      "title": "Emotion Detection Accuracy",
      "type": "barchart"
    }
  ],
  "refresh": "5s",
  "schemaVersion": 38,
  "style": "dark",
  "tags": [],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "",
  "title": "Voice AI Performance Dashboard",
  "uid": "voice-ai-performance",
  "version": 1,
  "weekStart": ""
}
EOF

# Deploy models
echo -e "${YELLOW}Setting up model deployment scripts...${NC}"
cat > ${APP_DIR}/deploy_models.sh << EOF
#!/bin/bash
# Model deployment script

MODELS_SOURCE_DIR="\$1"
if [ -z "\$MODELS_SOURCE_DIR" ]; then
  echo "Usage: \$0 <models_source_directory>"
  exit 1
fi

if [ ! -d "\$MODELS_SOURCE_DIR" ]; then
  echo "Error: Models source directory does not exist: \$MODELS_SOURCE_DIR"
  exit 1
fi

echo "Deploying models from \$MODELS_SOURCE_DIR to ${MODELS_DIR}"

# Create backup of current models
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
if [ -d "${MODELS_DIR}" ] && [ "\$(ls -A ${MODELS_DIR})" ]; then
  echo "Backing up existing models..."
  mkdir -p ${APP_DIR}/backups/models_\${TIMESTAMP}
  cp -r ${MODELS_DIR}/* ${APP_DIR}/backups/models_\${TIMESTAMP}/
  echo "Models backed up to ${APP_DIR}/backups/models_\${TIMESTAMP}"
fi

# Copy new models
echo "Copying new models..."
mkdir -p ${MODELS_DIR}
cp -r \$MODELS_SOURCE_DIR/* ${MODELS_DIR}/

# Update model registry
echo "Updating model registry..."
docker-compose exec -T server npm run update-model-registry

echo "Model deployment completed successfully!"
EOF

chmod +x ${APP_DIR}/deploy_models.sh

# Create the services health check script
echo -e "${YELLOW}Creating health check script...${NC}"
cat > ${APP_DIR}/health_check.sh << EOF
#!/bin/bash
# Health check script for Voice AI services

# Configuration
SERVICES=("server" "postgres" "redis" "prometheus" "grafana")
SLACK_WEBHOOK_URL="\${SLACK_WEBHOOK_URL:-""}"
EMAIL_RECIPIENT="\${EMAIL_RECIPIENT:-""}"

# Check if services are running
for service in "\${SERVICES[@]}"; do
  status=\$(docker-compose ps -q \$service 2>/dev/null)
  
  if [ -z "\$status" ]; then
    echo "[\$(date)] ERROR: \$service is not running!"
    
    # Send Slack notification if webhook URL is provided
    if [ -n "\$SLACK_WEBHOOK_URL" ]; then
      curl -s -X POST -H 'Content-type: application/json' --data "{\"text\":\"⚠️ ALERT: Voice AI \$service is down!\"}" \$SLACK_WEBHOOK_URL
    fi
    
    # Send email notification if recipient is provided
    if [ -n "\$EMAIL_RECIPIENT" ]; then
      echo "Voice AI \$service is down! Please check the system." | mail -s "Voice AI Service Alert: \$service Down" \$EMAIL_RECIPIENT
    fi
    
    # Try to restart the service
    echo "Attempting to restart \$service..."
    docker-compose restart \$service
  else
    echo "[\$(date)] \$service is running."
  fi
done

# Check API health
api_health=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
if [ "\$api_health" != "200" ]; then
  echo "[\$(date)] ERROR: API health check failed with status \$api_health!"
  
  # Send notifications
  if [ -n "\$SLACK_WEBHOOK_URL" ]; then
    curl -s -X POST -H 'Content-type: application/json' --data "{\"text\":\"⚠️ ALERT: Voice AI API health check failed with status \$api_health!\"}" \$SLACK_WEBHOOK_URL
  fi
  
  if [ -n "\$EMAIL_RECIPIENT" ]; then
    echo "Voice AI API health check failed with status \$api_health!" | mail -s "Voice AI API Health Alert" \$EMAIL_RECIPIENT
  fi
else
  echo "[\$(date)] API health check passed."
fi
EOF

chmod +x ${APP_DIR}/health_check.sh

# Set up cron job for health checks
echo -e "${YELLOW}Setting up cron job for health checks...${NC}"
(crontab -l 2>/dev/null; echo "*/5 * * * * ${APP_DIR}/health_check.sh >> ${LOG_DIR}/health_check.log 2>&1") | crontab -

# Pull and start the services
echo -e "${YELLOW}Starting Voice AI services...${NC}"
cd ${APP_DIR}
docker-compose pull
docker-compose up -d

echo -e "${GREEN}"
echo "=========================================================="
echo "  Voice AI Production Deployment Complete!"
echo "=========================================================="
echo ""
echo "Services running:"
docker-compose ps
echo ""
echo "Monitoring dashboards:"
echo "- Grafana: http://localhost:3001 (admin/admin)"
echo "- Prometheus: http://localhost:9090"
echo ""
echo "Next steps:"
echo "1. Configure SSL using certbot for production security"
echo "2. Update ${ENV_FILE} with your production credentials"
echo "3. Deploy your trained models using ${APP_DIR}/deploy_models.sh"
echo "4. Set up your Grafana dashboards and alerts"
echo "5. Verify system health with ${APP_DIR}/health_check.sh"
echo -e "${NC}"
