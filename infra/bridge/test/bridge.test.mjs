import { describe, expect, it } from 'vitest';

import { parseTopic, validateTelemetry } from '../src/index.mjs';

describe('parseTopic', () => {
  it('parses a valid device topic', () => {
    expect(parseTopic('tuturai/devices/dev-1/telemetry')).toEqual({
      deviceId: 'dev-1',
      leaf: 'telemetry',
    });
  });

  it('rejects a wildcard device segment', () => {
    expect(parseTopic('tuturai/devices/+/telemetry')).toBeNull();
  });

  it('rejects an unknown leaf', () => {
    expect(parseTopic('tuturai/devices/dev-1/secret')).toBeNull();
  });

  it('rejects a path with extra segments', () => {
    expect(parseTopic('tuturai/devices/dev-1/telemetry/extra')).toBeNull();
  });

  it('rejects a device id that could escape the namespace', () => {
    expect(parseTopic('tuturai/devices/../other/telemetry')).toBeNull();
    expect(parseTopic('tuturai/devices/dev 1/telemetry')).toBeNull();
  });

  it('rejects a non-string input', () => {
    expect(parseTopic(undefined)).toBeNull();
    expect(parseTopic(null)).toBeNull();
  });
});

describe('validateTelemetry', () => {
  it('accepts the three documented fields', () => {
    expect(validateTelemetry({ battery: 87, signal: 64, firmware: '0.1.0' })).toEqual({
      battery: 87,
      signal: 64,
      firmware: '0.1.0',
    });
  });

  it('rejects an unknown key, mirroring the server contract', () => {
    // apps/web/lib/devices.ts rejects extra keys, so the bridge must too or the
    // two sides would disagree about what is valid.
    expect(validateTelemetry({ battery: 87, temperature: 40 })).toBeNull();
  });

  it('rejects out-of-range percentages', () => {
    expect(validateTelemetry({ battery: 101 })).toBeNull();
    expect(validateTelemetry({ signal: -1 })).toBeNull();
    expect(validateTelemetry({ battery: 50.5 })).toBeNull();
  });

  it('rejects an over-long firmware string', () => {
    expect(validateTelemetry({ firmware: 'x'.repeat(65) })).toBeNull();
  });

  it('rejects an empty firmware string', () => {
    expect(validateTelemetry({ firmware: '   ' })).toBeNull();
  });

  it('rejects non-objects', () => {
    expect(validateTelemetry(null)).toBeNull();
    expect(validateTelemetry([])).toBeNull();
    expect(validateTelemetry('battery=90')).toBeNull();
  });
});