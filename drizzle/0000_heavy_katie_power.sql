CREATE TYPE "public"."layer_kind" AS ENUM('background', 'gif', 'audio');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'preparing', 'ready', 'rendering', 'rendered', 'failed');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "layer_kind" NOT NULL,
	"query" text NOT NULL,
	"candidate_index" integer DEFAULT 0 NOT NULL,
	"provider" text NOT NULL,
	"media_type" text NOT NULL,
	"preview_url" text NOT NULL,
	"render_url" text NOT NULL,
	"thumb_url" text,
	"title" text,
	"credit_name" text,
	"credit_url" text,
	"meta" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"title" text,
	"description" text,
	"image_url" text,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"caption" text,
	"angle" text,
	"plan_source" text,
	"video_url" text,
	"render_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rendered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layers" ADD CONSTRAINT "layers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_project_created_idx" ON "events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "layers_project_kind_uq" ON "layers" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "projects_owner_created_idx" ON "projects" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "projects_status_rendered_idx" ON "projects" USING btree ("status","rendered_at");