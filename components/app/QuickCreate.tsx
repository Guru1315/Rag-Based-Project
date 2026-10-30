"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Library, MessageSquarePlus, Plus, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { CreateKnowledgeBaseDialog } from "./CreateKnowledgeBaseDialog";

/** The "+ New" menu in the top bar. */
export function QuickCreate() {
  const router = useRouter();
  const [kbOpen, setKbOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="md" className="px-3 sm:px-4" aria-label="Create new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => router.push("/chat")}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            New chat
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setKbOpen(true)}>
            <Library className="h-4 w-4" aria-hidden="true" />
            New knowledge base
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/dashboard#upload")}>
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Upload documents
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateKnowledgeBaseDialog open={kbOpen} onOpenChange={setKbOpen} />
    </>
  );
}
