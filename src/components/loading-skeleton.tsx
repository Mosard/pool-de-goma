import { Card, Skeleton } from "@/components/ui";

export function LoadingSkeleton() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-3 h-3 w-1/2" />
            <Skeleton className="mt-4 h-3 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
