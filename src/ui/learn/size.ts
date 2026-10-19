// File sizes as Learn mode shows them: "1.76 MB", "160 KB" (1 MB = 1 000 000 bytes).
export const sizeText = (bytes: number): string =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(2)} GB`
    : bytes >= 1e6
      ? `${(bytes / 1e6).toFixed(2)} MB`
      : `${Math.round(bytes / 1e3)} KB`;
