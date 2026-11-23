import { describe, expect, it } from 'vitest';
import { createDeviceLabelBatch, deviceLabelCode, parseDeviceLabel, randomDeviceBatchId } from './device-labels.js';

describe('device labels', () => {
  it('preserves the complete base36 alphabet', () => {
    expect(parseDeviceLabel(' tmp-oil0-0001 ')).toEqual({
      code: 'TMP-OIL0-0001', prefix: 'TMP', batchId: 'OIL0', sequence: 1,
    });
    expect(parseDeviceLabel('TMP-0110-0001')?.code).not.toBe('TMP-OIL0-0001');
    expect(parseDeviceLabel('TMP-A09Z-0000')).toBeNull();
    expect(parseDeviceLabel('7KQ4MZ')).toBeNull();
  });
  it('validates formatting and bounds', () => {
    expect(deviceLabelCode('TMP', 'A09Z', 1)).toBe('TMP-A09Z-0001');
    expect(() => deviceLabelCode('TMP', 'A09Z', 10000)).toThrow();
    expect(() => deviceLabelCode('TM', 'A09Z', 1)).toThrow();
    expect(randomDeviceBatchId()).toMatch(/^[0-9A-Z]{4}$/);
  });
  it('creates a consistent manifest with unique sequences and raw QR payloads', () => {
    const batch = createDeviceLabelBatch('TMP', 20, () => false);
    expect(batch.labels).toHaveLength(20);
    expect(batch.labels[0]?.code).toBe(deviceLabelCode('TMP', batch.batchId, 1));
    expect(batch.labels[19]?.code).toBe(deviceLabelCode('TMP', batch.batchId, 20));
    expect(new Set(batch.labels.map((label) => label.code)).size).toBe(20);
    expect(batch.labels.every((label) => label.qrPayload === label.code)).toBe(true);
    expect(() => createDeviceLabelBatch('TMP', 20, () => true)).toThrow();
  });
});
