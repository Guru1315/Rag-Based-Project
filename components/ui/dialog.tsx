"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps {
  title: string;
  description?: string;
  /** Visually hide the title (it stays available to screen readers). */
  hideTitle?: boolean;
  /** "center" = modal, "left"/"right" = drawer */
  side?: "center" | "left" | "right";
  className?: string;
  children: React.ReactNode;
}

const sideClasses = {
  center:
    "left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl animate-fade-in",
  left: "inset-y-0 left-0 w-72 max-w-[85vw] animate-slide-left",
  right: "inset-y-0 right-0 w-full max-w-md animate-slide-right",
};

/** Accessible dialog / drawer (focus is trapped, Esc closes, title is announced). */
export function DialogContent({ title, description, hideTitle, side = "center", className, children }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/60" />
      <DialogPrimitive.Content
        aria-describedby={description ? undefined : undefined}
        className={cn(
          "fixed z-50 flex flex-col overflow-y-auto border border-border bg-surface p-5 shadow-card",
          sideClasses[side],
          className,
        )}
      >
        <div className={cn("flex items-start justify-between gap-4", hideTitle && "mb-0")}>
          <DialogPrimitive.Title className={cn("text-lg font-semibold", hideTitle && "sr-only")}>
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        <div className="mt-4 min-h-0 flex-1">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
