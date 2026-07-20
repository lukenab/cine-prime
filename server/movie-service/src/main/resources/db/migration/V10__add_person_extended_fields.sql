-- Person extended fields (issue #153): gender, known_for_department, death_date,
-- place_of_birth. All nullable — existing person rows simply read back NULL for these.
-- death_date staying NULL means the person is still alive (see PersonController).
ALTER TABLE person ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE person ADD COLUMN IF NOT EXISTS known_for_department VARCHAR(50);
ALTER TABLE person ADD COLUMN IF NOT EXISTS death_date DATE;
ALTER TABLE person ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(255);
