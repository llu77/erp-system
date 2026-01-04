import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScrollToTopProps {
  threshold?: number;
  className?: string;
}

export function ScrollToTop({ threshold = 300, className }: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn(
        "fixed bottom-6 left-6 z-50 h-12 w-12 rounded-full shadow-lg transition-all duration-300",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none",
        className
      )}
      onClick={scrollToTop}
      aria-label="العودة للأعلى"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
