/**
 * روابط صور ملف الموظف: تجديد الرابط من مفتاح التخزين، والرجوع للرابط المحفوظ عند تعطل التخزين
 * دون انتظار مهلة كل ملف في القوائم
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({ storageGet: vi.fn() }));

import { storageGet } from "./storage";
import { URL_FAILURE_TTL_MS, resetStorageCircuitForTests, resolveStoredFileUrl } from "./employeeFile/service";

const IQAMA_KEY = "employees/10/iqama.jpg";
const PHOTO_KEY = "employees/10/photo.jpg";
const STORED_IQAMA_URL = "https://storage.example/iqama-old";
const STORED_PHOTO_URL = "https://storage.example/photo-old";
const FRESH_IQAMA_URL = "https://storage.example/iqama-fresh";
const FRESH_PHOTO_URL = "https://storage.example/photo-fresh";

describe("resolveStoredFileUrl", () => {
  beforeEach(() => {
    resetStorageCircuitForTests();
    vi.mocked(storageGet).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a fresh URL from the storage key and caches it", async () => {
    vi.mocked(storageGet).mockResolvedValue({ key: IQAMA_KEY, url: FRESH_IQAMA_URL });
    await expect(resolveStoredFileUrl(IQAMA_KEY, STORED_IQAMA_URL)).resolves.toBe(FRESH_IQAMA_URL);
    await expect(resolveStoredFileUrl(IQAMA_KEY, STORED_IQAMA_URL)).resolves.toBe(FRESH_IQAMA_URL);
    expect(storageGet).toHaveBeenCalledTimes(1);
  });

  it("uses the stored URL when there is no key, and null when there is nothing at all", async () => {
    await expect(resolveStoredFileUrl(null, STORED_IQAMA_URL)).resolves.toBe(STORED_IQAMA_URL);
    await expect(resolveStoredFileUrl("", STORED_IQAMA_URL)).resolves.toBe(STORED_IQAMA_URL);
    await expect(resolveStoredFileUrl(undefined, undefined)).resolves.toBeNull();
    await expect(resolveStoredFileUrl("", "")).resolves.toBeNull();
    expect(storageGet).not.toHaveBeenCalled();
  });

  it("keeps the stored URL when storage answers with an empty URL", async () => {
    vi.mocked(storageGet).mockResolvedValue({ key: IQAMA_KEY, url: "" });
    await expect(resolveStoredFileUrl(IQAMA_KEY, STORED_IQAMA_URL)).resolves.toBe(STORED_IQAMA_URL);
    await expect(resolveStoredFileUrl(IQAMA_KEY, "")).resolves.toBeNull();
  });

  it("after a storage failure, falls back for other files too until the retry interval has passed", async () => {
    vi.useFakeTimers();
    vi.mocked(storageGet).mockRejectedValueOnce(new Error("storage down"));
    await expect(resolveStoredFileUrl(IQAMA_KEY, STORED_IQAMA_URL)).resolves.toBe(STORED_IQAMA_URL);

    // ملف آخر حتى آخر جزء من الثانية في المهلة: لا محاولة جديدة
    vi.advanceTimersByTime(URL_FAILURE_TTL_MS - 1);
    await expect(resolveStoredFileUrl(PHOTO_KEY, STORED_PHOTO_URL)).resolves.toBe(STORED_PHOTO_URL);
    expect(storageGet).toHaveBeenCalledTimes(1);

    // عند انتهاء المهلة تماماً تُعاد المحاولة
    vi.advanceTimersByTime(1);
    vi.mocked(storageGet).mockResolvedValue({ key: PHOTO_KEY, url: FRESH_PHOTO_URL });
    await expect(resolveStoredFileUrl(PHOTO_KEY, STORED_PHOTO_URL)).resolves.toBe(FRESH_PHOTO_URL);
    expect(storageGet).toHaveBeenCalledTimes(2);
  });
});
