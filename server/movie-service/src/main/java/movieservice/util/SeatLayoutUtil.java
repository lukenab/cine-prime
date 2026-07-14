package movieservice.util;

/**
 * Bố trí lối đi (aisle) trong sơ đồ ghế — 3 khối/hàng (trái–giữa–phải), khối giữa
 * chiếm phần còn lại sau khi trừ 2 khối biên. Khớp thực tế CGV/Lotte cho phòng
 * 10-15 ghế/hàng. Thuần tính toán, không lưu DB — cùng cách colSpan được suy ra
 * từ SeatType thay vì thêm cột mới.
 */
public final class SeatLayoutUtil {

    private static final float SIDE_BLOCK_RATIO = 0.25f;
    private static final int MIN_UNITS_FOR_AISLE = 6;

    private SeatLayoutUtil() {}

    /** Vị trí (1-indexed, theo đơn vị ghế đã tính colSpan) ngay trước mỗi lối đi. Rỗng nếu hàng quá hẹp để chia 3 khối rõ ràng. */
    public static int[] aisleBoundaryUnits(int unitsPerRow) {
        if (unitsPerRow < MIN_UNITS_FOR_AISLE) {
            return new int[0];
        }
        int side = Math.max(1, Math.round(unitsPerRow * SIDE_BLOCK_RATIO));
        return new int[]{side, unitsPerRow - side};
    }

    public static boolean hasAisleAfter(int colNumber, int colSpan, int seatsPerRow) {
        int unitsPerRow = seatsPerRow / colSpan;
        for (int boundary : aisleBoundaryUnits(unitsPerRow)) {
            if (colNumber == boundary) {
                return true;
            }
        }
        return false;
    }
}
