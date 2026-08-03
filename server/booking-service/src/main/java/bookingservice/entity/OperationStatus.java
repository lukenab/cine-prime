package bookingservice.entity;

public enum OperationStatus {
    IN_PROGRESS,
    SUCCEEDED,
    FAILED_RETRYABLE,
    FAILED_TERMINAL
}
