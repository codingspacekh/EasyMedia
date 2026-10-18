// Exact sample-for-sample equality, compared as bytes: toEqual walks long sample arrays one
// value at a time, which takes seconds on a busy CI runner.
export const sameSamples = (a: Float32Array, b: Float32Array): boolean =>
  Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(
    Buffer.from(b.buffer, b.byteOffset, b.byteLength),
  );
