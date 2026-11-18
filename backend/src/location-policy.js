export const WORKER_LOCATION_TTL_MS = 2 * 60 * 1000;
export const WORKER_NEARBY_DISTANCE_METERS = 500;

export function normalizeCoordinates({ latitude, longitude }) {
  if (
    latitude === null || latitude === undefined || latitude === ''
    || longitude === null || longitude === undefined || longitude === ''
  ) {
    return null;
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

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

export function distanceMeters(from, to) {
  const start = normalizeCoordinates(from ?? {});
  const end = normalizeCoordinates(to ?? {});
  if (!start || !end) return null;

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = radians(end.latitude - start.latitude);
  const lngDelta = radians(end.longitude - start.longitude);
  const startLat = radians(start.latitude);
  const endLat = radians(end.latitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
