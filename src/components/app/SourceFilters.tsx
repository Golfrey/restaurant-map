import { type SourceFilter } from "../../appUtils";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

const sourceOptions: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "both", label: "Both" },
  { value: "resy", label: "Resy" },
  { value: "inkind", label: "inKind" }
];

export function SourceFilters({ value, onChange }: { value: SourceFilter; onChange: (value: SourceFilter) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-lg border bg-muted p-1" aria-label="Source filter">
      {sourceOptions.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 rounded-md px-2 text-xs",
            value === option.value && "bg-background shadow-sm hover:bg-background"
          )}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
