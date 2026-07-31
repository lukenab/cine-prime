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
│   ├── concession-service/          # Catalog, stock & pickup     :8085
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
| concession-service | 8085 | Concession catalog, reservation and fulfillment |
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
| `GET` | `/api/movies/all` | Get all movies (no pagination) |
| `GET` | `/api/movies/{id}` | Get movie by ID |
| `POST` | `/api/movies` | Create movie with showtimes |
| `PUT` | `/api/movies/{id}` | Update movie |
| `DELETE` | `/api/movies/{id}` | Soft-delete movie |

### Cinema Rooms — `/api/cinema-rooms`
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cinema-rooms` | Get all cinema rooms |
| `POST` | `/api/cinema-rooms` | Create cinema room (auto-generates seats) |

### Movie Types — `/api/movie-type`
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/movie-type` | Get all movie genres |
| `POST` | `/api/movie-type` | Create movie genre |

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
| `concession_db` | concession-service |

Init scripts are in `postgres-init/` and run automatically on first container start.

---

## Getting Started

### Prerequisites
- **Java 21**
- **Node.js 18+**
- **Docker Desktop**
- **Maven 3.8+** (or use the included `mvnw` wrapper)

### 1. Clone the repository
```bash
git clone <your-gitlab-repo-url>
cd hcm26_cpl_java_05_group1
git checkout develop
```

### 2. Start infrastructure services (Docker Compose)

The `docker-compose.yml` runs only the infrastructure layer. Microservices are started separately through your IDE or Maven.

```bash
docker compose up -d
```

If the PostgreSQL volume was created before `concession_db` was added, create
the new service database once without deleting existing data:

```powershell
.\scripts\create-concession-database.ps1
```

This starts:
| Container | Port | Description |
|---|---|---|
| `postgres` | 5433 | PostgreSQL — all databases are created automatically via `postgres-init/` |
| `kafka` | 9092 | Apache Kafka (KRaft mode) |
| `redis` | 6379 | Redis |

To stop without losing database data:
```bash
docker compose down
```

> **Warning:** Do **not** use `docker compose down -v` — the `-v` flag deletes the `postgres_data` volume and all data.

### 3. Run the backend microservices

Start each service in your IDE (IntelliJ / VS Code) or via Maven. Start in this order:

```
1. discovery-server   (wait until Eureka dashboard is up at http://localhost:8761)
2. api-gateway
3. auth-service
4. movie-service
5. user-service
6. booking-service    (WIP)
7. concession-service
```

Or run individually with Maven:
```bash
cd server/discovery-server
./mvnw spring-boot:run
```

### 4. Run the frontend
```bash
cd client
npm install
npm run dev
```

Open http://localhost:3000.

**Admin account** (seeded automatically on first startup by `ApplicationInitConfig`, from `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`ADMIN_EMAIL` env vars — defaults below):

| Username | Password | Role |
|---|---|---|
| `admin` | `admin` | ADMIN |

Change the default password before deploying anywhere reachable. There are no seeded EMPLOYEE/MEMBER accounts — create them through the app (Admin → Employees / sign-up).

> **Note:** The React app serves both the customer homepage (`/`) and the admin dashboard (`/admin`). Logged-in admin/employee users are automatically redirected to `/admin` when visiting `/`. Admin routes are protected by role.

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
