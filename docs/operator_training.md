# Voice AI System - Operator Training Guide

## Introduction

This guide is designed for system operators and administrators responsible for managing and maintaining the Voice AI calling system. It covers essential information for daily operations, troubleshooting, and system optimization.

## System Architecture Overview

### Components

The Voice AI system consists of several key components:

1. **Server Application**: Node.js backend handling API requests, business logic, and integrations
2. **Client Application**: React-based frontend for user interaction
3. **Machine Learning Models**: Emotion detection and conversation management models
4. **Database**: PostgreSQL database for persistent storage
5. **Redis**: For caching and session management
6. **Telephony Integration**: Twilio integration for call handling
7. **Speech Services**: ElevenLabs integration for voice synthesis
8. **Monitoring Stack**: Prometheus and Grafana for system monitoring

### Data Flow

1. Campaign creation and configuration in the frontend
2. Lead data import and processing
3. Call scheduling and execution
4. Real-time processing of conversations
5. Post-call analysis and reporting
6. Data synchronization with CRM systems

## Daily Operations

### System Health Checks

Perform these checks at the beginning of each day:

1. **Service Status**:
   ```bash
   cd /opt/voice-ai
   docker-compose ps
   ```

2. **API Health**:
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Database Connectivity**:
   ```bash
   docker-compose exec postgres pg_isready -U voice_ai -d voice_ai_db
   ```

4. **Resource Usage**:
   ```bash
   docker stats
   ```

### Campaign Management

#### Starting a Campaign

1. Verify lead data quality
2. Check telephony provider balance
3. Confirm voice model availability
4. Start campaign with appropriate call volume settings
5. Monitor initial calls for quality

#### Pausing/Stopping a Campaign

1. Use graceful stop option to complete in-progress calls
2. Generate interim reports
3. Back up campaign data
4. Address any issues before restarting

### Call Monitoring

1. Access the live call dashboard
2. Review real-time metrics
3. Listen to sample calls for quality assurance
4. Check for error patterns

## Regular Maintenance Tasks

### Database Maintenance

Weekly tasks:
1. Run database vacuum:
   ```bash
   docker-compose exec postgres vacuumdb -U voice_ai -d voice_ai_db --analyze
   ```

2. Check for slow queries:
   ```bash
   docker-compose exec postgres psql -U voice_ai -d voice_ai_db -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
   ```

### Log Management

1. Rotate logs:
   ```bash
   cd /opt/voice-ai
   ./log_rotate.sh
   ```

2. Archive old logs:
   ```bash
   find /opt/voice-ai/logs -type f -name "*.log.*" -mtime +30 -exec gzip {} \;
   ```

3. Analyze error patterns:
   ```bash
   grep -i "error" /opt/voice-ai/logs/server-stderr.log | sort | uniq -c | sort -nr
   ```

### Backup Procedures

1. Database backup:
   ```bash
   cd /opt/voice-ai
   ./backup.sh
   ```

2. Verify backup integrity:
   ```bash
   cd /opt/voice-ai/backups/latest
   gunzip < database.sql.gz | head -n 20
   ```

3. Test restoration procedure quarterly

## Model Management

### Deploying New Models

1. Validate model performance in staging environment
2. Schedule deployment during low-traffic period
3. Deploy models:
   ```bash
   cd /opt/voice-ai
   ./deploy_models.sh /path/to/new/models
   ```

4. Verify model loading:
   ```bash
   curl http://localhost:3000/api/voice-ai/model-status
   ```

5. Monitor performance metrics after deployment

### Model Versioning

Keep track of deployed models:
1. Document model version in the model registry
2. Record performance metrics for each version
3. Maintain ability to rollback to previous versions

## Troubleshooting

### Common Issues and Solutions

#### Call Quality Issues

**Symptoms**: Choppy audio, call drops, poor voice quality

**Solutions**:
1. Check network latency to telephony provider
   ```bash
   ping api.twilio.com
   ```
2. Verify voice synthesis service status
   ```bash
   curl -I https://api.elevenlabs.io/v1/status
   ```
3. Check system resource usage
   ```bash
   docker stats
   ```
4. Review error logs for specific error codes
   ```bash
   grep -i "audio" /opt/voice-ai/logs/server-stderr.log | tail -50
   ```

#### High CPU/Memory Usage

**Symptoms**: System slowdown, timeouts, container restarts

**Solutions**:
1. Identify resource-intensive containers
   ```bash
   docker stats --no-stream
   ```
2. Check for memory leaks
   ```bash
   docker-compose exec server node --inspect
   ```
3. Scale horizontal resources if needed
   ```bash
   docker-compose up -d --scale server=2
   ```
4. Optimize database queries
   ```bash
   docker-compose exec postgres psql -U voice_ai -d voice_ai_db -c "EXPLAIN ANALYZE SELECT * FROM calls ORDER BY created_at DESC LIMIT 10;"
   ```

#### Database Connectivity Issues

**Symptoms**: Application errors, failed queries, timeouts

**Solutions**:
1. Check database container status
   ```bash
   docker-compose ps postgres
   ```
2. Verify network connectivity
   ```bash
   docker-compose exec server ping postgres
   ```
3. Check database logs
   ```bash
   docker-compose logs postgres
   ```
4. Restart database if necessary
   ```bash
   docker-compose restart postgres
   ```

### Emergency Procedures

#### System Outage

1. Assess the scope of the outage
2. Stop all active campaigns
3. Notify stakeholders
4. Restore from last known good configuration
5. Verify system functionality before resuming operations
6. Document the incident for post-mortem analysis

#### Data Breach

1. Isolate affected systems
2. Assess the scope of the breach
3. Notify security team and management
4. Follow data breach notification procedures
5. Implement recommended security measures
6. Document the incident and response

## Performance Optimization

### Server Performance

1. Optimize Node.js settings:
   ```
   NODE_OPTIONS="--max-old-space-size=4096"
   ```
2. Tune database connection pooling
3. Implement efficient caching strategies
4. Schedule resource-intensive tasks during off-peak hours

### Model Optimization

1. Batch processing for emotion analysis
2. Cache common responses
3. Use model quantization for production
4. Implement progressive loading for large models

## Security Practices

### Access Management

1. Follow the principle of least privilege
2. Regularly audit user access
3. Implement multi-factor authentication
4. Rotate access credentials quarterly

### Data Protection

1. Ensure encryption at rest and in transit
2. Implement data anonymization for sensitive information
3. Follow data retention policies
4. Perform regular security scans

### Audit Procedures

1. Review access logs weekly
2. Monitor failed login attempts
3. Track system configuration changes
4. Document all maintenance activities

## Monitoring and Alerting

### Key Metrics to Monitor

1. **System Health**:
   - CPU and memory usage
   - Disk space
   - Network throughput

2. **Application Performance**:
   - API response times
   - Error rates
   - Request volume

3. **Call Metrics**:
   - Call success rate
   - Average call duration
   - Emotion detection accuracy
   - Voice synthesis performance

### Setting Up Alerts

1. Configure Prometheus alerting rules
2. Set up notification channels (email, Slack, SMS)
3. Establish escalation procedures
4. Define SLAs and alert thresholds

## Disaster Recovery

### Backup Strategy

1. Daily database backups
2. Weekly full system backups
3. Offsite backup storage
4. Regular backup validation

### Recovery Procedures

1. Database restoration:
   ```bash
   cat backup.sql | docker-compose exec -T postgres psql -U voice_ai -d voice_ai_db
   ```

2. Full system restoration:
   ```bash
   cd /opt/voice-ai
   ./restore.sh /path/to/backup
   ```

3. Verification steps after recovery

## Appendix

### Reference Commands

```bash
# Check system status
docker-compose ps

# View logs
docker-compose logs -f server

# Monitor resources
docker stats

# Database backup
docker-compose exec postgres pg_dump -U voice_ai voice_ai_db > backup.sql

# Database restore
cat backup.sql | docker-compose exec -T postgres psql -U voice_ai -d voice_ai_db

# Restart specific service
docker-compose restart server

# Update system
git pull
docker-compose build
docker-compose up -d

# Check API health
curl http://localhost:3000/api/health

# View prometheus metrics
curl http://localhost:3000/metrics
```

### Contact Information

- **Technical Support**: tech-support@voiceai.example.com
- **Security Team**: security@voiceai.example.com
- **DevOps Team**: devops@voiceai.example.com
- **Emergency Hotline**: +1-555-987-6543
