#!/bin/bash

# Fix Google Container Registry permissions for GitHub Actions

set -e

echo "=== Fixing GCR Permissions ==="
echo

# Get project ID
echo "Enter your Google Cloud Project ID:"
read -r PROJECT_ID

# Set the project
gcloud config set project "$PROJECT_ID"

SERVICE_ACCOUNT_EMAIL="omics-ai-mcp-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

echo
echo "Adding Container Registry permissions..."

# Add Storage Admin role (needed for GCR)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/storage.admin"

# Add Artifact Registry Writer role
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/artifactregistry.writer"

# Enable Container Registry API
echo
echo "Enabling Container Registry API..."
gcloud services enable containerregistry.googleapis.com

# Enable Artifact Registry API (GCR is being migrated to AR)
echo
echo "Enabling Artifact Registry API..."
gcloud services enable artifactregistry.googleapis.com

echo
echo "=== Permissions Updated! ==="
echo "Please re-run the GitHub Action to deploy."
echo
echo "If you still encounter issues, you may need to:"
echo "1. Wait a few minutes for permissions to propagate"
echo "2. Create a new service account key and update the GitHub secret"