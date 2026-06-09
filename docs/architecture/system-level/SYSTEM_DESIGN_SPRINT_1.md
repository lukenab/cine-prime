# System Design Document

**Project:** Movie Theater Management System  
**Phase:** Sprint 1 - Project Initialization & Core MVP  
**Date:** June 02, 2026  

---

## 1. Overview and objectives

**Purpose & Scope:**  
The system digitizes cinema operations, focusing in Sprint 1 on establishing foundational microservices, user authentication, and basic movie catalog management.

**Target Users:**  
* **Administrators:** Cinema staff managing movie schedules, catalogs, and theater operations.
* **Customers:** End-users browsing available movies and managing their profiles.

**Problem Solved:**  
Transitioning from manual or monolithic operations to a scalable, decoupled platform suitable for high-traffic interactions and future concurrent booking features.

## 2. System architecture

**Architecture Style:**  
A Microservices architecture to isolate business domains and scale independently.

**Core Components:**  
* **API Gateway (Spring Cloud Gateway):** Single entry point routing external traffic to internal services.
* **Service Discovery (Eureka):** Dynamic internal network registry for service-to-service communication.
* **Backend Microservices (Java Spring Boot):** `user-service` and `movie-service`.
* **Frontend (React.js/Vite):** A single unified application (Port 3000) serving both the Admin Dashboard and Customer Portal, utilizing role-based protected routes and code-splitting to maintain security and performance.

**Hosting Environment:**  
Containerized locally for development using Docker and `docker-compose`.

## 3. Functional specifications

**User Authentication Workflow:**  
* **Inputs:** Username/email and password submitted via the frontend login UI.
* **Processing:** The request is routed to the `user-service` and validated against credentials stored in PostgreSQL.
* **Outputs:** A signed JSON Web Token (JWT) is returned upon success. Invalid credentials trigger a 401 Unauthorized response.

**Movie Catalog Management:**  
* **Inputs:** Form data including title, duration, release date, and poster URL.
* **Processing:** The `movie-service` validates data constraints (e.g., non-null fields) and persists the record to MySQL.
* **Outputs:** A 201 Created status for successful additions, or a JSON array of movie objects when queried via GET requests.

## 4. Non-functional requirements

**Performance:**  
Microservices communicate via lightweight internal Docker networks to minimize latency. Redis (Alpine) is provisioned to handle future high-throughput cache operations and distributed locking.

**Reliability:**  
Apache Kafka (KRaft mode) is implemented to establish a foundation for asynchronous message brokering, ensuring no data loss during future booking surges.

**Usability:**  
Utilizing a single Single Page Application (SPA) with lazy loading (code splitting) ensures that customer-facing pages load quickly without downloading heavy administrative charting libraries, maintaining optimal performance across user roles.

## 5. Data design

The architecture enforces Polyglot Persistence, isolating data stores by service to prevent tight coupling.

**User Database (PostgreSQL 16):**  
* Managed exclusively by `user-service` for secure, transactional data.
* **`users` table:** Contains `id` (UUID), `email` (Unique), `password_hash`, `role` (Enum: ADMIN, CUSTOMER), and `created_at`.

**Movie Database (MySQL 8.0):**  
* Managed exclusively by `movie-service` for read-heavy catalog operations.
* **`movies` table:** Contains `id` (Auto Increment), `title`, `description`, `duration`, `release_date`, and `poster_url`.

## 6. API contracts and integrations

All external client communications utilize REST over HTTP formatted in JSON. The API Gateway operates on Port 8085 and uses the following routing rules:

| Route Path | Target Service | Target Port | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/**` | `user-service` | 8084 | Login, registration, token generation |
| `/api/v1/users/**` | `user-service` | 8084 | User profile management |
| `/api/v1/movies/**` | `movie-service` | 8081 | Movie catalog CRUD operations |

## 7. Security and access control

**Authentication:**  
User sessions are stateless and managed via JSON Web Tokens (JWT).

**Access Control:**  
Role-Based Access Control (RBAC) restricts endpoints based on the payload of the JWT.
* Customers have read-only access to public routes (e.g., GET `/api/v1/movies`).
* Administrators possess full read/write privileges (e.g., POST `/api/v1/movies`).
* At the frontend level, protected routes ensure users cannot navigate to unauthorized layouts.

**Token Handling:**  
Clients must attach the JWT via the `Authorization: Bearer <token>` HTTP header. Interceptors at the frontend automatically manage this attachment for protected routes.

## 8. Testing strategy

**API Validation:**  
Postman is utilized to verify endpoint functionality, JSON payload structures, and appropriate HTTP status codes (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized).

**Integration Testing:**  
Validation of proper service-to-service communication via the Eureka registry and API Gateway within the Docker network.

**Error Handling:**  
Ensuring validation layers gracefully intercept bad inputs and return standardized error messages without crashing the backend service.

## 9. Deployment and DevOps

**Version Control:**  
Source code is managed on GitLab utilizing a Feature Branch Workflow (e.g., `feature/#<id>-<name>`).

**Branch Protection:**  
Direct pushes to the `develop` and `main` branches are strictly prohibited via GitLab repository settings.

**Release Management:**  
All code integrations require a Merge Request (MR). MRs must be reviewed and approved by a Team Leader or peer Developer prior to execution.

**Infrastructure Deployment:**  
The local development environment is orchestrated using `docker-compose up -d --build` to spin up Kafka, Redis, Databases, and custom Microservices simultaneously.

## 10. Appendices and references

* **Repository Guidelines:** Refer to the project's `CONTRIBUTING.md` for conventional commit rules and branch naming standards.
* **Infrastructure Configuration:** Refer to `docker-compose.yml` for exact container port mappings and environment variable setups.
* **Database Design:** Entity-Relationship Diagrams (ERD) for Sprint 1 data models are attached in the GitLab issue `#16` and the project wiki.