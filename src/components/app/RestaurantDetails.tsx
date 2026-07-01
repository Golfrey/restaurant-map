import { ExternalLink } from "lucide-react";
import type { Restaurant } from "../../../shared/types";
import { formatAddress, inKindAppUrl, restaurantLabels, safeExternalUrl } from "../../appUtils";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { SourcePill } from "./SourcePill";

interface RestaurantDetailsProps {
  restaurant?: Restaurant;
  variant?: "floating" | "sheet";
  className?: string;
}

export function RestaurantDetails({ restaurant, variant = "floating", className }: RestaurantDetailsProps) {
  if (!restaurant) {
    if (variant === "sheet") {
      return <div className={cn("p-4 text-sm text-muted-foreground", className)}>No restaurant selected.</div>;
    }

    return (
      <Card
        className={cn("absolute bottom-4 right-4 z-10 w-[min(420px,calc(100%-2rem))] rounded-lg shadow-2xl", className)}
      >
        <CardContent className="p-4 text-sm text-muted-foreground">No restaurant selected.</CardContent>
      </Card>
    );
  }

  const tags = restaurantLabels(restaurant).slice(0, 12);
  const resyUrl = safeExternalUrl(restaurant.sourceUrls.resy, "resy.com");
  const inKindUrl = inKindAppUrl(restaurant);

  if (variant === "sheet") {
    return (
      <div className={cn("grid gap-3 p-3", className)}>
        {restaurant.imageUrl ? (
          <img className="h-32 w-full rounded-md object-cover" src={restaurant.imageUrl} alt="" />
        ) : null}
        <SourcePill restaurant={restaurant} />
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold leading-tight">{restaurant.name}</h2>
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
          {restaurant.distanceMiles ? (
            <Badge variant="secondary">{restaurant.distanceMiles.toFixed(1)} mi</Badge>
          ) : null}
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

        <div className="grid grid-cols-2 gap-2 pt-1 max-[360px]:grid-cols-1">
          {resyUrl ? (
            <a
              className={cn(buttonVariants({ size: "sm" }), "justify-center")}
              href={resyUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Resy
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
          {inKindUrl ? (
            <a
              className={cn(buttonVariants({ size: "sm" }), "justify-center")}
              href={inKindUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open inKind
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "absolute bottom-4 right-4 z-10 w-[min(420px,calc(100%-2rem))] overflow-hidden rounded-xl bg-background/95 shadow-2xl backdrop-blur",
        className
      )}
    >
      {restaurant.imageUrl ? <img className="h-40 w-full object-cover" src={restaurant.imageUrl} alt="" /> : null}
      <CardContent className="grid gap-3 p-4">
        <SourcePill restaurant={restaurant} />
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold leading-tight">{restaurant.name}</h2>
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
          {restaurant.distanceMiles ? (
            <Badge variant="secondary">{restaurant.distanceMiles.toFixed(1)} mi</Badge>
          ) : null}
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
