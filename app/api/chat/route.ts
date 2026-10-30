import { fail, logError, parseBody, requireUser } from "@/lib/api";
import { NOT_ENOUGH_INFO } from "@/lib/config";
import { serverConfig } from "@/lib/server-config";
import { AiConfigError, getGemini, withRetry } from "@/lib/rag/embeddings";
import { retrieveSources } from "@/lib/rag/retrieve";
import { SYSTEM_INSTRUCTION, buildFollowUpPrompt, buildUserPrompt, isNotEnoughInfo } from "@/lib/rag/prompt";
import { truncate } from "@/lib/utils";
import { chatRequestSchema } from "@/lib/validation";
import type { ChatStreamEvent, Source } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Turn = { role: "user" | "model"; parts: { text: string }[] };

function toTurns(history: { role: string; content: string }[]): Turn[] {
  const turns: Turn[] = [];
  for (const m of history) {
    const role = m.role === "assistant" ? "model" : "user";
    const text = truncate(m.content, 1500);
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n${text}`;
    else turns.push({ role, parts: [{ text }] });
  }
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();
  return turns;
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  const parsed = await parseBody(request, chatRequestSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  // ----- Request limit: N questions per minute per user (counted from saved messages).
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: recent } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", since);
  if ((recent ?? 0) >= serverConfig.chatLimitPerMinute) {
    return fail(429, "RATE_LIMITED", "You're sending questions too quickly. Please wait a moment and try again.");
  }

  if (!serverConfig.geminiApiKey) {
    return fail(503, "AI_NOT_CONFIGURED", "The AI service is not configured on the server (missing API key).");
  }

  // ----- Find or create the conversation (RLS guarantees it belongs to this user).
  let conversation: { id: string; title: string; knowledge_base_id: string | null; document_ids: string[] };

  if (body.conversationId) {
    const { data } = await supabase
      .from("conversations")
      .select("id, title, knowledge_base_id, document_ids")
      .eq("id", body.conversationId)
      .maybeSingle();
    if (!data) return fail(404, "NOT_FOUND", "Conversation not found.");
    conversation = data;
  } else {
    if (!body.message) return fail(400, "VALIDATION_ERROR", "Please type a question.");

    const documentIds = body.documentIds ?? [];
    if (documentIds.length > 0) {
      // Every selected document must exist for this user (and belong to the chosen knowledge base).
      let check = supabase.from("documents").select("id", { count: "exact", head: true }).in("id", documentIds);
      if (body.knowledgeBaseId) check = check.eq("knowledge_base_id", body.knowledgeBaseId);
      const { count } = await check;
      if (count !== new Set(documentIds).size) {
        return fail(400, "INVALID_SCOPE", "One or more selected documents are not available.");
      }
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        knowledge_base_id: body.knowledgeBaseId ?? null,
        document_ids: documentIds,
        title: truncate(body.message.replace(/\s+/g, " "), 60),
      })
      .select("id, title, knowledge_base_id, document_ids")
      .single();
    if (error || !data) {
      logError("chat.createConversation", error);
      return fail(400, "INVALID_SCOPE", "Could not start the conversation. Is the knowledge base still available?");
    }
    conversation = data;
  }

  // ----- Work out the question (a new message, or the last one again for "regenerate"/"retry").
  let question: string;
  if (body.regenerate) {
    const { data: last } = await supabase
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(2);
    const [latest, previous] = last ?? [];
    if (!latest) return fail(400, "VALIDATION_ERROR", "There is nothing to regenerate.");
    if (latest.role === "assistant") {
      await supabase.from("messages").delete().eq("id", latest.id);
      if (!previous || previous.role !== "user") return fail(400, "VALIDATION_ERROR", "There is nothing to regenerate.");
      question = previous.content;
    } else {
      question = latest.content;
    }
  } else {
    if (!body.message) return fail(400, "VALIDATION_ERROR", "Please type a question.");
    question = body.message;
    // Brand-new conversations already have their first message text in the title; save the message itself.
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversation.id, user_id: user.id, role: "user", content: question });
    if (error) {
      logError("chat.saveUserMessage", error);
      return fail(500, "DB_ERROR", "Could not save your message.");
    }
  }

  // Recent history (for follow-up questions), excluding the question itself.
  const { data: historyDesc } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(7);
  const history = (historyDesc ?? []).reverse();
  if (history.length > 0 && history[history.length - 1].role === "user") history.pop();
  const previousUserQuestion = [...history].reverse().find((m) => m.role === "user")?.content;

  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser disconnected; nothing more to send.
        }
      };

      let answer = "";
      let sources: Source[] = [];

      const saveAssistant = async (status: "complete" | "stopped", grounded: boolean) => {
        const { data, error } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversation.id,
            user_id: user.id,
            role: "assistant",
            content: answer,
            sources: grounded ? sources : [],
            grounded,
            status,
          })
          .select("id")
          .single();
        if (error) logError("chat.saveAssistant", error);
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation.id);
        return data?.id as string | undefined;
      };

      try {
        send({ type: "meta", conversationId: conversation.id, title: conversation.title });

        // ----- Retrieve evidence from the user's own documents.
        // Very short follow-ups ("and the second one?") are searched together with the previous question.
        const searchText =
          question.length < 80 && previousUserQuestion ? `${previousUserQuestion}\n${question}` : question;
        sources = await retrieveSources({
          supabase,
          question: searchText,
          knowledgeBaseId: conversation.knowledge_base_id,
          documentIds: conversation.document_ids,
          signal,
        });

        if (conversation.knowledge_base_id) {
          await supabase
            .from("knowledge_bases")
            .update({ last_accessed_at: new Date().toISOString() })
            .eq("id", conversation.knowledge_base_id);
        }

        // ----- Not enough evidence: do NOT ask the model, and show no sources.
        if (sources.length === 0) {
          answer = NOT_ENOUGH_INFO;
          send({ type: "sources", sources: [] });
          send({ type: "delta", text: answer });
          const messageId = await saveAssistant("complete", false);
          send({ type: "done", messageId: messageId ?? "", grounded: false, followUps: [] });
          return;
        }

        send({ type: "sources", sources });

        // ----- Ask Gemini, grounded on the retrieved passages.
        const ai = getGemini();
        const contents: Turn[] = [...toTurns(history), { role: "user", parts: [{ text: buildUserPrompt(question, sources) }] }];

        const responseStream = await withRetry(() =>
          ai.models.generateContentStream({
            model: serverConfig.chatModel,
            contents,
            config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.2, abortSignal: signal },
          }),
        );

        for await (const part of responseStream) {
          const text = part.text;
          if (text) {
            answer += text;
            send({ type: "delta", text });
          }
        }

        if (!answer.trim()) {
          send({
            type: "error",
            code: "EMPTY_ANSWER",
            message: "The AI returned no answer (the request may have been blocked). Please rephrase and try again.",
          });
          return;
        }

        const grounded = !isNotEnoughInfo(answer);
        const messageId = await saveAssistant("complete", grounded);

        // ----- Suggested follow-up questions, based on the retrieved passages.
        let followUps: string[] = [];
        if (grounded && !signal.aborted) {
          try {
            const result = await ai.models.generateContent({
              model: serverConfig.chatModel,
              contents: buildFollowUpPrompt(question, answer, sources),
              config: { temperature: 0.4, responseMimeType: "application/json", abortSignal: signal },
            });
            const list: unknown = JSON.parse(result.text ?? "[]");
            if (Array.isArray(list)) {
              followUps = list.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 3);
            }
          } catch {
            // Follow-ups are optional; ignore any failure.
          }
        }

        send({ type: "done", messageId: messageId ?? "", grounded, followUps });
      } catch (error) {
        if (signal.aborted) {
          // The user pressed "Stop": keep what was generated so far.
          if (answer.trim() && sources.length > 0) await saveAssistant("stopped", true);
        } else if (error instanceof AiConfigError) {
          send({ type: "error", code: "AI_NOT_CONFIGURED", message: "The AI service is not configured on the server." });
        } else {
          logError("chat", error);
          send({
            type: "error",
            code: "CHAT_FAILED",
            message: "Something went wrong while answering. Please try again.",
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
