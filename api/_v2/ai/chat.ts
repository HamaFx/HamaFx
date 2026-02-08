import { z } from 'zod';
import { requireAuth } from '../../_lib/auth.js';
import { getAiChatReply } from '../../_lib/ai.js';
import { handleApi } from '../../_lib/handler.js';
import { fail, ok, parseJson, unauthorized } from '../../_lib/http.js';
import { handleOptions } from '../../_lib/request.js';
import { addAuditEvent, appendChatMessage } from '../../_lib/state.js';
import { rateLimit } from '../../_lib/redis.js';

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  mode: z.enum(['general', 'portfolio', 'risk', 'news', 'execution']).optional(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(3000),
    })
  ).max(12).optional(),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const allowed = await rateLimit(`ai:chat:${auth.userId}`, 40, 60);
    if (!allowed) return fail('AI chat rate limit exceeded. Please wait and retry.', 429);

    const body = await parseJson<unknown>(request);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid AI chat payload', 400, parsed.error.flatten());

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: parsed.data.message,
      context: 'ai-chat',
      timestamp: Date.now(),
    };

    const ai = await getAiChatReply({
      userId: auth.userId,
      message: parsed.data.message,
      history: parsed.data.history,
      mode: parsed.data.mode,
    });

    const assistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      content: ai.reply,
      context: 'ai-chat',
      timestamp: Date.now(),
      followUps: ai.followUps,
      riskLevel: ai.riskLevel,
      source: ai.source,
    };

    await appendChatMessage(auth.userId, userMessage as unknown as Record<string, unknown>);
    await appendChatMessage(auth.userId, assistantMessage as unknown as Record<string, unknown>);

    await addAuditEvent(auth.userId, 'AI_ANALYSIS_REQUESTED', 'AI chat response generated', {
      riskLevel: ai.riskLevel,
      source: ai.source,
      mode: parsed.data.mode ?? 'general',
    });

    return ok({
      reply: ai.reply,
      followUps: ai.followUps,
      riskLevel: ai.riskLevel,
      source: ai.source,
      generatedAt: ai.generatedAt,
      userMessage,
      assistantMessage,
    });
  });
}
