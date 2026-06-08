CREATE TABLE users (
    account_id VARCHAR(10) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(15),
    date_of_birth DATE,
    gender VARCHAR(20),
    address VARCHAR(255),
    identity_card VARCHAR(20),
    avatar_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE member (
    member_id VARCHAR(10) PRIMARY KEY,
    account_id VARCHAR(10) NOT NULL UNIQUE REFERENCES users(account_id),
    loyalty_points INT DEFAULT 0,
    membership_level VARCHAR(20) DEFAULT 'STANDARD',
    total_spent DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng EMPLOYEE (Dành cho Nhân viên)
CREATE TABLE employee (
    employee_id VARCHAR(10) PRIMARY KEY,
    account_id VARCHAR(10) NOT NULL UNIQUE REFERENCES users(account_id),
    position VARCHAR(50),
    hire_date DATE,
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);