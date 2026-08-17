import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { Toaster } from "sonner";

export function NotificationCenter() {
  return (
    <Toaster
      position="top-right"
      closeButton
      gap={10}
      offset={20}
      mobileOffset={12}
      visibleToasts={4}
      icons={{
        success: <CheckCircle2 size={18} />,
        error: <AlertCircle size={18} />,
        warning: <TriangleAlert size={18} />,
        info: <Info size={18} />,
        loading: <LoaderCircle size={18} className="animate-spin" />,
        close: <X size={14} />,
      }}
      toastOptions={{
        classNames: {
          toast: "cp-notification",
          title: "cp-notification__title",
          description: "cp-notification__description",
          icon: "cp-notification__icon",
          closeButton: "cp-notification__close",
          actionButton: "cp-notification__action",
          cancelButton: "cp-notification__cancel",
          success: "cp-notification--success",
          error: "cp-notification--error",
          warning: "cp-notification--warning",
          info: "cp-notification--info",
        },
      }}
    />
  );
}
