import type { ReactNode } from "react";

export function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
