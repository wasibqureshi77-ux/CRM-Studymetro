#!/bin/bash
set -e

echo "🚀 Starting CRM-Studymetro Remote VPS Deployment..."

cd /var/www/CRM-Studymetro

echo "📥 Pulling latest code changes from origin/main..."
git pull origin main

echo "📦 Installing npm dependencies..."
npm install

echo "🗄️ Running Prisma migrations..."
cd apps/api
npx prisma migrate deploy
cd ../..

echo "🔨 Building API..."
npm run build:api

echo "🔨 Building Web..."
npm run build:web

echo "🔄 Restarting services in PM2..."
pm2 restart study-metro-api || pm2 start dist/src/main.js --name "study-metro-api"
pm2 restart study-metro-web || pm2 start "npm run start -w apps/web" --name "study-metro-web"
pm2 save

echo "🎉 Deployment completed successfully!"
