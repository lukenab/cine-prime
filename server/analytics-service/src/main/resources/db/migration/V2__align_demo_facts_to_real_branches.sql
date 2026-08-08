-- Keep deterministic analytics demo facts aligned with the real cinema clusters
-- currently seeded by movie-service. Older versions used 1/2/3 as placeholders,
-- which made the admin ranking fall back to the non-business labels "Cluster 1/2".
UPDATE booking_revenue_fact
SET cluster_id = CASE cluster_id
    WHEN 1 THEN 43 -- CinePrime Landmark 81
    WHEN 2 THEN 25 -- CinePrime Thủ Đức
    ELSE cluster_id   -- 3 already represents CinePrime Hoàn Kiếm
END
WHERE source_event_id LIKE 'demo-analytics-%'
  AND cluster_id IN (1, 2);
