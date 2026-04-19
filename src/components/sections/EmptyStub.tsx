interface Props {
  label: string;
  batch: number;
}

export function EmptyStub({ label, batch }: Props) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md rounded border border-slate-200 bg-white p-6 text-center">
        <h2 className="mb-2 text-base font-semibold text-slate-800">{label}</h2>
        <p className="text-sm text-slate-600">Coming in Batch {batch}.</p>
      </div>
    </div>
  );
}
