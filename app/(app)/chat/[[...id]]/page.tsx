import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import type { Scope } from "@/components/chat/ScopePicker";
import { createClient } from "@/lib/supabase/server";
import { idParamSchema } from "@/lib/validation";
import type { ChatMessage } from "@/types";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id?: string[] }>;
  searchParams: Promise<{ kb?: string; doc?: string }>;
};

export default async function ChatPage({ params, searchParams }: Props) {
  const segments = (await params).id ?? [];
  if (segments.length > 1) notFound();

  const sp = await searchParams;
  const supabase = await createClient();

  const [kbs, ready] = await Promise.all([
    supabase.from("knowledge_bases").select("id, name").order("name").limit(200),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "ready"),
  ]);
  const knowledgeBases = kbs.data ?? [];

  // ----- Existing conversation
  if (segments.length === 1) {
    const id = idParamSchema.safeParse(segments[0]);
    if (!id.success) notFound();

    // Row Level Security: someone else's conversation is simply "not found".
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, title, starred, knowledge_base_id, document_ids")
      .eq("id", id.data)
      .maybeSingle();
    if (!conversation) notFound();

    const [{ data: messages }, docNames] = await Promise.all([
      supabase
        .from("messages")
        .select("id, role, content, sources, grounded, status, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(300),
      conversation.document_ids.length > 0
        ? supabase.from("documents").select("id, file_name").in("id", conversation.document_ids)
        : Promise.resolve({ data: [] as { id: string; file_name: string }[] }),
    ]);

    const scope: Scope = {
      kbId: conversation.knowledge_base_id ?? "",
      docs: (docNames.data ?? []).map((d: { id: string; file_name: string }) => ({ id: d.id, name: d.file_name })),
    };

    return (
      <ChatWorkspace
        conversation={{ id: conversation.id, title: conversation.title, starred: conversation.starred }}
        initialMessages={(messages ?? []) as ChatMessage[]}
        knowledgeBases={knowledgeBases}
        initialScope={scope}
        locked
        readyDocumentCount={ready.count ?? 0}
      />
    );
  }

  // ----- New conversation (optionally pre-scoped with ?kb=… or ?doc=…)
  let scope: Scope = { kbId: "", docs: [] };
  const docId = idParamSchema.safeParse(sp.doc);
  const kbId = idParamSchema.safeParse(sp.kb);

  if (docId.success) {
    const { data: doc } = await supabase
      .from("documents")
      .select("id, file_name, knowledge_base_id")
      .eq("id", docId.data)
      .maybeSingle();
    if (doc) scope = { kbId: doc.knowledge_base_id, docs: [{ id: doc.id, name: doc.file_name }] };
  } else if (kbId.success && knowledgeBases.some((k) => k.id === kbId.data)) {
    scope = { kbId: kbId.data, docs: [] };
  }

  return (
    <ChatWorkspace
      conversation={null}
      initialMessages={[]}
      knowledgeBases={knowledgeBases}
      initialScope={scope}
      locked={false}
      readyDocumentCount={ready.count ?? 0}
    />
  );
}
