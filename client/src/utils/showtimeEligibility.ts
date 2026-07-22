import type { RoomResponse } from "../api/movieApi";

export type ClusterScheduleEligibility = {
  schedulable: boolean;
  eligibleRoomCount: number;
  totalRoomCount: number;
  reason?: string;
};

/** A schedulable room has both an operational room and sellable seat inventory. */
export function isRoomSchedulable(room: RoomResponse): boolean {
  return (
    room.status === "ACTIVE" &&
    room.seatQuantity > 0 &&
    room.activeLayout?.status === "ACTIVE" &&
    (room.activeLayout.personCapacity ?? 0) > 0 &&
    (room.activeLayout.sellableUnitCount ?? 0) > 0
  );
}

export function assessClusterEligibility(rooms: RoomResponse[]): ClusterScheduleEligibility {
  const activeRooms = rooms.filter((room) => room.status === "ACTIVE");
  const eligibleRooms = rooms.filter(isRoomSchedulable);

  if (rooms.length === 0) {
    return { schedulable: false, eligibleRoomCount: 0, totalRoomCount: 0, reason: "No screening room has been created." };
  }
  if (activeRooms.length === 0) {
    return { schedulable: false, eligibleRoomCount: 0, totalRoomCount: rooms.length, reason: "No room is currently ACTIVE." };
  }
  if (eligibleRooms.length === 0) {
    return { schedulable: false, eligibleRoomCount: 0, totalRoomCount: rooms.length, reason: "Active rooms need an ACTIVE sellable seat layout." };
  }
  return { schedulable: true, eligibleRoomCount: eligibleRooms.length, totalRoomCount: rooms.length };
}
