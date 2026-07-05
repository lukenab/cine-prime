CREATE TABLE role_permissions
(
    permission_name VARCHAR(100) NOT NULL,
    role_name       VARCHAR(50)  NOT NULL,
    CONSTRAINT pk_role_permissions PRIMARY KEY (permission_name, role_name)
);

CREATE TABLE roles
(
    role_name   VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    CONSTRAINT pk_roles PRIMARY KEY (role_name)
);

ALTER TABLE role_permissions
    ADD CONSTRAINT fk_rolper_on_permission FOREIGN KEY (permission_name) REFERENCES permission (name);

ALTER TABLE role_permissions
    ADD CONSTRAINT fk_rolper_on_role FOREIGN KEY (role_name) REFERENCES roles (role_name);