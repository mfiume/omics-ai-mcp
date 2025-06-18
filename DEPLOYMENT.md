# Deploying Omics AI MCP to Google Cloud Run

This guide explains how to deploy the Omics AI MCP server to Google Cloud Run with automatic deployments triggered by GitHub commits.

## Prerequisites

1. **Google Cloud Account**: You need a Google Cloud account with billing enabled
2. **Google Cloud CLI**: Install the `gcloud` CLI tool ([installation guide](https://cloud.google.com/sdk/docs/install))
3. **GitHub CLI**: Install the `gh` CLI tool ([installation guide](https://cli.github.com/manual/installation))
4. **GitHub Repository**: Your code should be in a GitHub repository

## Architecture Overview

The deployment uses:
- **Google Cloud Run**: Serverless container platform for running the MCP server
- **Google Container Registry**: Stores Docker images
- **GitHub Actions**: Automates deployment on code pushes
- **HTTP Wrapper**: Converts the stdio-based MCP server to HTTP endpoints

## Setup Instructions

### 1. Initial Setup

Run the setup script to configure Google Cloud and GitHub:

```bash
./setup-gcp-deployment.sh
```

This script will:
- Enable required Google Cloud APIs
- Create a service account with necessary permissions
- Configure GitHub repository secrets
- Set up authentication between GitHub and Google Cloud

### 2. Configuration

The deployment can be customized by modifying:

- **Region**: Edit `REGION` in `.github/workflows/deploy-to-cloud-run.yml` (default: `us-central1`)
- **Memory**: Edit `--memory` flag in the workflow (default: `512Mi`)
- **Max Instances**: Edit `--max-instances` flag (default: `100`)
- **Authentication**: Remove `--allow-unauthenticated` to require authentication

### 3. Deploy

Deployment happens automatically when you:
- Push to the `main` or `master` branch
- Manually trigger the workflow from GitHub Actions tab

```bash
git add .
git commit -m "Deploy to Cloud Run"
git push origin main
```

## HTTP API Endpoints

Once deployed, your MCP server exposes these HTTP endpoints:

### Health Check
```bash
GET /
```

### Create Session
```bash
POST /session
Response: { "sessionId": "uuid" }
```

### Send Message
```bash
POST /session/:sessionId/message
Body: { "message": { /* JSON-RPC message */ } }
```

### Close Session
```bash
DELETE /session/:sessionId
```

### List Sessions
```bash
GET /sessions
```

## Using the Deployed MCP Server

### Example: List Collections

```bash
# Create a session
SESSION_ID=$(curl -X POST https://your-service-url.run.app/session | jq -r .sessionId)

# Send a list_collections request
curl -X POST https://your-service-url.run.app/session/$SESSION_ID/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "jsonrpc": "2.0",
      "method": "tools/call",
      "params": {
        "name": "list_collections",
        "arguments": {
          "network": "hifisolves"
        }
      },
      "id": 1
    }
  }'

# Close the session when done
curl -X DELETE https://your-service-url.run.app/session/$SESSION_ID
```

## Alternative: Cloud Build Triggers

You can also set up Cloud Build triggers for deployment:

1. Visit [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click "Create Trigger"
3. Connect your GitHub repository
4. Configure:
   - Name: `deploy-omics-ai-mcp`
   - Event: Push to branch
   - Branch: `^(main|master)$`
   - Configuration: Cloud Build configuration file
   - File location: `/cloudbuild.yaml`

## Monitoring and Logs

- **View Logs**: `gcloud run services logs read omics-ai-mcp --region=us-central1`
- **Cloud Console**: Visit [Cloud Run Console](https://console.cloud.google.com/run)
- **Metrics**: Available in the Cloud Run service details page

## Troubleshooting

### Build Fails
- Check GitHub Actions logs for detailed error messages
- Ensure all required APIs are enabled in Google Cloud
- Verify service account permissions

### Service Not Responding
- Check Cloud Run logs for runtime errors
- Verify the service URL is correct
- Ensure the service is deployed in the expected region

### Authentication Issues
- Regenerate service account key if needed
- Verify GitHub secrets are set correctly
- Check IAM permissions in Google Cloud Console

## Cost Considerations

Cloud Run charges based on:
- CPU and memory allocation during request processing
- Number of requests
- Outbound data transfer

The service scales to zero when not in use, minimizing costs.

## Security Notes

- The default configuration allows unauthenticated access
- For production use, consider:
  - Removing `--allow-unauthenticated` flag
  - Implementing API key authentication
  - Setting up Cloud Armor for DDoS protection
  - Using VPC connector for private resources