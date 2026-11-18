const ADDRESS_FIELDS = [
  'name',
  'housenumber',
  'street',
  'district',
  'city',
  'county',
  'state',
  'postcode',
  'country',
];

export function photonSuggestions(payload, limit = 5) {
  const suggestions = [];
  const seen = new Set();
  for (const feature of Array.isArray(payload?.features) ? payload.features : []) {
    const [longitude, latitude] = Array.isArray(feature?.geometry?.coordinates)
      ? feature.geometry.coordinates
      : [];
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) continue;

    const parts = ADDRESS_FIELDS
      .map((field) => String(feature?.properties?.[field] ?? '').trim())
      .filter((part, index, list) => part && list.findIndex((value) => value.toLowerCase() === part.toLowerCase()) === index);
    const label = parts.join(', ').slice(0, 500);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    suggestions.push({ label, latitude: Number(latitude), longitude: Number(longitude) });
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}
