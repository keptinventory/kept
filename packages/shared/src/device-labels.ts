/** Device-generated printed aliases, separate from legacy Crockford short IDs. */
export const DEVICE_LABEL_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DEVICE_LABEL_CODE = /^[A-Z]{3}-[0-9A-Z]{4}-[0-9]{4}$/;

export function parseDeviceLabel(input: string) {
  const code = input.trim().toUpperCase();
  if (!DEVICE_LABEL_CODE.test(code)) return null;
  const prefix = code.slice(0, 3);
  const batchId = code.slice(4, 8);
  const sequence = Number(code.slice(9));
  if (sequence === 0) return null;
  return { code, prefix, batchId, sequence };
}

/** Rejection sampling avoids modulo bias; I, L, O and U remain distinct. */
export function randomDeviceBatchId(): string {
  let code = '';
  while (code.length < 4) {
    for (const byte of crypto.getRandomValues(new Uint8Array(8))) {
      if (byte < 252) code += DEVICE_LABEL_ALPHABET.charAt(byte % 36);
      if (code.length === 4) break;
    }
  }
  return code;
}

export function deviceLabelCode(prefix: string, batchId: string, sequence: number): string {
  if (!/^[A-Z]{3}$/.test(prefix) || !/^[0-9A-Z]{4}$/.test(batchId)) {
    throw new RangeError('Invalid label prefix or batch ID');
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new RangeError('Label sequence must be 1–9999');
  }
  return `${prefix}-${batchId}-${String(sequence).padStart(4, '0')}`;
}

/** Allocate once and persist the returned manifest before printing; reprints reuse it.
 * A caller must check persistent local reservations and reconcile server collisions.
 * Raw QR aliases are not registered Kept URLs until a resolver is implemented.
 */
export function createDeviceLabelBatch(
  prefix: string,
  count: number,
  isReserved: (prefix: string, batchId: string) => boolean,
) {
  if (!/^[A-Z]{3}$/.test(prefix) || !Number.isInteger(count) || count < 1 || count > 9999) {
    throw new RangeError('Invalid prefix or label count');
  }
  for (let attempt = 0; attempt < 128; attempt++) {
    const batchId = randomDeviceBatchId();
    if (isReserved(prefix, batchId)) continue;
    return {
      id: crypto.randomUUID(),
      prefix,
      batchId,
      labels: Array.from({ length: count }, (_, i) => {
        const code = deviceLabelCode(prefix, batchId, i + 1);
        return { id: crypto.randomUUID(), code, qrPayload: code };
      }),
    };
  }
  throw new Error('Unable to allocate an unused label batch ID');
}
