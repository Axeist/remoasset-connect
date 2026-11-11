import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Badge = ({ tone, children }: { tone: string; children: React.ReactNode }) => (
  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tone}`}>{children}</span>
);

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme = "light" } = useTheme();
  const isMobile = useIsMobile();

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      position={isMobile ? "top-center" : "top-right"}
      visibleToasts={3}
      closeButton
      className="toaster group"
      offset={isMobile ? "max(12px, env(safe-area-inset-top))" : 20}
      icons={{
        success: <Badge tone="bg-success/15 text-success-ink"><CheckCircle2 className="h-[18px] w-[18px]" /></Badge>,
        error: <Badge tone="bg-destructive/15 text-destructive-ink"><XCircle className="h-[18px] w-[18px]" /></Badge>,
        warning: <Badge tone="bg-warning/15 text-warning-ink"><AlertTriangle className="h-[18px] w-[18px]" /></Badge>,
        info: <Badge tone="bg-info/15 text-info-ink"><Info className="h-[18px] w-[18px]" /></Badge>,
        loading: <Badge tone="bg-primary/15 text-primary"><Loader2 className="h-[18px] w-[18px] animate-spin" /></Badge>,
      }}
      toastOptions={{
        duration: 4200,
        classNames: {
          toast:
            "group toast glass-strong group-[.toaster]:rounded-[18px] group-[.toaster]:border group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.35)] group-[.toaster]:gap-3",
          title: "group-[.toast]:font-semibold group-[.toast]:text-[14px] group-[.toast]:leading-snug",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[13px]",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:font-semibold group-[.toast]:h-8 group-[.toast]:px-3",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
