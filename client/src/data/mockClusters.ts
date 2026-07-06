import type { ClusterResponse } from "../api/movieApi";

export const mockClusters: ClusterResponse[] = [
  {
    clusterId: 1,
    clusterName: "CinePrime District 1",
    province: "Ho Chi Minh City",
    address: "123 Nguyen Hue, District 1",
    phoneNumber: "028 3822 1234",
    status: "ACTIVE",
    totalRooms: 5,
    totalSeats: 650,
  },
  {
    clusterId: 2,
    clusterName: "CinePrime Thu Duc",
    province: "Ho Chi Minh City",
    address: "456 Vo Van Ngan, Thu Duc",
    phoneNumber: "028 3896 5678",
    status: "ACTIVE",
    totalRooms: 4,
    totalSeats: 480,
  },
  {
    clusterId: 3,
    clusterName: "CinePrime Hoan Kiem",
    province: "Hanoi",
    address: "78 Hang Bai, Hoan Kiem",
    phoneNumber: "024 3936 9012",
    status: "ACTIVE",
    totalRooms: 6,
    totalSeats: 820,
  },
  {
    clusterId: 4,
    clusterName: "CinePrime Hai Chau",
    province: "Da Nang",
    address: "30 Tran Phu, Hai Chau",
    phoneNumber: "0236 382 7890",
    status: "ACTIVE",
    totalRooms: 3,
    totalSeats: 360,
  },
];
