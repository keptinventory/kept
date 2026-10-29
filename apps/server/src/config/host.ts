import os from 'node:os';

// What this process may use of the machine. `os.totalmem()` is the host's RAM even inside a
// container with a memory limit; `process.constrainedMemory()` is that limit (cgroup v1/v2), 0
// where there is none and a 2^64-sized number where the cgroup is unlimited. Kept's own defaults
// (image concurrency, restic's Go runtime) follow the smaller of the two, as Node's heap does.

/** The memory this process may use: the container's limit when it is below the host's RAM. */
export function effectiveMemoryBytes(
  totalBytes: number = os.totalmem(),
  constrainedBytes: number = process.constrainedMemory(),
): number {
  return Number.isFinite(constrainedBytes) && constrainedBytes > 0 && constrainedBytes < totalBytes
    ? constrainedBytes
    : totalBytes;
}

export type HostResources = {
  /** CPUs this process may run on (affinity and cpuset; os.availableParallelism). */
  cpus: number;
  /** effectiveMemoryBytes(). */
  memBytes: number;
};

export function hostResources(): HostResources {
  return { cpus: os.availableParallelism(), memBytes: effectiveMemoryBytes() };
}
