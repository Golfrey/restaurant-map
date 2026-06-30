import { ExternalLink } from "lucide-react";
import type { Restaurant } from "../../../shared/types";
import { formatAddress, safeExternalUrl } from "../../appUtils";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { SourcePill } from "./SourcePill";

export function RestaurantDetails({ restaurant }: { restaurant?: Restaurant }) {
  if (!restaurant) {
    return (
      <Card className="absolute bottom-4 right-4 z-10 w-[min(420px,calc(100%-2rem))] rounded-lg shadow-2xl">
        <CardContent className="p-4 text-sm text-muted-foreground">No restaurant selected.</CardContent>
      </Card>
    );
  }

  const tags = [...restaurant.cuisines, ...restaurant.tags].slice(0, 12);
  const resyUrl = safeExternalUrl(restaurant.sourceUrls.resy, "resy.com");
  const inKindUrl = safeExternalUrl(restaurant.sourceUrls.inkind, "inkind.com");

  return (
    <Card className="absolute bottom-4 right-4 z-10 w-[min(420px,calc(100%-2rem))] overflow-hidden rounded-xl bg-background/95 shadow-2xl backdrop-blur max-md:bottom-2 max-md:right-2 max-md:max-h-[46vh] max-md:w-[calc(100%-1rem)]">
      {restaurant.imageUrl ? <img className="h-40 w-full object-cover max-md:h-28" src={restaurant.imageUrl} alt="" /> : null}
      <CardContent className="grid gap-3 p-4 max-md:gap-2 max-md:p-3">
        <SourcePill restaurant={restaurant} />
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold leading-tight max-md:text-lg">{restaurant.name}</h2>
          <p className="text-sm text-muted-foreground">{formatAddress(restaurant)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {restaurant.price ? <Badge variant="secondary">{restaurant.price}</Badge> : null}
          {restaurant.rating?.average ? (
            <Badge variant="secondary">
              {restaurant.rating.average.toFixed(1)} stars
              {restaurant.rating.count ? ` (${restaurant.rating.count.toLocaleString()})` : ""}
            </Badge>
          ) : null}
          {restaurant.distanceMiles ? <Badge variant="secondary">{restaurant.distanceMiles.toFixed(1)} mi</Badge> : null}
        </div>

        {tags.length ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="bg-background/80">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          {resyUrl ? (
            <a className={cn(buttonVariants({ size: "sm" }))} href={resyUrl} target="_blank" rel="noreferrer">
              Open Resy
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
          {inKindUrl ? (
            <a className={cn(buttonVariants({ size: "sm" }))} href={inKindUrl} target="_blank" rel="noreferrer">
              Open inKind
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
