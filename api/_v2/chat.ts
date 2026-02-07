import { z } from 'zod';
import { requireAuth } from '../_lib/auth.js';
import { handleApi } from '../_lib/handler.js';
import { fail, ok, parseJson, unauthorized } from '../_lib/http.js';
import { handleOptions, parsePagination } from '../_lib/request.js';
import { addAuditEvent, appendChatMessage, getChatMessages, saveChatMessages } from '../_lib/state.js';

const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  context: z.string().optional(),
  timestamp: z.number().optional(),
});

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const { limit } = parsePagination(request, 100, 500);
    const messages = await getChatMessages(auth.userId, limit);
    return ok(messages);
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson<unknown>(request);
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) return fail('Invalid chat message payload', 400, parsed.error.flatten());

    const payload = {
      ...parsed.data,
      id: parsed.data.id ?? crypto.randomUUID(),
      timestamp: parsed.data.timestamp ?? Date.now(),
    };

    await appendChatMessage(auth.userId, payload);
    await addAuditEvent(auth.userId, 'AI_ANALYSIS_REQUESTED', 'Chat message appended', {
      role: payload.role,
      context: payload.context,
    });

    return ok({ appended: true, message: payload });
  });
}

export async function PUT(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    const body = await parseJson<unknown>(request);
    const parsed = z.array(messageSchema).safeParse(body);
    if (!parsed.success) return fail('Invalid chat history payload', 400, parsed.error.flatten());

    const payload = parsed.data.map((message) => ({
      ...message,
      id: message.id ?? crypto.randomUUID(),
      timestamp: message.timestamp ?? Date.now(),
    }));

    await saveChatMessages(auth.userId, payload);
    await addAuditEvent(auth.userId, 'SETTINGS_CHANGED', 'Chat history replaced');

    return ok({ saved: true, count: payload.length });
  });
}

export async function DELETE(request: Request) {
  return handleApi(request, async () => {
    const auth = await requireAuth(request);
    if (!auth) return unauthorized();

    await saveChatMessages(auth.userId, []);
    await addAuditEvent(auth.userId, 'SETTINGS_CHANGED', 'Chat history cleared');
    return ok({ cleared: true });
  });
}
