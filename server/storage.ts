// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';
import { StorageException } from './exceptions';

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new StorageException(
      "بيانات اعتماد التخزين مفقودة: يرجى تعيين BUILT_IN_FORGE_API_URL و BUILT_IN_FORGE_API_KEY",
      undefined,
      undefined,
      undefined,
      undefined,
      { missingCredentials: true }
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  
  try {
    const response = await fetch(downloadApiUrl, {
      method: "GET",
      headers: buildAuthHeaders(apiKey),
    });
    
    if (!response.ok) {
      throw new StorageException(
        `فشل الحصول على رابط التحميل (${response.status})`,
        'download',
        undefined,
        relKey,
        undefined,
        { statusCode: response.status, statusText: response.statusText }
      );
    }
    
    return (await response.json()).url;
  } catch (error) {
    if (error instanceof StorageException) throw error;
    throw new StorageException(
      'فشل الاتصال بخدمة التخزين',
      'download',
      undefined,
      relKey,
      error instanceof Error ? error : undefined,
      { originalError: String(error) }
    );
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  
  try {
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: buildAuthHeaders(apiKey),
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new StorageException(
        `فشل رفع الملف إلى التخزين (${response.status} ${response.statusText}): ${message}`,
        'upload',
        undefined,
        key,
        undefined,
        { 
          statusCode: response.status, 
          statusText: response.statusText,
          responseMessage: message,
          contentType 
        }
      );
    }
    
    const url = (await response.json()).url;
    return { key, url };
  } catch (error) {
    if (error instanceof StorageException) throw error;
    throw new StorageException(
      'فشل الاتصال بخدمة التخزين أثناء الرفع',
      'upload',
      undefined,
      key,
      error instanceof Error ? error : undefined,
      { originalError: String(error), contentType }
    );
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

export async function storageDelete(relKey: string): Promise<{ success: boolean }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  
  try {
    const deleteUrl = new URL("v1/storage/delete", ensureTrailingSlash(baseUrl));
    deleteUrl.searchParams.set("path", key);
    
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: buildAuthHeaders(apiKey),
    });

    if (!response.ok) {
      throw new StorageException(
        `فشل حذف الملف من التخزين (${response.status})`,
        'delete',
        undefined,
        key,
        undefined,
        { statusCode: response.status }
      );
    }
    
    return { success: true };
  } catch (error) {
    if (error instanceof StorageException) throw error;
    throw new StorageException(
      'فشل الاتصال بخدمة التخزين أثناء الحذف',
      'delete',
      undefined,
      key,
      error instanceof Error ? error : undefined,
      { originalError: String(error) }
    );
  }
}
