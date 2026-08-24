import type { RequestStateKind } from "../components/shared/RequestState";

export type RequestFailure = {
  kind: Exclude<RequestStateKind, "empty">;
  title?: string;
  description?: string;
  status?: number;
};

export function classifyRequestFailure(error: unknown, description?: string): RequestFailure {
  const candidate = error as {
    response?: { status?: number; data?: { message?: string } };
    message?: string;
  };
  const status = candidate?.response?.status;
  const serverMessage = candidate?.response?.data?.message;

  if (status === 401 || status === 403) {
    return {
      kind: "forbidden",
      status,
      description: description ?? "Your current role does not include the capability required for this page.",
    };
  }

  if (!status || status >= 500) {
    return {
      kind: "unavailable",
      status,
      description: description ?? "The service could not complete the request. Try again in a moment.",
    };
  }

  return {
    kind: "error",
    status,
    description: serverMessage ?? description ?? candidate?.message,
  };
}
