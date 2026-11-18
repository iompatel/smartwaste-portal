import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { LiveMapComponent } from './live-map.component';

describe('LiveMapComponent', () => {
  it('creates component and computes initial state signals', () => {
    const comp = new LiveMapComponent();
    expect(comp).toBeTruthy();
    expect(comp.etaText()).toBe('Live GPS Active');
    expect(comp.hasWorkerCoordinates()).toBe(false);
  });

  it('updates eta and distance texts based on tracking inputs', () => {
    const comp = new LiveMapComponent();
    comp.etaMinutes = 5;
    comp.distanceMeters = 850;
    comp.workerLat = 23.0225;
    comp.workerLng = 72.5714;
    (comp as any).updateData();

    expect(comp.etaText()).toBe('Arriving in ~5 min');
    expect(comp.distanceText()).toBe('850 m away');
    expect(comp.hasWorkerCoordinates()).toBe(true);
  });

  it('formats kilometer distance when distance >= 1000m', () => {
    const comp = new LiveMapComponent();
    comp.distanceMeters = 2400;
    comp.workerLat = 23.0225;
    comp.workerLng = 72.5714;
    (comp as any).updateData();

    expect(comp.distanceText()).toBe('2.4 km away');
  });
});
