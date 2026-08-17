import { toast, type ExternalToast } from "sonner";

type NoticeOptions = ExternalToast & { description?: string };

function emit(
  kind: "success" | "error" | "warning" | "info",
  title: string,
  description?: string,
  options: NoticeOptions = {},
) {
  return toast[kind](title, {
    duration: kind === "error" ? 6000 : 4000,
    ...options,
    description: description ?? options.description,
  });
}

export const notify = {
  success: (title: string, description?: string, options?: NoticeOptions) => emit("success", title, description, options),
  error: (title: string, description?: string, options?: NoticeOptions) => emit("error", title, description, options),
  warning: (title: string, description?: string, options?: NoticeOptions) => emit("warning", title, description, options),
  info: (title: string, description?: string, options?: NoticeOptions) => emit("info", title, description, options),
  loading: (title: string, options?: NoticeOptions) => toast.loading(title, options),
  dismiss: (id?: string | number) => toast.dismiss(id),
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function firstText(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}

function isSafeApiMessage(message: string): boolean {
  return !/(exception|stack trace|java\.|org\.springframework|sqlstate|could not initialize proxy|failed to lazily)/i.test(message);
}

/** Converts common Axios/gateway errors into customer-safe action feedback. */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const root = asRecord(error);
  const response = asRecord(root?.response);
  const data = asRecord(response?.data);
  const status = typeof response?.status === "number" ? response.status : undefined;
  const apiMessage = firstText(data?.message, data?.error, root?.message);

  if (apiMessage && isSafeApiMessage(apiMessage) && !/^request failed with status code/i.test(apiMessage)) {
    return apiMessage;
  }

  switch (status) {
    case 401: return "Your session has expired. Please sign in again.";
    case 403: return "You do not have permission to perform this action.";
    case 404: return "The requested information could not be found.";
    case 409: return "This change conflicts with the current record. Refresh and try again.";
    case 422: return "Review the provided information and try again.";
    case 429: return "Too many requests. Please wait a moment and try again.";
    default: return status && status >= 500
      ? "The service is temporarily unavailable. Please try again shortly."
      : fallback;
  }
}
