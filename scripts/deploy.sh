#!/bin/bash
set -e

echo "🚀 Starting CRM-Studymetro Remote VPS Stateless Deployment..."

cd /var/www/CRM-Studymetro

# 1. Repository Reset
echo "--------------------------------------------------"
echo "📋 STEP 1: Repository Reset"
echo "--------------------------------------------------"
echo "📥 Fetching latest changes from GitHub origin..."
git fetch origin

echo "🔄 Hard resetting local branch to origin/main..."
git reset --hard origin/main

echo "🧹 Cleaning untracked files safely (preserving persistent storage & environment configs)..."
git clean -fd \
  -e "apps/api/uploads" \
  -e "uploads" \
  -e "storage" \
  -e "logs" \
  -e "sessions" \
  -e ".env*"

echo "✅ Step 1 complete: Repository reset and cleaned successfully."

# 2. Dependency Install
echo "--------------------------------------------------"
echo "📋 STEP 2: Dependency Install"
echo "--------------------------------------------------"
if [ -f "package-lock.json" ]; then
  echo "📦 Installing dependencies using npm ci..."
  npm ci
else
  echo "⚠️ package-lock.json not found. Falling back to npm install..."
  npm install
fi
echo "✅ Step 2 complete: Dependencies installed successfully."

# 3. Prisma generate & db push
echo "--------------------------------------------------"
echo "📋 STEP 3: Prisma Schema Sync"
echo "--------------------------------------------------"
cd apps/api

echo "⚙️ Generating Prisma Client..."
npx prisma generate

echo "🗄️ Pushing schema changes to the database..."
npx prisma db push

cd /var/www/CRM-Studymetro
echo "✅ Step 3 complete: Prisma schema generated and database pushed successfully."

# 4. API Build
echo "--------------------------------------------------"
echo "📋 STEP 4: API Build"
echo "--------------------------------------------------"
echo "🔨 Building Nest.js API..."
npm run build:api
echo "✅ Step 4 complete: Nest.js API built successfully."

# 5. CRM Build
echo "--------------------------------------------------"
echo "📋 STEP 5: CRM Build"
echo "--------------------------------------------------"
echo "🔨 Building CRM Web Frontend (apps/web)..."
npm run build:web
echo "✅ Step 5 complete: CRM Web Frontend built successfully."

# 6. Student Portal Build
echo "--------------------------------------------------"
echo "📋 STEP 6: Student Portal Build"
echo "--------------------------------------------------"
echo "🔨 Building Student Portal Frontend (apps/student)..."
npm run build:student
echo "✅ Step 6 complete: Student Portal Frontend built successfully."

# 7. PM2 Restart (only reached if all builds succeeded)
echo "--------------------------------------------------"
echo "📋 STEP 7: Restarting Application Services"
echo "--------------------------------------------------"
echo "🔄 Reloading PM2 services using ecosystem.config.js..."
pm2 startOrReload ecosystem.config.js --update-env

echo "💾 Saving PM2 process configurations..."
pm2 save

echo "🔍 Verifying active services..."
pm2 list
echo "✅ Step 7 complete: All services reloaded and running."

echo "=================================================="
echo "🏁 STATELESS DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "=================================================="
