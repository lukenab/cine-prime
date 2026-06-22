# Movie Theater Management System

## Project Overview

**CinePrime** is a Movie Theater Management System built with a microservices architecture. It provides a seamless ticket-booking experience for customers and a robust admin dashboard for cinema operators to manage movies, showtimes, users, and revenue.

This project is developed as part of the **FPT Software OJT Program — HCM26_CPL_JAVA_05 (Group 1)**.

---

## Repository Structure

```
hcm26_cpl_java_05_group1/
├── client/                          # React + TypeScript + Vite SPA
│   ├── src/
│   │   ├── api/                     # Axios API clients
│   │   ├── components/              # Reusable UI components (shadcn/ui)
│   │   ├── context/                 # AuthContext (JWT state)
│   │   ├── layouts/                 # Page shells & shared layouts
│   │   ├── pages/
│   │   │   ├── admin/               # Dashboard, Users, Movies, Showtimes
│   │   │   ├── auth/                # Login, Register (OTP flow)
│   │   │   └── customer/            # Homepage
│   │   └── routes/                  # AppRoutes, ProtectedRoute
│   ├── package.json
│   └── vite.config.ts
│
├── server/
│   ├── common/                      # Shared library (ApiResponse, AppException)
│   ├── api-gateway/                 # Spring Cloud Gateway        :8080
│   ├── discovery-server/            # Netflix Eureka              :8761
│   ├── auth-service/                # Authentication & accounts   :8088
│   ├── movie-service/               # Movies, showtimes, rooms    :8081
│   ├── user-service/                # User profiles & audit logs  :8084
│   ├── booking-service/             # Ticket booking (WIP)        :8082
│   ├── payment-service/             # Payment processing (WIP)    :8083
│   ├── promotion-service/           # Promotions & vouchers (WIP) :8086
│   └── notification-service/        # Email via Kafka (WIP)       :8087
│
├── docs/
├── postgres-init/                   # SQL init scripts for all DBs
├── docker-compose.yml
├── CONTRIBUTING.md
└── README.md
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 6 | Type safety |
| Vite | 8 | Build tool (dev server on port 3000) |
| Tailwind CSS | 4 | Utility-first styling |
| shadcn/ui (Radix UI) | — | Accessible component library |
| React Router DOM | 7 | Client-side routing |
| Axios | 1.x | HTTP client |
| Recharts | 3 | Dashboard charts |
| jwt-decode | 4 | Decode JWT for auth state |
| Lucide React | — | Icons |

### Backend
| Technology | Purpose |
|---|---|
| Java 21 | Language |
| Spring Boot 3 | Service framework |
| Spring Cloud Gateway | API Gateway & routing |
| Netflix Eureka | Service discovery & registration |
| Spring Cloud OpenFeign | Synchronous inter-service calls |
| Spring Security + JWT | Authentication & authorization |
| Spring Data JPA (Hibernate) | ORM |
| MapStruct | DTO ↔ Entity mapping |
| Lombok | Boilerplate reduction |
| Cloudinary | Movie poster image storage |

### Infrastructure & Messaging
| Technology | Version | Purpose |
|---|---|---|
| PostgreSQL | 16 | Primary database (all services) |
| Redis | Alpine | OTP/session caching, seat locking |
| Apache Kafka | 3.7.0 KRaft | Async event-driven messaging |
| Docker & Docker Compose | — | Containerization |

---

## Service Ports

| Service | Port | Description |
|---|---|---|
| client | 3000 | React SPA |
| api-gateway | 8080 | Single entry point for all API calls |
| discovery-server | 8761 | Eureka dashboard |
| auth-service | 8088 | Login, register (OTP), account management |
| movie-service | 8081 | Movies, showtimes, cinema rooms |
| user-service | 8084 | User profiles |
| booking-service | 8082 | Ticket bookings *(WIP)* |
| payment-service | 8083 | Payments *(WIP)* |
| promotion-service | 8086 | Promotions *(WIP)* |
| notification-service | 8087 | Email notifications via Kafka *(WIP)* |
| PostgreSQL | 5433 | Mapped from container port 5432 |
| Redis | 6379 | — |
| Kafka | 9092 | External / host access |

---

## API Reference

All requests go through `http://localhost:8080`.

### Authentication — `/api/auth`
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register/initiate` | Start registration, sends OTP to email |
| `POST` | `/api/auth/register/verify` | Verify OTP and create account |
| `POST` | `/api/auth/login` | Login, returns JWT |
| `POST` | `/api/auth/resend-otp` | Resend OTP |

### Account Management — `/api/accounts` *(Admin)*
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/accounts` | List all accounts |
| `GET` | `/api/accounts/{id}` | Get account by ID |
| `POST` | `/api/accounts` | Create account (admin) |
| `PUT` | `/api/accounts/{id}` | Update account (triggers Kafka → user-service) |

### User Profiles — `/api/users`
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | Get paginated users (`?page=1&size=10`) |
| `GET` | `/api/users/{id}` | Get user profile |
| `PUT` | `/api/users/{id}` | Update user profile |
| `DELETE` | `/api/users/{id}` | Soft-delete user |
| `GET` | `/api/users/check-existence` | Check phone/identity card uniqueness |

### Movies — `/api/movies`
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/movies` | Get paginated movies (`?page=1&size=10`) |
| `GET` | `/api/movies/{id}` | Get movie by ID |
| `POST` | `/api/movies` | Create movie |
| `PUT` | `/api/movies/{id}` | Update movie |
| `DELETE` | `/api/movies/{id}` | Delete movie |
| `POST` | `/api/movies/room` | Create cinema room |
| `POST` | `/api/movies/type` | Create movie type |

---

## Kafka Topics

| Topic | Producer | Consumer | Trigger |
|---|---|---|---|
| `user-register-topic` | auth-service | user-service | New account registered via OTP |
| `user-update-topic` | auth-service | user-service | Account profile updated by admin |

---

## Databases

Each service owns its own PostgreSQL database (DB-per-service pattern):

| Database | Service |
|---|---|
| `auth_db` | auth-service |
| `movie_db` | movie-service |
| `user_db` | user-service |
| `booking_db` | booking-service |
| `payment_db` | payment-service |
| `promotion_db` | promotion-service |

Init scripts are in `postgres-init/` and run automatically on first container start.

---

## Getting Started

### Prerequisites
- **Java 21**
- **Node.js 18+**
- **Docker Desktop**

### 1. Clone the repository
```bash
git clone <your-gitlab-repo-url>
cd hcm26_cpl_java_05_group1
git checkout develop
```

### 2. Start all backend services (Docker Compose)
```bash
docker-compose up -d --build
```

Wait ~1–2 minutes for all containers to be healthy.

| URL | Description |
|---|---|
| http://localhost:8761 | Eureka — verify all services are registered |
| http://localhost:8080 | API Gateway — all API requests go here |

To stop:
```bash
docker-compose down
```

### 3. Run the frontend
```bash
cd client
npm install
npm run dev
```

Open http://localhost:3000.

> **Note:** The single React app serves both the customer-facing homepage (`/`) and the admin dashboard (`/admin`). Admin routes are protected — you must log in with an `ADMIN` role account.

---

## Contribution Guidelines

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before pushing any code.

- **Never** push directly to `main` or `develop`.
- Always branch off `develop` — e.g., `feature/login-page`, `fix/kafka-consumer`.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `refactor:`, etc.
- Open a Merge Request to `develop` and request a review from the Team Leader.

---

## Team Members

| Name | Role |
|---|---|
| **Nguyễn An Bình** | Team Leader / Developer |
| **Diệp Đăng Khoa** | Developer |
| **Nguyễn Mạnh Khải** | Developer |
| **Lê Tấn Lộc** | Developer |
| **Trần Nhật Duy** | Developer |
