-- resolution and audio_format were missing the `description` column that
-- their sibling master-data tables (auditorium_class, projection_technology)
-- already have. Additive only.

ALTER TABLE resolution ADD COLUMN IF NOT EXISTS description VARCHAR(255);
ALTER TABLE audio_format ADD COLUMN IF NOT EXISTS description VARCHAR(255);

UPDATE resolution SET description = '2K digital cinema projection resolution (approximately 2048x1080).'
WHERE resolution_code = '2K';
UPDATE resolution SET description = '4K digital cinema projection resolution (approximately 4096x2160), sharper detail than 2K.'
WHERE resolution_code = '4K';

UPDATE audio_format SET description = 'Dolby 5.1 surround sound with six discrete channels.'
WHERE format_code = 'DOLBY_5_1';
UPDATE audio_format SET description = 'Dolby 7.1 surround sound with eight discrete channels for wider surround coverage.'
WHERE format_code = 'DOLBY_7_1';
UPDATE audio_format SET description = 'Dolby Atmos object-based immersive audio with overhead sound channels.'
WHERE format_code = 'DOLBY_ATMOS';
