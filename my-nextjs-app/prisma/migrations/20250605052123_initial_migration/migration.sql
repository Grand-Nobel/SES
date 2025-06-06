-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('Draft', 'Sent', 'Paid', 'Overdue');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('Active', 'Cancelled', 'Expired');

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "industry" TEXT,
    "size" INTEGER,
    "used_technologies" TEXT[],

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "image" TEXT,
    "email_verified" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."clients" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."integrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ontology_metadata" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "related_entity_type" TEXT NOT NULL,
    "related_entity_id" TEXT,
    "schema_definition" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ontology_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dashboard_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "widget_configs" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."integration_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "normalized_payload" JSONB NOT NULL,
    "source_service" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."etl_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_service" TEXT NOT NULL,
    "transformation_rules" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etl_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."kpi_predictions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "prediction" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."template_library" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "template_type" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'Draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ledgers" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'Active',
    "renewal_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "pay_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenants_name_idx" ON "public"."tenants"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "public"."users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "public"."accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "public"."accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "public"."sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "public"."sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "public"."verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "public"."verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "clients_tenant_id_idx" ON "public"."clients"("tenant_id");

-- CreateIndex
CREATE INDEX "integrations_category_idx" ON "public"."integrations"("category");

-- CreateIndex
CREATE INDEX "user_integrations_user_id_idx" ON "public"."user_integrations"("user_id");

-- CreateIndex
CREATE INDEX "user_integrations_tenant_id_idx" ON "public"."user_integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "user_integrations_integration_id_idx" ON "public"."user_integrations"("integration_id");

-- CreateIndex
CREATE INDEX "ontology_metadata_tenant_id_idx" ON "public"."ontology_metadata"("tenant_id");

-- CreateIndex
CREATE INDEX "ontology_metadata_entity_type_idx" ON "public"."ontology_metadata"("entity_type");

-- CreateIndex
CREATE INDEX "ontology_metadata_schema_definition_idx" ON "public"."ontology_metadata"("schema_definition");

-- CreateIndex
CREATE INDEX "dashboard_configs_tenant_id_idx" ON "public"."dashboard_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "dashboard_configs_user_id_idx" ON "public"."dashboard_configs"("user_id");

-- CreateIndex
CREATE INDEX "dashboard_configs_layout_idx" ON "public"."dashboard_configs"("layout");

-- CreateIndex
CREATE INDEX "integration_events_tenant_id_idx" ON "public"."integration_events"("tenant_id");

-- CreateIndex
CREATE INDEX "integration_events_timestamp_idx" ON "public"."integration_events"("timestamp");

-- CreateIndex
CREATE INDEX "integration_events_normalized_payload_idx" ON "public"."integration_events"("normalized_payload");

-- CreateIndex
CREATE INDEX "etl_configs_tenant_id_idx" ON "public"."etl_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "etl_configs_source_service_idx" ON "public"."etl_configs"("source_service");

-- CreateIndex
CREATE INDEX "etl_configs_transformation_rules_idx" ON "public"."etl_configs"("transformation_rules");

-- CreateIndex
CREATE INDEX "kpi_predictions_tenant_id_idx" ON "public"."kpi_predictions"("tenant_id");

-- CreateIndex
CREATE INDEX "kpi_predictions_timestamp_idx" ON "public"."kpi_predictions"("timestamp");

-- CreateIndex
CREATE INDEX "kpi_predictions_prediction_idx" ON "public"."kpi_predictions"("prediction");

-- CreateIndex
CREATE INDEX "template_library_tenant_id_idx" ON "public"."template_library"("tenant_id");

-- CreateIndex
CREATE INDEX "template_library_template_type_idx" ON "public"."template_library"("template_type");

-- CreateIndex
CREATE INDEX "template_library_metadata_idx" ON "public"."template_library"("metadata");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "public"."invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "public"."invoices"("client_id");

-- CreateIndex
CREATE INDEX "ledgers_tenant_id_idx" ON "public"."ledgers"("tenant_id");

-- CreateIndex
CREATE INDEX "ledgers_timestamp_idx" ON "public"."ledgers"("timestamp");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "public"."subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "subscriptions_client_id_idx" ON "public"."subscriptions"("client_id");

-- CreateIndex
CREATE INDEX "payroll_tenant_id_idx" ON "public"."payroll"("tenant_id");

-- CreateIndex
CREATE INDEX "payroll_user_id_idx" ON "public"."payroll"("user_id");

-- CreateIndex
CREATE INDEX "payroll_pay_date_idx" ON "public"."payroll"("pay_date");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "public"."audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "public"."audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_integrations" ADD CONSTRAINT "user_integrations_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_integrations" ADD CONSTRAINT "user_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_integrations" ADD CONSTRAINT "user_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ontology_metadata" ADD CONSTRAINT "ontology_metadata_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dashboard_configs" ADD CONSTRAINT "dashboard_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dashboard_configs" ADD CONSTRAINT "dashboard_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."integration_events" ADD CONSTRAINT "integration_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."etl_configs" ADD CONSTRAINT "etl_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."kpi_predictions" ADD CONSTRAINT "kpi_predictions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."template_library" ADD CONSTRAINT "template_library_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ledgers" ADD CONSTRAINT "ledgers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll" ADD CONSTRAINT "payroll_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll" ADD CONSTRAINT "payroll_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
