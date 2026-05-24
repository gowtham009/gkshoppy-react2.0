# gk-shoppy

This repository contains the GK Shoppy Vite + React app with a Dockerfile and deployment helpers.

Quick setup

1. Ensure `.env` is listed in `.gitignore` (it is).
2. Create a GitHub repository and push this project (commands below).
3. Connect the repo to Render (recommended) or any container host and set the required secrets.

Push commands (replace placeholders):

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<github-username>/<repo>.git
git push -u origin main
```

Render deployment (recommended)

- On Render, create a new Web Service and select your repo.
- Environment: Docker (Render will use the `Dockerfile`).
- Add these Env Vars (as secrets) in Render:
  - `VITE_SUPABASE_URL` — your Supabase URL
  - `VITE_SUPABASE_ANON_KEY` — your Supabase anon key
- Optionally add `render.yaml` to the repo to configure the service automatically.

Azure automated deployment (ACR -> Web App)

- This repo includes a GitHub Actions workflow at `.github/workflows/azure-deploy.yml` that builds the Docker image, pushes it to Azure Container Registry (ACR), and updates an Azure Web App to use that image.
- Required Azure setup (one-time):
  1. Create an Azure Container Registry (ACR) and an Azure Web App (Web App for Containers) in the same subscription.
  2. Create a service principal and add its JSON to the GitHub secret `AZURE_CREDENTIALS`.
     - Create SP and output JSON:

```bash
az ad sp create-for-rbac --name "github-action-sp-<your-name>" --sdk-auth
```

  3. In the repository's GitHub Secrets, add:
     - `AZURE_CREDENTIALS` — the JSON from the previous command
     - `ACR_NAME` — your ACR name (short name, used as `${ACR_NAME}.azurecr.io`)
     - `ACR_USERNAME` and `ACR_PASSWORD` — registry credentials (or use service principal with access)
     - `AZURE_WEBAPP_NAME` — the App Service name
     - `AZURE_RESOURCE_GROUP` — the resource group containing the Web App
     - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — your Supabase values

When those secrets are present, pushing to `main` triggers the workflow and updates your Azure Web App with the new image.

CI: GitHub Actions

- On push to `main`, `.github/workflows/publish-image.yml` will build and push the image to `ghcr.io/<owner>/gkshoppy:latest`.
# GK Shoppy

## Local development

```bash
npm install
npm run dev
```

Create a local `.env` file with:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Containerized run

Build and run with Docker Compose:

```bash
docker compose up --build
```

The container serves the app on port `8080`. Supabase values are injected at container startup through:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## CI/CD

GitHub Actions is configured in `.github/workflows/ci-cd.yml`.

- Pull requests run `typecheck`, `lint`, `build`, and a Docker build smoke test.
- Pushes to `main` or `master` also build and publish a production image to GitHub Container Registry at `ghcr.io/<owner>/<repo>`.

The published image expects these runtime environment variables:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```
