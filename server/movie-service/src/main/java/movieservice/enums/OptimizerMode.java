package movieservice.enums;

/**
 * Which schedule optimizer a generation run should use. SHADOW_COMPARE runs both LEGACY and
 * CP_SAT against the same immutable candidate input and persists only the primary result
 * (LEGACY, kept as the safety default) while recording comparison diagnostics for both.
 */
public enum OptimizerMode {
    LEGACY,
    CP_SAT,
    SHADOW_COMPARE
}
