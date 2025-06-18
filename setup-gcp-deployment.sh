#!/bin/bash

# Google Cloud Run Deployment Setup Script for Omics AI MCP
# This script helps set up the necessary GCP resources and GitHub secrets

set -e

echo "=== Google Cloud Run Deployment Setup for Omics AI MCP ==="
echo

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it first:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI is not installed. Please install it first:"
    echo "https://cli.github.com/manual/installation"
    exit 1
fi

# Get project ID
echo "Enter your Google Cloud Project ID:"
read -r PROJECT_ID

# Set the project
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo
echo "Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Create service account
SERVICE_ACCOUNT_NAME="omics-ai-mcp-deployer"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo
echo "Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Omics AI MCP Cloud Run Deployer" \
    --description="Service account for deploying Omics AI MCP to Cloud Run" || true

# Grant necessary permissions
echo
echo "Granting permissions to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/artifactregistry.admin"

# Create and download service account key
KEY_FILE="omics-ai-mcp-sa-key.json"
echo
echo "Creating service account key..."
gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SERVICE_ACCOUNT_EMAIL

# Configure GitHub repository secrets
echo
echo "Setting up GitHub repository secrets..."
echo "Make sure you're authenticated with GitHub CLI (gh auth login)"
echo

# Get repository name
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Setting secrets for repository: $REPO"

# Set GitHub secrets
gh secret set GCP_PROJECT_ID --body "$PROJECT_ID"
gh secret set GCP_SERVICE_ACCOUNT_KEY < $KEY_FILE

# Clean up the key file
rm -f $KEY_FILE

echo
echo "=== Setup Complete! ==="
echo
echo "Next steps:"
echo "1. Commit and push your changes to the main/master branch"
echo "2. The GitHub Action will automatically deploy to Cloud Run"
echo "3. You can also manually trigger deployment from the Actions tab"
echo
echo "Optional: Set up Cloud Build trigger for additional deployment options:"
echo "  - Visit: https://console.cloud.google.com/cloud-build/triggers"
echo "  - Create a new trigger connected to your GitHub repository"
echo "  - Use the cloudbuild.yaml file in the repository"
echo
echo "Your Cloud Run service will be available at:"
echo "https://omics-ai-mcp-<hash>-<region>.a.run.app"