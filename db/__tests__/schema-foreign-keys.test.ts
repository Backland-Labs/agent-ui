import { describe, expect, it } from "vitest";
import * as schema from "../schema";

const sqliteForeignKeysSymbol = Symbol.for("drizzle:SQLiteInlineForeignKeys");

function getForeignKeys(table: unknown) {
  return (table as Record<symbol, unknown[]>)[sqliteForeignKeysSymbol] ?? [];
}

describe("schema foreign key callbacks", () => {
  it("evaluates all inline references", () => {
    const tables = [schema.threads, schema.runs, schema.messages];

    for (const table of tables) {
      const fks = getForeignKeys(table);
      for (const fk of fks) {
        const entry = fk as { reference: () => unknown };
        if (typeof entry.reference === "function") {
          expect(() => entry.reference()).not.toThrow();
        }
      }
    }
  });
});
