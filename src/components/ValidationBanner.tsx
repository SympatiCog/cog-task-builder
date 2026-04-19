import { useValidation } from "../validator/hooks";

// Compact status strip at the top of every section. Zero errors AND zero
// warnings → green. Errors → red. Warnings only → amber. Clicking opens the
// dedicated Validation section (handled by the parent via onOpen).
export function ValidationBanner({ onOpen }: { onOpen?: () => void }) {
  const { errors, warnings } = useValidation();
  const total = errors.length + warnings.length;

  if (total === 0) {
    return (
      <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
        Validator clean (0 errors, 0 warnings).
      </div>
    );
  }

  const color =
    errors.length > 0
      ? "border-rose-300 bg-rose-50 text-rose-800"
      : "border-amber-300 bg-amber-50 text-amber-900";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mb-4 flex w-full items-center justify-between rounded border px-3 py-1.5 text-left text-sm ${color}`}
    >
      <span>
        {errors.length > 0 && <strong>{errors.length} error{errors.length === 1 ? "" : "s"}</strong>}
        {errors.length > 0 && warnings.length > 0 && ", "}
        {warnings.length > 0 && <span>{warnings.length} warning{warnings.length === 1 ? "" : "s"}</span>}
      </span>
      {onOpen && <span className="text-xs">Open validation →</span>}
    </button>
  );
}
