#!/bin/bash

# Complete Setup Script for Omics AI MCP on Google Cloud Run
# This consolidates all setup steps into one script

set -e

echo "==================================================================="
echo "=== Complete Setup for Omics AI MCP on Google Cloud Run ==="
echo "==================================================================="
echo

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it first:"
    echo "brew install --cask google-cloud-sdk"
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI is not installed. Please install it first:"
    echo "brew install gh"
    exit 1
fi

# Get project ID
echo
echo "Enter your Google Cloud Project ID:"
read -r PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo "Error: Project ID is required"
    exit 1
fi

# Configuration
REGION="us-central1"
SERVICE_ACCOUNT_NAME="omics-ai-mcp-deployer"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
ARTIFACT_REGISTRY_REPO="cloud-run-images"

echo
echo "Configuration:"
echo "- Project ID: $PROJECT_ID"
echo "- Region: $REGION"
echo "- Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "- Artifact Registry Repository: $ARTIFACT_REGISTRY_REPO"
echo
echo "Press Enter to continue or Ctrl+C to cancel..."
read -r

# Set the project
echo
echo "Setting Google Cloud project..."
gcloud config set project "$PROJECT_ID"

# Enable all required APIs
echo
echo "Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable iam.googleapis.com

# Wait for APIs to be ready
echo "Waiting for APIs to be fully enabled..."
sleep 5

# Create service account if it doesn't exist
echo
echo "Creating service account (if not exists)..."
if ! gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL &>/dev/null; then
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="Omics AI MCP Cloud Run Deployer" \
        --description="Service account for deploying Omics AI MCP to Cloud Run"
    echo "Service account created successfully"
else
    echo "Service account already exists"
fi

# Grant all necessary permissions
echo
echo "Granting permissions to service account..."

ROLES=(
    "roles/run.admin"
    "roles/storage.admin"
    "roles/iam.serviceAccountUser"
    "roles/artifactregistry.admin"
    "roles/cloudbuild.builds.editor"
)

for ROLE in "${ROLES[@]}"; do
    echo "  Adding $ROLE..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="$ROLE" \
        --quiet
done

# Create Artifact Registry repository
echo
echo "Creating Artifact Registry repository (if not exists)..."
if ! gcloud artifacts repositories describe $ARTIFACT_REGISTRY_REPO --location=$REGION &>/dev/null; then
    gcloud artifacts repositories create $ARTIFACT_REGISTRY_REPO \
        --repository-format=docker \
        --location=$REGION \
        --description="Docker images for Cloud Run services"
    echo "Artifact Registry repository created successfully"
else
    echo "Artifact Registry repository already exists"
fi

# Configure Docker authentication for Artifact Registry
echo
echo "Configuring Docker authentication for Artifact Registry..."
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

# Check if we're in a git repository
if ! git rev-parse --git-dir &>/dev/null; then
    echo
    echo "Error: Not in a git repository. Please run this from your omics-ai-mcp directory."
    exit 1
fi

# Get repository information
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")

if [ -z "$REPO" ]; then
    echo
    echo "Error: Could not determine GitHub repository. Make sure you're authenticated with 'gh auth login'"
    exit 1
fi

echo
echo "Configuring GitHub repository secrets for: $REPO"

# Create new service account key
KEY_FILE="omics-ai-mcp-sa-key.json"
echo "Creating service account key..."
gcloud iam service-accounts keys create "$KEY_FILE" \
    --iam-account=$SERVICE_ACCOUNT_EMAIL \
    --quiet

# Set GitHub secrets
echo "Setting GitHub secrets..."
gh secret set GCP_PROJECT_ID --body "$PROJECT_ID"
gh secret set GCP_SERVICE_ACCOUNT_KEY < "$KEY_FILE"

# Clean up key file
rm -f "$KEY_FILE"

# Display summary
echo
echo "==================================================================="
echo "=== Setup Complete! ==="
echo "==================================================================="
echo
echo "✅ All Google Cloud APIs enabled"
echo "✅ Service account created with necessary permissions"
echo "✅ Artifact Registry repository created"
echo "✅ Docker authentication configured"
echo "✅ GitHub secrets configured"
echo
echo "Next steps:"
echo "1. Commit and push your code to trigger deployment:"
echo "   git add ."
echo "   git commit -m 'Deploy to Cloud Run'"
echo "   git push origin main"
echo
echo "2. Monitor deployment at:"
echo "   https://github.com/$REPO/actions"
echo
echo "3. Your service will be deployed to:"
echo "   https://omics-ai-mcp-<hash>-$REGION.a.run.app"
echo
echo "Docker images will be stored at:"
echo "   $REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REGISTRY_REPO/omics-ai-mcp"