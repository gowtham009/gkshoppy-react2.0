git add README.md
git commit -m "Resolve merge conflict in README.md"
git push -u origin main<<<<<<< HEAD
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
git remote add origin https://github.com/<github-username>git add README.md
git commit -m "Resolve merge conflict in README.md"
git push -u origin main/https://github.com/gowtham009/gkshoppy-react2.0git checkout --ours README.md
git add README.md
git commit -m "Resolve conflict: keep local README.md"
git push -u origin maingit checkout --theirs README.md
git add README.md
git commit -m "Resolve conflict: accept remote README.md"
git push -u origin maingit show :1:README.md > README.ancestor.md  # optional ancestor
git show :2:README.md > README.ours.md
git show :3:README.md > README.theirs.md
cat README.ours.md README.theirs.md > README.md
git add README.md
git commit -m "Resolve conflict: concatenate local+remote README"
git push -u origin maingit show :1:README.md > README.ancestor.md  # optional ancestor
git show :2:README.md > README.ours.md
git show :3:README.md > README.theirs.md
cat README.ours.md README.theirs.md > README.md
# gk-shoppy / gkshoppy-react2.0

This repository contains the GK Shoppy Vite + React app (v2.0) with Docker support and CI/CD deployment helpers for Render and Azure.

## Quick setup

1. Ensure `.env` is listed in `.gitignore` (it is).
2. Create a GitHub repository and push this project (commands below) or push your local changes to the existing repo.
3. Connect the repo to Render (optional) or use Azure automated deployment (ACR -> Web App).

Push commands (replace placeholders):

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<github-username>/<repo>.git
git push -u origin main
```

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

The container serves the app on port `8080`. Supabase values are injected at container startup through environment variables.

## Render deployment (recommended)

- On Render, create a new Web Service and select your repo.
- Environment: Docker (Render will use the `Dockerfile`).
- Add these Env Vars (as secrets) in Render:
  - `VITE_SUPABASE_URL` — your Supabase URL
  - `VITE_SUPABASE_ANON_KEY` — your Supabase anon key
 - Optionally add `render.yaml` to the repo to configure the service automatically.

## Azure automated deployment (ACR -> Web App)

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

## CI: GitHub Actions

- On push to `main`, `.github/workflows/publish-image.yml` will build and push the image to `ghcr.io/<owner>/gkshoppy:latest`.
- The repo also includes an Azure deploy workflow at `.github/workflows/azure-deploy.yml` to push to ACR and update Web App.

## Notes

- Do not commit secrets or `azure_sp_*.json` files. Add them to GitHub Secrets instead.
- For quick testing, the repo supports a temporary local tunnel; for production use Render or Azure as described above.
