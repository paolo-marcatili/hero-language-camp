import { afterEach, describe, expect, it, vi } from "vitest";
import { safeLocalStorage } from "./safeStorage";

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ["t-rw", "t-quota", "t-clear", "t-rm", "nothing-here"]) safeLocalStorage.removeItem(key);
  window.localStorage.clear();
});

describe("safeLocalStorage", () => {
  it("reads and writes through to localStorage", () => {
    expect(safeLocalStorage.setItem("t-rw", "v")).toBe(true);
    expect(window.localStorage.getItem("t-rw")).toBe("v");
    expect(safeLocalStorage.getItem("t-rw")).toBe("v");
  });
  it("keeps the value in memory when setItem throws (quota)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(safeLocalStorage.setItem("t-quota", "x")).toBe(false);
    expect(safeLocalStorage.getItem("t-quota")).toBe("x");
    expect(safeLocalStorage.keys()).toContain("t-quota");
  });
  it("drops the memory override after a later successful write", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    safeLocalStorage.setItem("t-clear", "old");
    spy.mockRestore();
    expect(safeLocalStorage.setItem("t-clear", "new")).toBe(true);
    expect(window.localStorage.getItem("t-clear")).toBe("new");
    expect(safeLocalStorage.getItem("t-clear")).toBe("new");
  });
  it("removeItem clears both stores", () => {
    safeLocalStorage.setItem("t-rm", "1");
    safeLocalStorage.removeItem("t-rm");
    expect(window.localStorage.getItem("t-rm")).toBeNull();
    expect(safeLocalStorage.getItem("t-rm")).toBeNull();
  });
  it("returns null when getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(safeLocalStorage.getItem("nothing-here")).toBeNull();
  });
});
