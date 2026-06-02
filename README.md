# **Movie Theater Management System**

## **Project Overview**
The **Movie Theater Management System** is a comprehensive solution designed to handle all aspects of cinema operations. It provides a seamless ticket-booking experience for customers while offering robust management tools for cinema administrators to handle movie schedules, theaters, and revenue.

This project is developed as part of the **FPT Software OJT Program (HCM26_CPL_JAVA_05)**.

## **Repository Structure**
```text
hcm26_cpl_java_05_group1/
├── client/                      
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── server/                     
│   ├── api-gateway/         
│   ├── discovery-server/      
│   ├── booking-service/    
│   ├── movie-service/      
│   ├── user-service/  
│   ├── promotion-service/     
│   ├── payment-service/     
│   └── notification-service/  
├── docs/                       
├── docker-compose.yml           
├── .gitignore              
├── .gitattributes           
├── CONTRIBUTING.md          
└── README.md
```

## **Tech Stack**
**1. Frontend**
- Libary: React.js (v18.x) 
- Build Tool: Vite (v8.x)

**2. Backend**
- Language: Java 21
- Framework: Spring Boot
- Microservices Ecosystems
    - API Gateway: Spring Cloud Gateway
    - Service Discovery: Netflix Eureka
    - Synchronous Communication: Spring Cloud OpenFeign
- Security: JWT (Json Web Token)

**3. Database**
- PostgreSQL 
- MySQL 
- ORM: Spring Data JPA (Hibernate)

**4. DevOps & Tools**
- Containerization: Docker & Docker Compose
- Version Control: Git & GitLab


## **Getting Started**
### **Prerequisites**
Before running this project, ensure you have the following installed:
- Java 21
- Node.js (v18 or higher for React/Vite)
- Docker Desktop (Crucial for running the Microservices and Databases automatically)

### **1. Clone the repository**
Clone the project and switch to the active development branch:
```text
git clone <your-gitlab-repo-url>
cd hcm26_cpl_java_05_group1
git checkout develop
```

### **2. Run Backend Services (Docker Compose)**
Using the Docker Compose, you do not need to install MySQL, PostgreSQL, or run each Spring Boot service manually.
```text
docker-compose up -d --build
```

Wait 1-2 minutes for the containers to start. Once ready, you can check the Eureka Discovery Server at http://localhost:8761. All API requests should be routed through the API Gateway at http://localhost:8080/api/.

(Optional) If you want to stop the backend system:

```text
docker-compose down
```

### **3. Run Frontend Portals (React + Vite)**
Open a new terminal for each frontend portal.
#### For Customer Portal
```text
cd client/customer-portal
npm install
npm run dev
```

#### **For Admin Dashboard**
```text
cd client/admin-dashboard
npm install
npm run dev
```
## Contribution Guidelines
We follow a strict Git workflow to avoid merge conflicts. Please read our CONTRIBUTING.md before pushing any code.

- NEVER push directly to the main or develop branches.
- Always create a new branch from develop (e.g., feature/login-page).
- Use Conventional Commits (feat:, fix:, chore:, etc.).
- Create a Merge Request (MR) to develop and request a review from the Team Leader.

## Team Members
- **Nguyễn An Bình** - Team Leader/ Developer
- **Diệp Đăng Khoa** - Team Member/ Developer
- **Nguyễn Mạnh Khải** - Team Member/ Developer
- **Lê Tấn Lộc** - Team Member/ Developer
- **Trần Nhật Duy** - Team Member/ Developer

