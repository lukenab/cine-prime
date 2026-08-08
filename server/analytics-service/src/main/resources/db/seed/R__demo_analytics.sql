-- Deterministic analytics facts for local/demo environments.
-- The facts cover the current demo window (2026-08-01 .. 2026-08-07),
-- three real CinePrime branches, a previous comparison period and both confirmed and refunded outcomes.
-- Branch mapping for the local movie database:
--   43 = CinePrime Landmark 81, 25 = CinePrime Thủ Đức, 3 = CinePrime Hoàn Kiếm.
-- They are safe to
-- re-run because source_event_id is unique.
INSERT INTO booking_revenue_fact (
    fact_id, source_event_id, event_version, booking_id, cluster_id, showtime_id,
    business_date, occurred_at, projected_at, ticket_count, ticket_amount,
    concession_amount, discount_amount, final_amount, refund_amount, currency,
    outcome_status
) VALUES
('demo-fact-001','demo-analytics-001','2','demo-booking-001',43,81001,'2026-08-01',TIMESTAMPTZ '2026-08-01 10:15:00+07',CURRENT_TIMESTAMP,2,180000,89000,20000,249000,0,'VND','CONFIRMED'),
('demo-fact-002','demo-analytics-002','2','demo-booking-002',43,81002,'2026-08-02',TIMESTAMPTZ '2026-08-02 15:10:00+07',CURRENT_TIMESTAMP,3,285000,149000,35000,399000,0,'VND','CONFIRMED'),
('demo-fact-003','demo-analytics-003','2','demo-booking-003',43,81003,'2026-08-03',TIMESTAMPTZ '2026-08-03 18:20:00+07',CURRENT_TIMESTAMP,2,240000,59000,0,299000,0,'VND','CONFIRMED'),
('demo-fact-004','demo-analytics-004','2','demo-booking-004',43,81004,'2026-08-04',TIMESTAMPTZ '2026-08-04 19:05:00+07',CURRENT_TIMESTAMP,4,360000,199000,50000,509000,0,'VND','CONFIRMED'),
('demo-fact-005','demo-analytics-005','2','demo-booking-005',43,81005,'2026-08-05',TIMESTAMPTZ '2026-08-05 20:10:00+07',CURRENT_TIMESTAMP,2,170000,79000,15000,234000,0,'VND','CONFIRMED'),
('demo-fact-006','demo-analytics-006','2','demo-booking-006',43,81006,'2026-08-06',TIMESTAMPTZ '2026-08-06 17:45:00+07',CURRENT_TIMESTAMP,3,255000,119000,25000,349000,0,'VND','CONFIRMED'),
('demo-fact-007','demo-analytics-007','2','demo-booking-007',43,81007,'2026-08-07',TIMESTAMPTZ '2026-08-07 12:30:00+07',CURRENT_TIMESTAMP,2,190000,89000,20000,259000,0,'VND','CONFIRMED'),
('demo-fact-008','demo-analytics-008','2','demo-booking-008',43,81008,'2026-08-05',TIMESTAMPTZ '2026-08-05 21:10:00+07',CURRENT_TIMESTAMP,2,180000,0,0,180000,180000,'VND','REFUNDED'),
('demo-fact-009','demo-analytics-009','2','demo-booking-009',25,82001,'2026-08-01',TIMESTAMPTZ '2026-08-01 11:00:00+07',CURRENT_TIMESTAMP,2,160000,79000,10000,229000,0,'VND','CONFIRMED'),
('demo-fact-010','demo-analytics-010','2','demo-booking-010',25,82002,'2026-08-02',TIMESTAMPTZ '2026-08-02 16:25:00+07',CURRENT_TIMESTAMP,2,180000,119000,20000,279000,0,'VND','CONFIRMED'),
('demo-fact-011','demo-analytics-011','2','demo-booking-011',25,82003,'2026-08-03',TIMESTAMPTZ '2026-08-03 19:10:00+07',CURRENT_TIMESTAMP,3,270000,149000,30000,389000,0,'VND','CONFIRMED'),
('demo-fact-012','demo-analytics-012','2','demo-booking-012',25,82004,'2026-08-04',TIMESTAMPTZ '2026-08-04 20:30:00+07',CURRENT_TIMESTAMP,2,220000,89000,0,309000,0,'VND','CONFIRMED'),
('demo-fact-013','demo-analytics-013','2','demo-booking-013',25,82005,'2026-08-06',TIMESTAMPTZ '2026-08-06 18:00:00+07',CURRENT_TIMESTAMP,1,95000,45000,0,140000,0,'VND','CONFIRMED'),
('demo-fact-014','demo-analytics-014','2','demo-booking-014',25,82006,'2026-08-07',TIMESTAMPTZ '2026-08-07 14:00:00+07',CURRENT_TIMESTAMP,2,180000,79000,15000,244000,0,'VND','CONFIRMED'),
('demo-fact-015','demo-analytics-015','2','demo-booking-015',25,82007,'2026-08-04',TIMESTAMPTZ '2026-08-04 21:05:00+07',CURRENT_TIMESTAMP,2,180000,0,0,180000,180000,'VND','REFUNDED'),
('demo-fact-016','demo-analytics-016','2','demo-booking-016',3,83001,'2026-08-01',TIMESTAMPTZ '2026-08-01 09:30:00+07',CURRENT_TIMESTAMP,2,150000,59000,0,209000,0,'VND','CONFIRMED'),
('demo-fact-017','demo-analytics-017','2','demo-booking-017',3,83002,'2026-08-03',TIMESTAMPTZ '2026-08-03 17:40:00+07',CURRENT_TIMESTAMP,2,180000,89000,20000,249000,0,'VND','CONFIRMED'),
('demo-fact-018','demo-analytics-018','2','demo-booking-018',3,83003,'2026-08-05',TIMESTAMPTZ '2026-08-05 19:00:00+07',CURRENT_TIMESTAMP,1,85000,45000,0,130000,0,'VND','CONFIRMED'),
('demo-fact-019','demo-analytics-019','2','demo-booking-019',3,83004,'2026-08-07',TIMESTAMPTZ '2026-08-07 13:20:00+07',CURRENT_TIMESTAMP,2,160000,79000,10000,229000,0,'VND','CONFIRMED'),
('demo-fact-020','demo-analytics-020','2','demo-booking-020',43,80901,'2026-07-25',TIMESTAMPTZ '2026-07-25 10:15:00+07',CURRENT_TIMESTAMP,2,170000,59000,10000,219000,0,'VND','CONFIRMED'),
('demo-fact-021','demo-analytics-021','2','demo-booking-021',43,80902,'2026-07-26',TIMESTAMPTZ '2026-07-26 15:10:00+07',CURRENT_TIMESTAMP,2,180000,79000,20000,239000,0,'VND','CONFIRMED'),
('demo-fact-022','demo-analytics-022','2','demo-booking-022',43,80903,'2026-07-28',TIMESTAMPTZ '2026-07-28 18:20:00+07',CURRENT_TIMESTAMP,3,270000,149000,30000,389000,0,'VND','CONFIRMED'),
('demo-fact-023','demo-analytics-023','2','demo-booking-023',43,80904,'2026-07-30',TIMESTAMPTZ '2026-07-30 19:05:00+07',CURRENT_TIMESTAMP,2,160000,59000,0,219000,0,'VND','CONFIRMED'),
('demo-fact-024','demo-analytics-024','2','demo-booking-024',43,80905,'2026-07-29',TIMESTAMPTZ '2026-07-29 20:10:00+07',CURRENT_TIMESTAMP,2,180000,0,0,180000,180000,'VND','REFUNDED'),
('demo-fact-025','demo-analytics-025','2','demo-booking-025',25,82901,'2026-07-25',TIMESTAMPTZ '2026-07-25 11:00:00+07',CURRENT_TIMESTAMP,2,160000,59000,0,219000,0,'VND','CONFIRMED'),
('demo-fact-026','demo-analytics-026','2','demo-booking-026',25,82902,'2026-07-27',TIMESTAMPTZ '2026-07-27 16:25:00+07',CURRENT_TIMESTAMP,2,180000,89000,10000,259000,0,'VND','CONFIRMED'),
('demo-fact-027','demo-analytics-027','2','demo-booking-027',25,82903,'2026-07-31',TIMESTAMPTZ '2026-07-31 19:10:00+07',CURRENT_TIMESTAMP,1,95000,45000,0,140000,0,'VND','CONFIRMED'),
('demo-fact-028','demo-analytics-028','2','demo-booking-028',25,82904,'2026-07-29',TIMESTAMPTZ '2026-07-29 20:30:00+07',CURRENT_TIMESTAMP,2,180000,0,0,180000,180000,'VND','REFUNDED'),
('demo-fact-029','demo-analytics-029','2','demo-booking-029',3,83901,'2026-07-26',TIMESTAMPTZ '2026-07-26 09:30:00+07',CURRENT_TIMESTAMP,2,150000,59000,0,209000,0,'VND','CONFIRMED'),
('demo-fact-030','demo-analytics-030','2','demo-booking-030',3,83902,'2026-07-30',TIMESTAMPTZ '2026-07-30 17:40:00+07',CURRENT_TIMESTAMP,1,85000,45000,0,130000,0,'VND','CONFIRMED')
ON CONFLICT (source_event_id) DO NOTHING;
