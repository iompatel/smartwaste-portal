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

export function normalizeWorkerLocation({ latitude, longitude, accuracy, heading, speed }) {
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
  const result = { latitude: lat, longitude: lng, accuracy: acc };
  if (heading !== undefined && heading !== null && Number.isFinite(Number(heading)) && Number(heading) >= 0 && Number(heading) <= 360) {
    result.heading = Math.round(Number(heading));
  }
  if (speed !== undefined && speed !== null && Number.isFinite(Number(speed)) && Number(speed) >= 0 && Number(speed) <= 150) {
    result.speed = Number(Number(speed).toFixed(1));
  }
  return result;
}

export function isFreshWorkerLocation(updatedAt, now = Date.now()) {
  const timestamp = new Date(updatedAt ?? 0).getTime();
  return Number.isFinite(timestamp) && now - timestamp <= WORKER_LOCATION_TTL_MS;
}

export function calculateBearing(from, to) {
  const start = normalizeCoordinates(from ?? {});
  const end = normalizeCoordinates(to ?? {});
  if (!start || !end) return 0;

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const degrees = (rad) => (rad * 180) / Math.PI;

  const lat1 = radians(start.latitude);
  const lat2 = radians(end.latitude);
  const dLng = radians(end.longitude - start.longitude);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = degrees(Math.atan2(y, x));
  return Math.round((bearing + 360) % 360);
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
