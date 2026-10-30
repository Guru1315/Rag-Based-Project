"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client-api";

/** Rename / delete menu for one knowledge base. */
export function KnowledgeBaseActions({
  id,
  name,
  description,
  documentCount,
}: {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState(name);
  const [newDescription, setNewDescription] = useState(description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) {
      setError("Please enter a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(`/api/knowledge-bases/${id}`, { method: "PATCH", body: { name: newName, description: newDescription || null } });
      toast.success("Knowledge base updated");
      setRenameOpen(false);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/knowledge-bases/${id}`, { method: "DELETE" });
      toast.success(`Deleted “${name}”`);
      router.push("/knowledge-bases");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={`Actions for ${name}`}>
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() => {
              setNewName(name);
              setNewDescription(description ?? "");
              setError(null);
              setRenameOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Rename / edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-danger">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent title="Edit knowledge base">
          <form onSubmit={save} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="rename-name">Name</Label>
              <Input id="rename-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100} autoFocus />
            </div>
            <div>
              <Label htmlFor="rename-description">Description (optional)</Label>
              <Textarea id="rename-description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} maxLength={500} rows={3} />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this knowledge base?"
        description={`“${name}” and its ${documentCount} document${documentCount === 1 ? "" : "s"} (files and indexed text) will be permanently deleted. Your conversations are kept, but they will no longer be tied to it. This cannot be undone.`}
        confirmLabel="Delete knowledge base"
        onConfirm={remove}
      />
    </>
  );
}
