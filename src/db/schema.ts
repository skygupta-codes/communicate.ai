import { pgTable, varchar, timestamp, boolean, text, integer, json, uuid } from 'drizzle-orm/pg-core';

export const sessionTypeEnum = ['maternity', 'family', 'portrait', 'unknown'] as const;
export const timelineEnum = ['within_month', 'one_to_two_months', 'two_plus_months', 'unknown'] as const;
export const leadStatusEnum = ['NEW', 'CONTACTED', 'ENGAGED', 'BOOKED', 'CLOSED', 'OPT_OUT', 'NEEDS_MANUAL'] as const;
export const channelEnum = ['email', 'whatsapp'] as const;
export const directionEnum = ['outbound', 'inbound'] as const;
export const jobStatusEnum = ['queued', 'running', 'done', 'failed'] as const;

export const leads = pgTable('leads', {
    lead_id: varchar('lead_id', { length: 255 }).primaryKey(),
    source: varchar('source', { length: 50 }).notNull().default('meta'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    name: varchar('name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    session_type: varchar('session_type', { enum: sessionTypeEnum }),
    timeline: varchar('timeline', { enum: timelineEnum }),
    consent_email: boolean('consent_email').default(true),
    consent_whatsapp: boolean('consent_whatsapp').default(true),
    status: varchar('status', { enum: leadStatusEnum }).notNull().default('NEW'),
    email_thread_id: varchar('email_thread_id', { length: 255 }),
    whatsapp_conversation_id: varchar('whatsapp_conversation_id', { length: 255 }),
    last_contact_at: timestamp('last_contact_at'),
    last_reply_at: timestamp('last_reply_at'),
    followup_stage: integer('followup_stage').notNull().default(0),
    next_followup_at: timestamp('next_followup_at'),
    cooldown_until: timestamp('cooldown_until'),
    notes: json('notes'),
});

export const message_log = pgTable('message_log', {
    id: uuid('id').primaryKey().defaultRandom(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.lead_id).notNull(),
    channel: varchar('channel', { enum: channelEnum }).notNull(),
    direction: varchar('direction', { enum: directionEnum }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    content: text('content').notNull(),
    provider_ref: varchar('provider_ref', { length: 255 }),
    intent_tag: varchar('intent_tag', { length: 100 }),
});

export const jobs = pgTable('jobs', {
    id: uuid('id').primaryKey().defaultRandom(),
    job_name: varchar('job_name', { length: 100 }).notNull(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.lead_id).notNull(),
    run_at: timestamp('run_at').notNull(),
    payload: json('payload'),
    status: varchar('status', { enum: jobStatusEnum }).notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
});
