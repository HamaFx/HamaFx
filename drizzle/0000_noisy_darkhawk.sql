CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"asset_type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_triggered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"triggered_at" timestamp with time zone,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"details" text NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"context" text,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"asset_type" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"user_id" text PRIMARY KEY NOT NULL,
	"virtual_balance" numeric(18, 2) DEFAULT '100000' NOT NULL,
	"total_deposited" numeric(18, 2) DEFAULT '100000' NOT NULL,
	"balance_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"asset_type" text NOT NULL,
	"side" text NOT NULL,
	"data" jsonb NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"asset_type" text NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"watchlist_id" text NOT NULL,
	"symbol" text NOT NULL,
	"asset_type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_user_idx" ON "alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_events_user_idx" ON "audit_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_events_timestamp_idx" ON "audit_events" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX "chat_messages_user_idx" ON "chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_timestamp_idx" ON "chat_messages" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "portfolios_user_idx" ON "portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "positions_user_idx" ON "positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "positions_symbol_idx" ON "positions" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_hash_unique" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "settings_user_idx" ON "settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trades_user_idx" ON "trades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trades_executed_idx" ON "trades" USING btree ("user_id","executed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "watchlist_items_user_idx" ON "watchlist_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watchlist_items_watchlist_idx" ON "watchlist_items" USING btree ("watchlist_id");--> statement-breakpoint
CREATE INDEX "watchlists_user_idx" ON "watchlists" USING btree ("user_id");