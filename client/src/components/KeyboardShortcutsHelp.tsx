/**
 * ⌨️ KeyboardShortcutsHelp - مكون عرض اختصارات لوحة المفاتيح
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";

export interface ShortcutInfo {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  enabled?: boolean;
}

interface KeyboardShortcutsHelpProps {
  shortcuts: ShortcutInfo[];
}

export function KeyboardShortcutsHelp({ shortcuts }: KeyboardShortcutsHelpProps) {
  const enabledShortcuts = shortcuts.filter(s => s.enabled !== false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="اختصارات لوحة المفاتيح">
          <Keyboard className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            اختصارات لوحة المفاتيح
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 mt-4">
          {enabledShortcuts.map((shortcut, index) => (
            <div 
              key={index} 
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <span className="text-sm">{shortcut.description}</span>
              <kbd className="px-2 py-1 bg-background border border-border rounded text-xs font-mono shadow-sm">
                {shortcut.ctrl && 'Ctrl+'}
                {shortcut.shift && 'Shift+'}
                {shortcut.alt && 'Alt+'}
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          <strong>ملاحظة:</strong> الاختصارات لا تعمل أثناء الكتابة في حقول الإدخال
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsHelp;
