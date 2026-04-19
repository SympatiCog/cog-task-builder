import type { ReactNode } from "react";

interface Props {
  title: string;
  help?: string;
  children?: ReactNode;
}

export function SectionHeader({ title, help, children }: Props) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
        {help && <p className="mt-1 text-sm text-slate-600">{help}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
