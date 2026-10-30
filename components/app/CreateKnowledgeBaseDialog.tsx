"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client-api";

export function CreateKnowledgeBaseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If given, called instead of opening the new knowledge base. */
  onCreated?: (kb: { id: string; name: string }) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const kb = await api<{ id: string; name: string }>("/api/knowledge-bases", {
        body: { name, description: description || null },
      });
      toast.success(`Created “${kb.name}”`);
      setName("");
      setDescription("");
      onOpenChange(false);
      if (onCreated) {
        onCreated(kb);
        router.refresh();
      } else {
        router.push(`/knowledge-bases/${kb.id}`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Create knowledge base" description="A knowledge base groups related documents so you can chat with them together.">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="kb-name">Name</Label>
            <Input
              id="kb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Software Engineering notes"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "kb-error" : undefined}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="kb-description">Description (optional)</Label>
            <Textarea
              id="kb-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          {error ? (
            <p id="kb-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
