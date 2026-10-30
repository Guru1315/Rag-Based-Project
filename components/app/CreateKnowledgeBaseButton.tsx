"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateKnowledgeBaseDialog } from "./CreateKnowledgeBaseDialog";

/** "Create Knowledge Base" button that opens the dialog. */
export function CreateKnowledgeBaseButton({ variant = "primary" }: { variant?: "primary" | "outline" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Create Knowledge Base
      </Button>
      <CreateKnowledgeBaseDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
