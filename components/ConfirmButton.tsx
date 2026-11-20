"use client";

import { useTransition } from "react";

export default function ConfirmButton({ action, label, confirmText, className = "btn-danger" }: {
  action: () => Promise<string | void>; label: string; confirmText?: string; className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={className} disabled={pending}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        start(async () => {
          const err = await action();
          if (err) window.alert(err);
        });
      }}>
      {pending ? "Working…" : label}
    </button>
  );
}
