import { describe, expect, it } from "vitest";
import { cliBinContractError } from "../scripts/release-preflight.js";

const expectedBin = "./bin/moluoxixi.js";

describe("release preflight CLI bin contract", () => {
  it("accepts the canonical command and ml alias without tl", () => {
    expect(
      cliBinContractError({
        moluoxixi: expectedBin,
        ml: expectedBin,
      }),
    ).toBeNull();
  });

  it("rejects a missing ml alias", () => {
    expect(cliBinContractError({ moluoxixi: expectedBin })).toBe(
      `bin.ml is "undefined" but expected "${expectedBin}".`,
    );
  });

  it("rejects an incorrect canonical command target", () => {
    expect(
      cliBinContractError({
        moluoxixi: "./bin/other.js",
        ml: expectedBin,
      }),
    ).toBe(`bin.moluoxixi is "./bin/other.js" but expected "${expectedBin}".`);
  });

  it("rejects the legacy tl alias", () => {
    expect(
      cliBinContractError({
        moluoxixi: expectedBin,
        ml: expectedBin,
        tl: expectedBin,
      }),
    ).toBe("must not expose the legacy tl alias.");
  });
});
