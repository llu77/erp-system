// Amiri Arabic Font - Base64 encoded
// This font supports Arabic text rendering in jsPDF

import { jsPDF } from 'jspdf';

// Function to load Amiri font dynamically
export async function loadAmiriFont(): Promise<string> {
  const response = await fetch('/fonts/Amiri-Regular.ttf');
  const buffer = await response.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  return base64;
}

// Function to add Amiri font to jsPDF document
export function addAmiriFontToDoc(doc: jsPDF, fontBase64: string): void {
  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
}

// Function to set Arabic text direction (RTL)
export function setArabicTextDirection(doc: jsPDF): void {
  doc.setFont('Amiri');
  doc.setR2L(true);
}
