#!/bin/bash
#
# Production setup script
# This script sets up the production environment for the voice AI calling system
#

set -e  # Exit on any error

# Text colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="16.14.0"
APP_DIR="/opt/lumina-outreach"
LOG_DIR="${APP_DIR}/logs"
DATA_DIR="${APP_DIR}/data"
BACKUP_DIR="${APP_DIR}/backups"
ENV_FILE="${APP_DIR}/.env.production"
USER="lumina-outreach"
GROUP="lumina-outreach"

# Banner
echo -e "${GREEN}"
echo "=========================================================="
echo "  Lumina Outreach Production Setup"
echo "  $(date)"
echo "=========================================================="
echo -e "${NC}"

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root or with sudo privileges${NC}"
  exit 1
fi

# Create directories
echo -e "${YELLOW}Creating application directories...${NC}"
mkdir -p ${APP_DIR}
mkdir -p ${LOG_DIR}
mkdir -p ${DATA_DIR}
mkdir -p ${BACKUP_DIR}
mkdir -p ${APP_DIR}/tmp
mkdir -p ${APP_DIR}/uploads
mkdir -p ${LOG_DIR}/audit

# Create user and group if they don't exist
echo -e "${YELLOW}Setting up application user...${NC}"
id -u ${USER} &>/dev/null || useradd -m -d ${APP_DIR} -s /bin/bash ${USER}
getent group ${GROUP} || groupadd ${GROUP}

# Install dependencies
echo -e "${YELLOW}Installing system dependencies...${NC}"
apt-get update
apt-get install -y curl build-essential git ffmpeg redis-server supervisor nginx certbot python3-certbot-nginx

# Install NVM and Node.js
echo -e "${YELLOW}Installing Node.js ${NODE_VERSION}...${NC}"
if ! command -v nvm &> /dev/null; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
  nvm install ${NODE_VERSION}
  nvm alias default ${NODE_VERSION}
fi

# Check if Yarn is installed
if ! command -v yarn &> /dev/null; then
  echo -e "${YELLOW}Installing Yarn...${NC}"
  npm install -g yarn
fi

# Setup Python environment
echo -e "${YELLOW}Setting up Python environment...${NC}"
apt-get install -y python3 python3-pip python3-venv

# Create Python virtual environment
if [ ! -d "${APP_DIR}/venv" ]; then
  echo -e "${YELLOW}Creating Python virtual environment...${NC}"
  python3 -m venv ${APP_DIR}/venv
  ${APP_DIR}/venv/bin/pip install --upgrade pip
fi

# Configure Nginx
echo -e "${YELLOW}Setting up Nginx configuration...${NC}"
cat > /etc/nginx/sites-available/lumina-outreach << EOF
server {
    listen 80;
    server_name lumina-outreach.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; media-src 'self'" always;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/lumina-outreach /etc/nginx/sites-enabled/

# Setup Supervisor to manage the Node process
echo -e "${YELLOW}Setting up Supervisor configuration...${NC}"
cat > /etc/supervisor/conf.d/lumina-outreach.conf << EOF
[program:lumina-outreach-server]
command=node dist/index.js
directory=${APP_DIR}/server
user=${USER}
autostart=true
autorestart=true
environment=NODE_ENV=production
stdout_logfile=${LOG_DIR}/server-stdout.log
stderr_logfile=${LOG_DIR}/server-stderr.log
EOF

# Create environment template file
echo -e "${YELLOW}Creating environment file template...${NC}"
cat > ${ENV_FILE}.template << EOF
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
API_PREFIX=/api
CORS_ORIGIN=https://lumina-outreach.example.com
TRUST_PROXY=true
UPLOAD_DIR=${APP_DIR}/uploads
TEMP_DIR=${APP_DIR}/tmp

# Security Configuration
JWT_SECRET=REPLACE_WITH_SECURE_SECRET
JWT_EXPIRATION=24h
ENCRYPTION_KEY=REPLACE_WITH_ENCRYPTION_KEY
ENCRYPT_SENSITIVE_DATA=true
SECURITY_HEADERS=true
API_KEY_AUTH=true
JWT_AUTH=true
AUDIT_ENABLED=true
AUDIT_LOG_DIR=${LOG_DIR}/audit

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/lumina_outreach
DATABASE_SSL=false
DATABASE_POOL_SIZE=10
DATABASE_TIMEOUT=30000
DATABASE_RETRY_ATTEMPTS=3

# Telephony Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBERS=+15551234567,+15557654321
TWILIO_DEFAULT_NUMBER=+15551234567
WEBHOOK_BASE_URL=https://lumina-outreach.example.com/api/webhooks
RECORD_CALLS=true
TELEPHONY_FALLBACK_ENABLED=true

# Speech Configuration
SPEECH_PROVIDER=elevenlabs
ELEVEN_LABS_API_KEY=your_eleven_labs_api_key
SPEECH_OUTPUT_DIR=${APP_DIR}/tmp/audio
SPEECH_FALLBACK_ENABLED=true
DEFAULT_VOICE_ID=your_default_voice_id

# ML Configuration
MODELS_DIR=${APP_DIR}/../training/models
ML_CACHING_ENABLED=true
ML_BATCH_SIZE=16
TF_NUM_THREADS=4
EMOTION_DETECTION_ENABLED=true

# Redis Configuration
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=3600

# Monitoring Configuration
MONITORING_ENABLED=true
PROMETHEUS_ENABLED=true
HEALTH_CHECK_INTERVAL=60000
ALERTS_ENABLED=true
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
CPU_WARNING_THRESHOLD=70
CPU_CRITICAL_THRESHOLD=90
MEMORY_WARNING_THRESHOLD=70
MEMORY_CRITICAL_THRESHOLD=90
API_LATENCY_WARNING=2000
API_LATENCY_CRITICAL=5000

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=true
LOG_DIR=${LOG_DIR}
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7
SENTRY_DSN=your_sentry_dsn

# CRM Configuration
CRM_PROVIDER=your_crm_provider
CRM_API_KEY=your_crm_api_key
CRM_API_URL=https://your-crm-api-url.com
CRM_SYNC_ENABLED=true
CRM_SYNC_INTERVAL=300000
CRM_SYNC_MAX_RETRIES=3
EOF

echo -e "${YELLOW}Setting correct permissions...${NC}"
chown -R ${USER}:${GROUP} ${APP_DIR}
chmod -R 750 ${APP_DIR}
chmod -R 770 ${LOG_DIR} ${DATA_DIR} ${APP_DIR}/tmp ${APP_DIR}/uploads

# Create backup script
echo -e "${YELLOW}Creating backup script...${NC}"
cat > ${APP_DIR}/backup.sh << EOF
#!/bin/bash
# Backup script for Lumina Outreach

TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=${BACKUP_DIR}/\${TIMESTAMP}

mkdir -p \${BACKUP_DIR}

# Backup database
pg_dump lumina_outreach > \${BACKUP_DIR}/database.sql

# Backup models
tar -czf \${BACKUP_DIR}/models.tar.gz ${APP_DIR}/../training/models

# Backup environment files
cp ${ENV_FILE} \${BACKUP_DIR}/

# Backup logs (optional)
# tar -czf \${BACKUP_DIR}/logs.tar.gz ${LOG_DIR}

# Create manifest
echo "Lumina Outreach Backup - \${TIMESTAMP}" > \${BACKUP_DIR}/manifest.txt
echo "===========================================" >> \${BACKUP_DIR}/manifest.txt
echo "Database: database.sql" >> \${BACKUP_DIR}/manifest.txt
echo "Models: models.tar.gz" >> \${BACKUP_DIR}/manifest.txt
echo "Environment: .env.production" >> \${BACKUP_DIR}/manifest.txt

# Clean up old backups (keep last 7)
ls -tr ${BACKUP_DIR} | head -n -7 | xargs -I {} rm -rf ${BACKUP_DIR}/{}
EOF

chmod +x ${APP_DIR}/backup.sh
chown ${USER}:${GROUP} ${APP_DIR}/backup.sh

# Set up cron job for backups
echo -e "${YELLOW}Setting up backup cron job...${NC}"
(crontab -l 2>/dev/null; echo "0 2 * * * ${APP_DIR}/backup.sh > ${LOG_DIR}/backup.log 2>&1") | crontab -

# Final setup message
echo -e "${GREEN}"
echo "=========================================================="
echo "  Production setup completed!"
echo "=========================================================="
echo ""
echo "Next steps:"
echo "1. Edit ${ENV_FILE}.template with your actual values"
echo "2. Rename to ${ENV_FILE} when ready"
echo "3. Deploy your application code to ${APP_DIR}"
echo "4. Run: supervisorctl reload"
echo "5. Set up SSL with: certbot --nginx -d lumina-outreach.example.com"
echo ""
echo "For manual startup:"
echo "supervisorctl start lumina-outreach-server"
echo -e "${NC}"

# Ask to configure SSL now
read -p "Would you like to configure SSL now? (y/n): " configure_ssl
if [[ "$configure_ssl" =~ ^[Yy]$ ]]; then
  read -p "Enter your domain name (e.g., lumina-outreach.example.com): " domain_name
  certbot --nginx -d ${domain_name}
else
  echo -e "${YELLOW}Remember to configure SSL later for production security${NC}"
fi