# **Movie Theater Management System**

## **Project Overview**
The **Movie Theater Management System** is a comprehensive solution designed to handle all aspects of cinema operations. It provides a seamless ticket-booking experience for customers while offering robust management tools for cinema administrators to handle movie schedules, theaters, and revenue.

This project is developed as part of the **FPT Software OJT Program (HCM26_CPL_JAVA_05)**.

## **Repository Structure**
```text
hcm26_cpl_java_05_group1/
├── client/
│   ├── admin-dashboard/     
│   └── customer-portal/    
├── server/
│   ├── api-gateway/         
│   ├── booking-service/    
│   ├── movie-service/      
│   └── user-service/       
├── .gitignore              
├── .gitattributes           
├── CONTRIBUTING.md          
└── README.md
```

## **Tech Stack**
- Frontend: React.js, Vite
- Backend: Java
- Database: PostgreSQL + SQL Server
- Version Control: Git & GitLab 

## **Getting Started**
### **Prerequisites**
Before running this project, ensure you have the following installed:
- Java 21
- PostgreSQL & SQL Server

### **1. Clone the repository**
```text
git clone <your-gitlab-repo-url>
cd hcm26_cpl_java_05_group1
```

### **2.2. Run Backend Services (Java Spring Boot)**
Using the provided Maven Wrapper, you do not need to install Maven globally.
```text
cd server/user-service
./mvnw spring-boot:run
# For Windows use: mvnw.cmd spring-boot:run
```

### **3. Run Frontend Portals (React + Vite)**
# For Customer Portal
```text
cd client/customer-portal
npm install
npm run dev
```

# **For Admin Dashboard**
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

