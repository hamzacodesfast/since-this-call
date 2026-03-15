#!/bin/bash
# setup-vps.sh - Automated setup for Since This Call on Hetzner VPS

# 1. Update & Install Dependencies
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git curl

# 2. Configure Firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw --force enable

# 3. Create Deployment Directory
mkdir -p ~/since-this-call
cd ~/since-this-call

# 4. We will need to pull the code
# (Assuming the user will clone their repo here)
echo "--------------------------------------------------------"
echo "✅ SERVER PREPARED!"
echo "Next steps:"
echo "1. Clone your git repository into this folder."
echo "2. Copy your .env.production variables into a .env file."
echo "3. Run: sudo docker-compose up -d --build"
echo "--------------------------------------------------------"
