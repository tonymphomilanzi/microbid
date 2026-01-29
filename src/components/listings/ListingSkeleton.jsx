import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export default function ListingSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[16/10] w-full">
        <Skeleton className="h-full w-full" />
      </div>

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}