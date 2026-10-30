/**
 * تنزيل ملفات PDF المولّدة في الخادم (base64) - مشتركة بين صفحات المستندات
 */

/** تنزيل ملف PDF من base64 باسم الملف المحدد */
export function downloadBase64Pdf(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
