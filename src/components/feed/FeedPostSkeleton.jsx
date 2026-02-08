import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export default function FeedPostSkeleton() {
  return (
    <Card className="group overflow-hidden rounded-2xl border-border/60 bg-card/55 backdrop-blur">
      {/* image */}
      <div className="relative aspect-[16/9] w-full">
        <Skeleton className="h-full w-full" />
      </div>

      {/* title + button */}
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        <Skeleton className="h-10 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}