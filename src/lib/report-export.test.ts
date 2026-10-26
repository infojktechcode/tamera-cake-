import { describe, expect, it } from "vitest";

import { buildCsv } from "./report-export";

describe("buildCsv", () => {
  it("quotes fields and escapes embedded quotes", () => {
    expect(buildCsv(["Name", "Note"], [['Tamera', 'Said "hello", thanks']])).toBe(
      '"Name","Note"\r\n"Tamera","Said ""hello"", thanks"',
    );
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(buildCsv(["Value"], [["=1+1"], ["  @SUM(A1:A2)"], ["-2"]])).toBe(
      '"Value"\r\n"\'=1+1"\r\n"\'  @SUM(A1:A2)"\r\n"\'-2"',
    );
  });
});
