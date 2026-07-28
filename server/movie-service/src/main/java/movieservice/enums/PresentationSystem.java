package movieservice.enums;

/**
 * Commercial presentation system installed in an auditorium. This is kept
 * separate from projection technology: a ScreenX room may still use laser
 * projectors, while Dolby Cinema may use two projectors on one screen.
 */
public enum PresentationSystem {
    STANDARD,
    IMAX,
    DOLBY_CINEMA,
    SCREENX,
    FOUR_DX
}
