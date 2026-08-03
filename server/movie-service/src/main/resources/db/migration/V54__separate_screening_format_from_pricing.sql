-- Screening formats are technical presentation capabilities (2D, 3D, IMAX,
-- 4DX, ScreenX). Commercial values are resolved exclusively from Price Books
-- and Price Rates, which can vary by cinema, date, time and format.
ALTER TABLE screening_format
    DROP COLUMN IF EXISTS surcharge;
