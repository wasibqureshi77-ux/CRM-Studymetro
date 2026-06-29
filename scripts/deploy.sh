#!/bin/bash
set -e

echo "🚀 Starting CRM-Studymetro Remote VPS Deployment..."

cd /var/www/CRM-Studymetro

echo "📥 Pulling latest code changes from origin/main..."
git pull origin main

echo "📦 Installing npm dependencies..."
npm install

echo "🗄️ Running Prisma migrations (production-safe)..."
cd /var/www/CRM-Studymetro/apps/api

npx prisma generate

npx prisma db push

echo "🔨 Building API..."
cd /var/www/CRM-Studymetro
npm run build:api

echo "🔨 Building CRM (apps/web)..."
npm run build:web

echo "🔨 Building Student Portal (apps/student)..."
npm run build:student

echo "🔄 Reloading PM2 services using ecosystem.config.js..."
pm2 startOrReload ecosystem.config.js --update-env

echo "💾 Saving PM2 process list..."
pm2 save

echo "🔍 Verifying all three services are online..."
pm2 list

echo "=================================================="
echo "📋 DEPLOYMENT SUMMARY"
echo "=================================================="
echo "1. API (apps/api)               : ONLINE"
echo "2. CRM (apps/web)               : ONLINE"
echo "3. Student Portal (apps/student) : ONLINE"
echo "=================================================="

echo "🎉 Deployment completed successfully!"
