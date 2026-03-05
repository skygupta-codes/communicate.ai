import { generateText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * Compliance Guard Agent
 * Checks if a message should be sent.
 */
export async function runComplianceGuard(lead: any, messageText: string, channel: string) {
    // Hard policy rules
    if (lead.status === 'OPT_OUT') {
        return { allow: false, reason: 'User has opted out completely.' };
    }

    const now = new Date();
    if (lead.cooldown_until && new Date(lead.cooldown_until) > now) {
        return { allow: false, reason: 'Global cooldown is currently active.' };
    }

    // LLM Check (Soft rules)
    const result = await generateObject({
        model: openai('gpt-4o', { structuredOutputs: true }),
        schema: z.object({
            allow: z.boolean(),
            reason: z.string(),
            detected_opt_out: z.boolean()
        }),
        system: `You are a compliance guard for a photography studio.
    Check if the user is trying to opt-out ("stop", "unsubscribe", "don't contact", "leave me alone").`,
        prompt: `Analyze this inbound message context: ${messageText}`
    });

    return result.object;
}

/**
 * Conversation Agent
 * Formulates replies and detects intent.
 */
export async function runConversationAgent(lead: any, history: any[], inboundMessage: string) {
    const result = await generateObject({
        model: openai('gpt-4o', { structuredOutputs: true }),
        schema: z.object({
            reply_text: z.string().describe('The generated response. Must be <= 60 words for WhatsApp, casual but professional. Must have clear CTA.'),
            intent: z.enum(['booking_intent', 'pricing', 'availability_request', 'objection', 'opt_out', 'not_interested', 'general']),
            extracted_timeline: z.string().nullable(),
            extracted_session_type: z.string().nullable()
        }),
        system: `You are the primary assistant for Moments to Frames Studio in Barrhaven, Ottawa.
    You answer questions and guide the user to book a session.

    Packages:
    - Maternity Sessions: $300 CAD, 1 hour, studio, maternity wardrobe included, partner/children allowed, 10 edited photos included, extra edits $5/image
    - Family Portraits: Same base package structure but valid for 5 people; +$25/person beyond 5; wardrobe not included; provide consult for outfit guidance

    Rules:
    - Never ask more than 2 questions at once.
    - Be warm and Ottawa-local.
    - Your goal is to get their preferred dates and whether they want studio or outdoor.`,
        prompt: `
      Lead Info: ${JSON.stringify(lead)}
      Conversation History: ${JSON.stringify(history)}
      Latest User Message: ${inboundMessage}
      
      Formulate the next reply and categorize their intent.
    `
    });

    return result.object;
}

/**
 * Followup Agent
 * Generates cadenced followup messages.
 */
export async function runFollowupAgent(lead: any, stage: number) {
    let prompt = '';
    if (stage === 1) prompt = "Generate a quick check-in asking if they are still looking for a photographer, and offer 2 slots.";
    else if (stage === 2) prompt = "Generate a value-add message with a brief outfit prep tip and ask if they have dates in mind.";
    else prompt = "Generate a scarcity-light message ('I can hold a spot for 24h') and include opt-out info.";

    const result = await generateText({
        model: openai('gpt-4o'),
        system: `You are the follow-up assistant for Moments to Frames Studio. 
    Keep it under 50 words. Always include an opt-out instruction at the very end like 'Reply STOP to opt out'.`,
        prompt: `Lead name: ${lead.name || 'friend'}. ${prompt}`
    });

    return result.text;
}
