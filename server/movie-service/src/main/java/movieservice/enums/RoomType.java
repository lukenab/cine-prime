package movieservice.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum RoomType {

    // maxSeats, seatsPerRow, displayName, vipRowRatio, coupleRowCount
    // vipRowRatio: ti le so hang VIP tren tong so hang con lai sau khi tru hang Couple (lam tron).
    // coupleRowCount: so hang cuoi cung (gan tuong sau) danh cho ghe Couple/Sweetbox - moi ghe Couple
    // chiem 2 cot vat ly (xem SeatType.colSpan), phong qua nho (< 3 hang) se tu bo qua vung Couple.
    // Theo thuc te CGV/Lotte: Standard luon nam o cac hang dau gan man hinh, VIP tu khoang giua tro di,
    // Couple/Sweetbox chi co o hang cuoi cung. IMAX khong co ghe Couple (gia dinh: phong IMAX uu tien
    // suc chua + da la hang ghe cao cap san, cac rap thuc te hiem khi bo tri ghe doi trong phong IMAX).
    STANDARD(100, 10, "Standard", 0.30, 1),
    LARGE(200, 10, "Large", 0.35, 1),
    IMAX(300, 15, "IMAX", 0.30, 0);

    private final int maxSeats;
    private final int seatsPerRow;
    private final String displayName;
    private final double vipRowRatio;
    private final int coupleRowCount;
}
