import * as React from "react";
import { toast as sonner } from "sonner";

/**
 * One toast system. The old shadcn `useToast()` API is kept so the ~60 call sites keep working,
 * but everything now renders through Sonner (stacking, swipe to dismiss, Undo actions).
 */
type ToastAction = { label: string; onClick: () => void };
export interface ToastInput {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive" | "success";
  duration?: number;
  /** Sonner-style action, e.g. { label: "Undo", onClick }. */
  action?: ToastAction | React.ReactNode;
}

const POSITIVE = /(created|saved|sent|updated|added|moved|uploaded|completed|deleted|removed|scheduled|transferred|copied|verified|welcome|done|success|assigned|approved|published|imported|restored)/i;

function isAction(a: unknown): a is ToastAction {
  return !!a && typeof a === "object" && "label" in (a as object) && "onClick" in (a as object);
}

function toast(input: ToastInput) {
  const { title, description, variant, duration, action } = input;
  const message = (title ?? description ?? "") as React.ReactNode;
  const opts: Record<string, unknown> = {};
  if (title && description) opts.description = description;
  if (duration) opts.duration = duration;
  if (isAction(action)) opts.action = action;
  let id: string | number;
  if (variant === "destructive") id = sonner.error(message, opts);
  else if (variant === "success" || (typeof title === "string" && POSITIVE.test(title))) id = sonner.success(message, opts);
  else id = sonner(message, opts);
  return {
    id: String(id),
    dismiss: () => sonner.dismiss(id),
    update: (next: ToastInput) => sonner(next.title ?? next.description ?? "", { id, description: next.title ? next.description : undefined }),
  };
}

function useToast() {
  return {
    toasts: [] as never[],
    toast,
    dismiss: (id?: string) => sonner.dismiss(id),
  };
}

export { useToast, toast };
