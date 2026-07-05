CREATE TABLE permission
(
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    CONSTRAINT pk_permission PRIMARY KEY (name)
);