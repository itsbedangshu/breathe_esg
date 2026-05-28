#!/bin/bash
# Breathe ESG Platform Startup Script
# Automatically launches the Django REST Backend & Vite React Frontend concurrently.

set -e

# Color Helpers for Beautiful Console output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}================================================================${NC}"
echo -e "${GREEN}             BREATHE ESG - COMPLIANCE LEDGER PLATFORM           ${NC}"
echo -e "${CYAN}================================================================${NC}"

# Step 1: Initialize Database migrations and seeds
echo -e "\n${BLUE}[1/3] Preparing Django REST compliance database...${NC}"
cd breathe_esg_backend
python3 -m pip install -r requirements.txt || true
python3 manage.py migrate
python3 manage.py seed_data

# Step 2: Ensure Node modules and compile frontend assets
echo -e "\n${BLUE}[2/3] Preparing React/Vite Compliance Dashboard...${NC}"
cd ../breathe_esg_frontend
npm install

# Step 3: Run both services concurrently
echo -e "\n${BLUE}[3/3] Launching Breathe ESG Platform...${NC}"
echo -e "${GREEN}  -> Django REST API running at: http://localhost:8000/api/${NC}"
echo -e "${GREEN}  -> React Compliance Dashboard running at: http://localhost:5173/${NC}"
echo -e "${CYAN}================================================================${NC}"

# Function to kill all child background processes on exit
cleanup() {
  echo -e "\n${CYAN}Shutting down Breathe ESG services...${NC}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start Django Backend
cd ../breathe_esg_backend
python3 manage.py runserver 8000 > /dev/null 2>&1 &
BACKEND_PID=$!

# Start Vite Frontend
cd ../breathe_esg_frontend
npm run dev -- --port 5173 > /dev/null 2>&1 &
FRONTEND_PID=$!

# Keep shell active to stream status
while true; do
  sleep 1
done
