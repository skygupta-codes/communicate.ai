CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" varchar(100) NOT NULL,
	"lead_id" varchar(255) NOT NULL,
	"run_at" timestamp NOT NULL,
	"payload" json,
	"status" varchar DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"lead_id" varchar(255) PRIMARY KEY NOT NULL,
	"source" varchar(50) DEFAULT 'meta' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"session_type" varchar,
	"timeline" varchar,
	"consent_email" boolean DEFAULT true,
	"consent_whatsapp" boolean DEFAULT true,
	"status" varchar DEFAULT 'NEW' NOT NULL,
	"email_thread_id" varchar(255),
	"whatsapp_conversation_id" varchar(255),
	"last_contact_at" timestamp,
	"last_reply_at" timestamp,
	"followup_stage" integer DEFAULT 0 NOT NULL,
	"next_followup_at" timestamp,
	"cooldown_until" timestamp,
	"notes" json
);
--> statement-breakpoint
CREATE TABLE "message_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar(255) NOT NULL,
	"channel" varchar NOT NULL,
	"direction" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"content" text NOT NULL,
	"provider_ref" varchar(255),
	"intent_tag" varchar(100)
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_lead_id_leads_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("lead_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_lead_id_leads_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("lead_id") ON DELETE no action ON UPDATE no action;