"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client-api";

type Scope = "documents" | "conversations";

const COPY: Record<Scope, { button: string; title: string; description: string; done: string }> = {
  documents: {
    button: "Delete all documents and knowledge bases",
    title: "Delete all documents?",
    description:
      "Every knowledge base, every uploaded file and all indexed text will be permanently deleted. Your conversations stay, but they will have nothing to search.",
    done: "All documents and knowledge bases were deleted.",
  },
  conversations: {
    button: "Delete all conversations",
    title: "Delete all conversations?",
    description: "Every conversation and message will be permanently deleted. Your documents are not affected.",
    done: "All conversations were deleted.",
  },
};

export function DangerZone() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (!scope) return;
    setLoading(true);
    try {
      await api("/api/account/data", { method: "DELETE", body: { scope, confirm: "DELETE" } });
      toast.success(COPY[scope].done);
      setScope(null);
      setText("");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {(Object.keys(COPY) as Scope[]).map((key) => (
          <Button
            key={key}
            variant="outline"
            className="border-danger/50 text-danger hover:bg-danger-bg"
            onClick={() => {
              setText("");
              setScope(key);
            }}
          >
            {COPY[key].button}
          </Button>
        ))}
      </div>

      <Dialog open={scope !== null} onOpenChange={(open) => !open && !loading && setScope(null)}>
        <DialogContent title={scope ? COPY[scope].title : "Confirm"} description={scope ? COPY[scope].description : undefined}>
          <Label htmlFor="danger-confirm">
            Type <strong>DELETE</strong> to confirm
          </Label>
          <Input id="danger-confirm" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setScope(null)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm} loading={loading} disabled={text !== "DELETE"}>
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
