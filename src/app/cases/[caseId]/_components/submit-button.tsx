"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? pendingLabel : children}</button>;
}
