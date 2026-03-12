import type { GeocodeResult } from '../types/geocode';

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export async function searchLocation(query: string): Promise<GeocodeResult[]> {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'EarthDigitalTwin/1.0 (contact@example.com)'
    }
  });

  if (!response.ok) {
    throw new Error(`Geocoder failed with status ${response.status}`);
  }

  const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((item) => ({
    displayName: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('lon', lon.toString());
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '18'); // Building level zoom

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'EarthDigitalTwin/1.0 (contact@example.com)',
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.display_name || data.name || null;
  } catch (err) {
    console.warn('[geocodeService] Reverse geocode failed:', err);
    return null;
  }
}
