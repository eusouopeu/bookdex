import { describe, expect, it } from "vitest";
import { fitsInQr, QR_MAX_CHARS } from "./qr";

describe("qr / fitsInQr", () => {
  it("accepts text at or under the limit", () => {
    expect(fitsInQr("a".repeat(QR_MAX_CHARS))).toBe(true);
    expect(fitsInQr("")).toBe(true);
  });

  it("rejects text over the limit", () => {
    expect(fitsInQr("a".repeat(QR_MAX_CHARS + 1))).toBe(false);
  });
});
