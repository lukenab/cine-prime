-- Standardize room master-data descriptions for the English admin interface.
-- Safe to run repeatedly on an existing movie_db database.

UPDATE projection_technology
SET tech_name = 'Xenon',
    description = 'Traditional xenon-lamp digital cinema projection system.'
WHERE tech_code = 'XENON';

UPDATE projection_technology
SET tech_name = 'Laser',
    description = 'Laser-based digital cinema projection with high brightness and stable color performance.'
WHERE tech_code = 'LASER';

UPDATE projection_technology
SET tech_name = 'Direct View LED',
    description = 'Direct-view LED cinema display that does not require a projector.'
WHERE tech_code = 'DIRECT_VIEW_LED';
