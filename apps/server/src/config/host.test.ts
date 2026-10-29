import { describe, expect, it } from 'vitest';
import { effectiveMemoryBytes, hostResources } from './host.js';

const GiB = 1024 ** 3;

describe('effectiveMemoryBytes', () => {
  it("is the container's limit when it is below the host's RAM", () => {
    expect(effectiveMemoryBytes(16 * GiB, 1 * GiB)).toBe(1 * GiB);
  });

  it("is the host's RAM without a limit: 0, or the 2^64 an unlimited cgroup reports", () => {
    expect(effectiveMemoryBytes(16 * GiB, 0)).toBe(16 * GiB);
    expect(effectiveMemoryBytes(16 * GiB, 2 ** 64)).toBe(16 * GiB);
    expect(effectiveMemoryBytes(16 * GiB, Number.NaN)).toBe(16 * GiB);
  });

  it("is the host's RAM when the limit is above it", () => {
    expect(effectiveMemoryBytes(2 * GiB, 4 * GiB)).toBe(2 * GiB);
  });

  it("reads this process's host and cgroup by default", () => {
    expect(effectiveMemoryBytes()).toBeGreaterThan(0);
    const host = hostResources();
    expect(host.memBytes).toBe(effectiveMemoryBytes());
    expect(host.cpus).toBeGreaterThanOrEqual(1);
  });
});
