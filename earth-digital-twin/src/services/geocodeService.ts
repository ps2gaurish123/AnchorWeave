import type { GeocodeResult } from '../types/geocode';

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export async function searchLocation(query: string): Promise<GeocodeResult[]> {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Geocoder failed with status ${response.status}`);
  }

  const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((item) => ({
    displayName: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon)
  }));
}
