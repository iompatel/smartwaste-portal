export const WORKER_LOCATION_TTL_MS = 2 * 60 * 1000;

export function normalizeWorkerLocation({ latitude, longitude, accuracy }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const acc = Number(accuracy);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(acc) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    acc < 0 ||
    acc > 5_000
  ) {
    return null;
  }
  return { latitude: lat, longitude: lng, accuracy: acc };
}

export function isFreshWorkerLocation(updatedAt, now = Date.now()) {
  const timestamp = new Date(updatedAt ?? 0).getTime();
  return Number.isFinite(timestamp) && now - timestamp <= WORKER_LOCATION_TTL_MS;
}
