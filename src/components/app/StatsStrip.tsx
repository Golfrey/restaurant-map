import type { RestaurantResponse } from "../../../shared/types";

export function StatsStrip({ data }: { data: RestaurantResponse | null }) {
  const stats = [
    { label: "Total", value: data?.sourceCounts.total },
    { label: "Both", value: data?.sourceCounts.both },
    { label: "Resy", value: data?.sourceCounts.resy },
    { label: "inKind", value: data?.sourceCounts.inkind }
  ];

  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-lg border bg-card">
      {stats.map((stat) => (
        <div key={stat.label} className="border-r px-2.5 py-1.5 last:border-r-0">
          <div className="text-sm font-semibold tabular-nums leading-none">{stat.value?.toLocaleString() ?? "--"}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
