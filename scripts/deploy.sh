#!/bin/bash

# Post-Master Pro Deployment Script
# Usage: ./scripts/deploy.sh [environment]

set -e  # Exit on error

ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$TIMESTAMP"

echo "🚀 Starting Post-Master Pro deployment..."
echo "📦 Environment: $ENVIRONMENT"
echo "⏰ Timestamp: $TIMESTAMP"

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
  source ".env.$ENVIRONMENT"
  echo "✅ Loaded environment variables from .env.$ENVIRONMENT"
else
  echo "❌ Environment file .env.$ENVIRONMENT not found"
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo "📂 Backup directory: $BACKUP_DIR"

# 1. Backup database
echo "🔍 Backing up database..."
if command -v pg_dump &> /dev/null; then
  pg_dump "$DATABASE_URL" > "$BACKUP_DIR/database.sql"
  echo "✅ Database backup created"
else
  echo "⚠️ pg_dump not found, skipping database backup"
fi

# 2. Backup logs
echo "📝 Backing up logs..."
if [ -d "./logs" ]; then
  cp -r ./logs/* "$BACKUP_DIR/" 2>/dev/null || true
  echo "✅ Logs backed up"
fi

# 3. Stop existing process
echo "🛑 Stopping existing process..."
pm2 stop post-master-backend 2>/dev/null || true
pm2 delete post-master-backend 2>/dev/null || true
echo "✅ Processes stopped"

# 4. Update code
echo "🔄 Updating code from Git..."
git pull origin main
echo "✅ Code updated"

# 5. Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production
echo "✅ Dependencies installed"

# 6. Run migrations
echo "🗄️ Running database migrations..."
npm run migrate:up
echo "✅ Migrations completed"

# 7. Build if needed
echo "🏗️ Building project..."
# Add build steps if using TypeScript or other build process
echo "✅ Build completed"

# 8. Start application
echo "🚀 Starting application..."
pm2 start ecosystem.config.js
echo "✅ Application started"

# 9. Health check
echo "🏥 Performing health check..."
sleep 5  # Wait for app to start
curl -f http://localhost:$PORT/health || {
  echo "❌ Health check failed"
  exit 1
}
echo "✅ Health check passed"

# 10. Cleanup old backups (keep last 7 days)
echo "🧹 Cleaning up old backups..."
find ./backups -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
echo "✅ Cleanup completed"

# 11. Log deployment
echo "📝 Logging deployment..."
echo "$TIMESTAMP - $ENVIRONMENT deployment completed" >> ./logs/deployments.log

echo "🎉 Deployment completed successfully!"
echo "📊 Monitor logs: pm2 logs post-master-backend"
echo "🔄 Restart if needed: pm2 restart post-master-backend"
echo "🛑 Stop: pm2 stop post-master-backend"