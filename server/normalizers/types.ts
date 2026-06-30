export interface ResyVenueHit {
  id?: { resy?: number };
  name?: string;
  _geoloc?: { lat?: number; lng?: number };
  location?: { url_slug?: string; name?: string; code?: string };
  locality?: string;
  region?: string;
  country?: string;
  neighborhood?: string;
  cuisine?: string[];
  url_slug?: string;
  price_range_id?: number;
  rating?: { average?: number; count?: number };
  images?: string[];
}

export interface InKindLocation {
  location_id?: number;
  name?: string;
  brand_slug?: string;
  brand_id?: number;
  group_id?: number;
  selling?: boolean;
  loyalty?: boolean;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    phone_number?: string;
    zip_code?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  purchase_page_link?: string;
  rating?: number;
  review_count?: number;
  status?: string;
  tags?: Array<{ id?: number; featured?: boolean; ordinal?: number | null }>;
}

export interface InKindBrand {
  brand_slug?: string;
  name?: string;
  brand_id?: number;
  check_average?: string;
  branding?: {
    discoverable?: boolean;
    summary?: string;
    hero_image?: { value?: string | null };
    logo?: { light_logo?: string | null };
  };
  tags?: Array<{ id?: number; featured?: boolean; ordinal?: number | null }>;
}

export interface InKindTag {
  id?: number;
  name?: string;
  slug?: string;
  category?: string;
}
