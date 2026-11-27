# GK Shoppy

GK Shoppy is a React storefront backed by AWS Lambda, API Gateway, RDS PostgreSQL, Cognito, and Bedrock.

## AWS architecture

- **API:** API Gateway HTTP API and a Node.js Lambda in private subnets.
- **Database:** Private, encrypted PostgreSQL database **GKShoppy** on RDS.
- **Authentication:** Cognito User Pool. The browser uses its public app-client ID; no AWS credentials are shipped to the frontend.
- **LLM:** Amazon Bedrock Nova Lite customer-support chat. Authenticated chat messages and replies are stored as JSONB in PostgreSQL until deleted by the user. The assistant is instructed not to request passwords, one-time codes, or payment-card data.
- **Network/security:** The database is not public. Lambda can access RDS, Secrets Manager, and Bedrock through VPC endpoints. RDS credentials are generated and kept in Secrets Manager.

The CDK configuration is non-secret JSON in `infra/config/aws-config.json`. CDK deployment outputs can be written to `aws-outputs.json`; that generated file is ignored by Git and contains resource identifiers, not credentials.

## Local frontend

1. Install frontend dependencies with `npm ci`.
2. Set these values in a local `.env` file:

   ```env
   VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
   VITE_AWS_REGION=us-east-1
   VITE_COGNITO_CLIENT_ID=your-cognito-app-client-id
   ```

3. Run `npm run dev`, `npm run typecheck`, or `npm run build`.

The same values can be supplied as container environment variables for `docker compose up --build`. Only the API URL, region, and Cognito public client ID belong in the browser. Never set the database password, Cognito admin credentials, AWS access keys, or Supabase service-role key in frontend variables.

## AWS infrastructure

The infrastructure is defined in `infra/`. **Deploying creates billable AWS resources**; no resources are created by the source changes themselves.

1. Configure the AWS CLI with an appropriately scoped role and select `us-east-1`.
2. From the repository root, run:

   ```powershell
   Set-Location infra
   npm install
   npx cdk bootstrap
   npm run synth
   npm run deploy
   ```

3. The deployment writes non-secret resource outputs to `aws-outputs.json` at the repository root. Set the three frontend values from `ApiUrl`, `UserPoolClientId`, and the configured region.
4. The deployment applies `infra/sql/schema.sql` to the private database using a VPC-connected Lambda custom resource. To populate sample products, run `seed_products.sql` against GKShoppy with `psql` from a host that can reach the VPC.

## Migrating from Supabase

Supabase password hashes cannot be transferred to Cognito. The migration utility copies profiles, products, carts, and orders, creates Cognito users, and assigns each migrated user a new password that the customer does not know. Migrated customers must use **Forgot password?** in the app to set a new password.

After deploying the stack, run `npm run db:import-supabase` from `infra/` with AWS CLI access and the following environment variables set in your local shell. The script exports from Supabase on the local machine and sends bounded batches to the private Lambda; your machine does not need direct database network access.

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
COGNITO_USER_POOL_ID
API_FUNCTION_NAME
AWS_REGION=us-east-1
```

The deployment outputs `UserPoolId` and `ApiFunctionName` in `aws-outputs.json`. The AWS identity running the script needs permission to invoke that Lambda and administer users in the new Cognito pool. The migration script reads the Supabase service-role key from the process environment only; do not put it in a committed file. Take a database backup and verify the imported records before directing production traffic to the new API.

## Optional Spring Boot application

The `backend/` directory contains a separate Spring Boot/Thymeleaf application with its own H2 development database, authentication, cart/order flows, and payment/search scaffolding. It is not the API used by the React storefront; the React app continues to call the AWS API configured by `VITE_API_URL`.

Run the backend locally with Java 25 and Maven 3.9.16 or later:

```bash
cd backend
mvn -B spring-boot:run
```

In Docker Compose, the React storefront is available on port `8080` and this optional backend on port `8081`. The backend accepts `SERPAPI_KEY` and `STRIPE_API_KEY` from the local environment. Stripe webhook signature verification is not implemented, so do not use its payment scaffold in production without completing that work.
