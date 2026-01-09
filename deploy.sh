#!/bin/bash

# Configuration - CHANGE THESE
USER="your_cpanel_username"
HOST="your_domain_or_ip"
REMOTE_DIR="~/sincethiscall" # The folder you created in cPanel

echo "🚀 Starting Deployment to $HOST..."

# 1. Build Locally (Faster than building on shared hosting)
echo "📦 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build Successful."
else
    echo "❌ Build Failed. Aborting."
    exit 1
fi

# 2. Sync Files via RSYNC
# Authenticates via SSH. Requires you to have set up SSH keys.
# We exclude node_modules to save bandwidth, we'll install production deps on server.
echo "aaS Syncing files used rsync..."
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env.local' \
    --exclude '.next/cache' \
    -e "ssh -p 21098" \
    ./ $USER@$HOST:$REMOTE_DIR

# Note: Namecheap SSH usually uses port 21098. If yours is 22, remove `-p 21098`.

# 3. Install Deps & Restart on Server
echo "🔄 Installing dependencies and restarting server..."
ssh -p 21098 $USER@$HOST << EOF
    cd $REMOTE_DIR
    # Install only production dependencies
    npm install --production
    
    # Touch restart.txt to trigger Phusion Passenger restart (Standard cPanel method)
    mkdir -p tmp
    touch tmp/restart.txt
EOF

echo "🎉 Deployment Complete!"
