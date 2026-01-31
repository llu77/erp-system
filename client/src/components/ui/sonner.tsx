import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  // استخدام ThemeContext المحلي بدلاً من next-themes
  let theme: "light" | "dark" | "system" = "dark";
  
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
  } catch {
    // إذا لم يكن ThemeProvider متاحاً، استخدم القيمة الافتراضية
    theme = "dark";
  }

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      expand={true}
      richColors={true}
      closeButton={true}
      duration={4000}
      visibleToasts={3}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:px-4 group-[.toaster]:py-3",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:bg-red-950 group-[.toaster]:border-red-800 group-[.toaster]:text-red-100",
          success: "group-[.toaster]:bg-green-950 group-[.toaster]:border-green-800 group-[.toaster]:text-green-100",
          warning: "group-[.toaster]:bg-yellow-950 group-[.toaster]:border-yellow-800 group-[.toaster]:text-yellow-100",
          info: "group-[.toaster]:bg-blue-950 group-[.toaster]:border-blue-800 group-[.toaster]:text-blue-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
