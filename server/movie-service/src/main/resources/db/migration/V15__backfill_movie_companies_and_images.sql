-- Standardizes the `movie` table for the 10 movies that have a real tmdb_id: each was only
-- ever linked to a single production_company and had 0-1 movie_image rows, even though TMDB
-- lists several companies and a full poster/backdrop/stills set for all of them. The gap is a
-- historical data-population issue (these movies were added via MovieEditorPage's plain
-- create/update flow rather than a full TMDB import + image import run), not a schema problem.
-- All values below come from a manual TMDB lookup per movie's tmdb_id, reviewed before writing.
--
-- "Bố Già" is a special case: its stored tmdb_id (24137) actually points to a different real
-- movie on TMDB ("An Ideal Husband", 1999) - a data-entry mistake unrelated to the fix in this
-- migration. Its existing production_company link (HK Film) already matches the *correct*
-- Vietnamese film, confirming the company was picked correctly by hand while the tmdb_id field
-- itself was set wrong. Corrected first, matched by name (the only thing safe to key off here
-- since the current tmdb_id is exactly the wrong value being fixed).
UPDATE movie SET tmdb_id = 787459 WHERE original_title = 'Bố Già' AND tmdb_id = 24137;

-- New production companies TMDB lists for these movies that don't exist locally yet (matched by
-- tmdb_company_id elsewhere in this repo's migrations - checked individually before writing,
-- none collide with an existing row here).
INSERT INTO production_company (name, tmdb_company_id, country, logo_url, created_at) VALUES
    ('Scott Free Productions',       221347, 'US', 'https://image.tmdb.org/t/p/w200/6Ry6uNBaa0IbbSs1XYIgX5DkA9r.png', now()),
    ('Brandywine Productions',       401,    'US', 'https://image.tmdb.org/t/p/w200/t7mM3DvQ9MwDT3YzMCBrkWpWiiz.png', now()),
    ('TSG Entertainment',            22213,  'US', 'https://image.tmdb.org/t/p/w200/qx9K6bFWJupwde0xQDwOvXkOaL8.png', now()),
    ('Seven Bucks Productions',      73669,  'US', 'https://image.tmdb.org/t/p/w200/pZ1sOLrUxvCvW1jODdCFgU6RxUA.png', now()),
    ('Flynn Picture Company',        34081,  'US', NULL, now()),
    ('5000 Broadway Productions',    122645, 'US', 'https://image.tmdb.org/t/p/w200/ujqjqvWtJxP24nAwmRvksaPTDoo.png', now())
ON CONFLICT (tmdb_company_id) WHERE tmdb_company_id IS NOT NULL DO NOTHING;

-- Links every TMDB-listed company to its movie, matched by movie.tmdb_id and
-- production_company.tmdb_company_id (both stable, environment-independent identifiers).
-- ON CONFLICT DO NOTHING on the (movie_id, company_id) primary key makes this idempotent and
-- safe to run whether or not the single pre-existing link is among these rows.
INSERT INTO movie_production_company (movie_id, company_id)
SELECT m.movie_id, pc.company_id FROM movie m, production_company pc
WHERE m.tmdb_id = 945961 AND pc.tmdb_company_id IN (127928, 221347, 401, 22213)
ON CONFLICT DO NOTHING;

INSERT INTO movie_production_company (movie_id, company_id)
SELECT m.movie_id, pc.company_id FROM movie m, production_company pc
WHERE m.tmdb_id = 634649 AND pc.tmdb_company_id IN (420, 84041, 5)
ON CONFLICT DO NOTHING;

INSERT INTO movie_production_company (movie_id, company_id)
SELECT m.movie_id, pc.company_id FROM movie m, production_company pc
WHERE m.tmdb_id = 496243 AND pc.tmdb_company_id IN (4399)
ON CONFLICT DO NOTHING;

INSERT INTO movie_production_company (movie_id, company_id)
SELECT m.movie_id, pc.company_id FROM movie m, production_company pc
WHERE m.tmdb_id = 787459 AND pc.tmdb_company_id IN (107204, 152082, 152083)
ON CONFLICT DO NOTHING;

INSERT INTO movie_production_company (movie_id, company_id)
SELECT m.movie_id, pc.company_id FROM movie m, production_company pc
WHERE m.tmdb_id = 317442 AND pc.tmdb_company_id IN (2883, 3234, 528, 1778, 2918, 3034)
ON CONFLICT DO NOTHING;

INSERT INTO movie_production_company (movie_id, company_id)
SELECT m.movie_id, pc.company_id FROM movie m, production_company pc
WHERE m.tmdb_id = 1210973 AND pc.tmdb_company_id IN (152082, 31453, 126761)
ON CONFLICT DO NOTHING;

INSERT INTO movie_production_company (movie_id, company_id)
SELECT m.movie_id, pc.company_id FROM movie m, production_company pc
WHERE m.tmdb_id = 969681 AND pc.tmdb_company_id IN (420, 5, 84041, 207837)
ON CONFLICT DO NOTHING;

INSERT INTO movie_production_company (movie_id, company_id)
SELECT m.movie_id, pc.company_id FROM movie m, production_company pc
WHERE m.tmdb_id = 1339713 AND pc.tmdb_company_id IN (155758, 273145, 154063, 3172)
ON CONFLICT DO NOTHING;

INSERT INTO movie_production_company (movie_id, company_id)
SELECT m.movie_id, pc.company_id FROM movie m, production_company pc
WHERE m.tmdb_id = 1108427 AND pc.tmdb_company_id IN (2, 73669, 34081, 122645)
ON CONFLICT DO NOTHING;

INSERT INTO movie_production_company (movie_id, company_id)
SELECT m.movie_id, pc.company_id FROM movie m, production_company pc
WHERE m.tmdb_id = 1368337 AND pc.tmdb_company_id IN (33, 9996)
ON CONFLICT DO NOTHING;

-- Poster + backdrop + up to 5 additional stills (TMDB has no dedicated movie "stills" endpoint -
-- these are just backdrops beyond the first recommended one, same convention MovieImageService
-- uses for real TMDB image imports) per movie, matched by movie.tmdb_id. The unique constraint
-- uq_movie_image_source_path (movie_id, source, external_path) makes this idempotent - already
-- already-imported images (Naruto has 1, The Odyssey has 4) are skipped via ON CONFLICT DO NOTHING
-- rather than duplicated.
INSERT INTO movie_image (movie_id, image_url, image_type, external_path, source, is_default, display_order, created_at)
SELECT m.movie_id, v.image_url, v.image_type, v.external_path, 'TMDB', v.is_default, v.display_order, now()
FROM movie m, (VALUES
    (945961, 'https://image.tmdb.org/t/p/w780/b33nnKl1GSFbao4l3fZDDqsMx0F.jpg',  'POSTER',   '/b33nnKl1GSFbao4l3fZDDqsMx0F.jpg',  true,  1),
    (945961, 'https://image.tmdb.org/t/p/w1280/iYqSQaWDttQIQzsxg9xHyg0bttG.jpg', 'BACKDROP', '/iYqSQaWDttQIQzsxg9xHyg0bttG.jpg', true,  1),
    (945961, 'https://image.tmdb.org/t/p/w1280/9SSEUrSqhljBMzRe4aBTh17rUaC.jpg', 'STILL',    '/9SSEUrSqhljBMzRe4aBTh17rUaC.jpg', false, 2),
    (945961, 'https://image.tmdb.org/t/p/w1280/7g7cAWKvMKnzJQCxYE4OHfx131t.jpg', 'STILL',    '/7g7cAWKvMKnzJQCxYE4OHfx131t.jpg', false, 3),
    (945961, 'https://image.tmdb.org/t/p/w1280/nDfFdwgdTIsvCQtpb9sNNWCRQsI.jpg', 'STILL',    '/nDfFdwgdTIsvCQtpb9sNNWCRQsI.jpg', false, 4),
    (945961, 'https://image.tmdb.org/t/p/w1280/6vn6K9oX82i6E86ZiHVxqVEMQqP.jpg', 'STILL',    '/6vn6K9oX82i6E86ZiHVxqVEMQqP.jpg', false, 5),
    (945961, 'https://image.tmdb.org/t/p/w1280/eP4RZSHliWu6lPT5WQyHr5ZZKuC.jpg', 'STILL',    '/eP4RZSHliWu6lPT5WQyHr5ZZKuC.jpg', false, 6),

    (634649, 'https://image.tmdb.org/t/p/w780/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',  'POSTER',   '/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',  true,  1),
    (634649, 'https://image.tmdb.org/t/p/w1280/14QbnygCuTO0vl7CAFmPf1fgZfV.jpg', 'BACKDROP', '/14QbnygCuTO0vl7CAFmPf1fgZfV.jpg', true,  1),
    (634649, 'https://image.tmdb.org/t/p/w1280/zD5v1E4joAzFvmAEytt7fM3ivyT.jpg', 'STILL',    '/zD5v1E4joAzFvmAEytt7fM3ivyT.jpg', false, 2),
    (634649, 'https://image.tmdb.org/t/p/w1280/nqUThBjou0TAWXu93Q4SNFpgqai.jpg', 'STILL',    '/nqUThBjou0TAWXu93Q4SNFpgqai.jpg', false, 3),
    (634649, 'https://image.tmdb.org/t/p/w1280/AeK2MPOpYrOOgZNfFnfwp0L8tNn.jpg', 'STILL',    '/AeK2MPOpYrOOgZNfFnfwp0L8tNn.jpg', false, 4),
    (634649, 'https://image.tmdb.org/t/p/w1280/iQFcwSGbZXMkeyKrxbPnwnRo5fl.jpg', 'STILL',    '/iQFcwSGbZXMkeyKrxbPnwnRo5fl.jpg', false, 5),
    (634649, 'https://image.tmdb.org/t/p/w1280/utxfKMtH91Q5uPvFMFDLnxohXHV.jpg', 'STILL',    '/utxfKMtH91Q5uPvFMFDLnxohXHV.jpg', false, 6),

    (496243, 'https://image.tmdb.org/t/p/w780/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',  'POSTER',   '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',  true,  1),
    (496243, 'https://image.tmdb.org/t/p/w1280/hiKmpZMGZsrkA3cdce8a7Dpos1j.jpg', 'BACKDROP', '/hiKmpZMGZsrkA3cdce8a7Dpos1j.jpg', true,  1),
    (496243, 'https://image.tmdb.org/t/p/w1280/wCuUKiRaz0wEESsYqmQy005xvTE.jpg', 'STILL',    '/wCuUKiRaz0wEESsYqmQy005xvTE.jpg', false, 2),
    (496243, 'https://image.tmdb.org/t/p/w1280/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg',  'STILL',    '/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg',  false, 3),
    (496243, 'https://image.tmdb.org/t/p/w1280/8eihUxjQsJ7WvGySkVMC0EwbPAD.jpg', 'STILL',    '/8eihUxjQsJ7WvGySkVMC0EwbPAD.jpg', false, 4),
    (496243, 'https://image.tmdb.org/t/p/w1280/25tz24hlrqAbjhpHx1FhmfPH8Qf.jpg', 'STILL',    '/25tz24hlrqAbjhpHx1FhmfPH8Qf.jpg', false, 5),
    (496243, 'https://image.tmdb.org/t/p/w1280/cM0pnzCF6T7u1AAEYgyCG6Sua6k.jpg', 'STILL',    '/cM0pnzCF6T7u1AAEYgyCG6Sua6k.jpg', false, 6),

    (787459, 'https://image.tmdb.org/t/p/w780/ucXxqYqNLjZ3auyLTzU9NsClsms.jpg',  'POSTER',   '/ucXxqYqNLjZ3auyLTzU9NsClsms.jpg',  true,  1),
    (787459, 'https://image.tmdb.org/t/p/w1280/qJbXpfICmJAh911109wPSBNf0UO.jpg', 'BACKDROP', '/qJbXpfICmJAh911109wPSBNf0UO.jpg', true,  1),
    (787459, 'https://image.tmdb.org/t/p/w1280/8P9WfjlydINgX7Z7SudUBoowzhJ.jpg', 'STILL',    '/8P9WfjlydINgX7Z7SudUBoowzhJ.jpg', false, 2),
    (787459, 'https://image.tmdb.org/t/p/w1280/l6sLqDqP6slD5HIzZ2eZy6jV7QC.jpg', 'STILL',    '/l6sLqDqP6slD5HIzZ2eZy6jV7QC.jpg', false, 3),
    (787459, 'https://image.tmdb.org/t/p/w1280/ujSsRpowNLeU9tJ3Wed0vorbQMf.jpg', 'STILL',    '/ujSsRpowNLeU9tJ3Wed0vorbQMf.jpg', false, 4),
    (787459, 'https://image.tmdb.org/t/p/w1280/AdfdMbmFARw6UkYEh6ElshaoUm.jpg',  'STILL',    '/AdfdMbmFARw6UkYEh6ElshaoUm.jpg',  false, 5),

    (317442, 'https://image.tmdb.org/t/p/w780/bAQ8O5Uw6FedtlCbJTutenzPVKd.jpg',  'POSTER',   '/bAQ8O5Uw6FedtlCbJTutenzPVKd.jpg',  true,  1),
    (317442, 'https://image.tmdb.org/t/p/w1280/l8ubUlfzlB5R2j9cJ3CN7tj0gmd.jpg', 'BACKDROP', '/l8ubUlfzlB5R2j9cJ3CN7tj0gmd.jpg', true,  1),
    (317442, 'https://image.tmdb.org/t/p/w1280/sqnjUZlq8TGK2E3LaGIPnZMd7WQ.jpg', 'STILL',    '/sqnjUZlq8TGK2E3LaGIPnZMd7WQ.jpg', false, 2),
    (317442, 'https://image.tmdb.org/t/p/w1280/kzIiKLccwuzD3qD5OHFyPIkiqEw.jpg', 'STILL',    '/kzIiKLccwuzD3qD5OHFyPIkiqEw.jpg', false, 3),
    (317442, 'https://image.tmdb.org/t/p/w1280/y7wKUYkdKfCPmhZvJRN3lkdwjQN.jpg', 'STILL',    '/y7wKUYkdKfCPmhZvJRN3lkdwjQN.jpg', false, 4),
    (317442, 'https://image.tmdb.org/t/p/w1280/vc1nP61G0NrpIQ9atiuv17yHqnK.jpg', 'STILL',    '/vc1nP61G0NrpIQ9atiuv17yHqnK.jpg', false, 5),
    (317442, 'https://image.tmdb.org/t/p/w1280/wvkwmbi6mzXbBYPnYVTrtYcdNGV.jpg', 'STILL',    '/wvkwmbi6mzXbBYPnYVTrtYcdNGV.jpg', false, 6),

    (1210973, 'https://image.tmdb.org/t/p/w780/uFsn8qBEzbeJCqH0LsViwPom5ww.jpg',  'POSTER',   '/uFsn8qBEzbeJCqH0LsViwPom5ww.jpg',  true,  1),
    (1210973, 'https://image.tmdb.org/t/p/w1280/g3yFCzkHAvB7oFvt9HJDxBxo1al.jpg', 'BACKDROP', '/g3yFCzkHAvB7oFvt9HJDxBxo1al.jpg', true,  1),
    (1210973, 'https://image.tmdb.org/t/p/w1280/zZ6nRdNQNxRnZ1LQ2ttPBZl9AXV.jpg', 'STILL',    '/zZ6nRdNQNxRnZ1LQ2ttPBZl9AXV.jpg', false, 2),
    (1210973, 'https://image.tmdb.org/t/p/w1280/oujSPSyHlQ80mBCrr4zZvwwFfwX.jpg', 'STILL',    '/oujSPSyHlQ80mBCrr4zZvwwFfwX.jpg', false, 3),
    (1210973, 'https://image.tmdb.org/t/p/w1280/gGs06TxSxZKDb4EHpMA1Ahxem3z.jpg', 'STILL',    '/gGs06TxSxZKDb4EHpMA1Ahxem3z.jpg', false, 4),
    (1210973, 'https://image.tmdb.org/t/p/w1280/wPxabdTM6GFnDNGcoC2MGtOQwsj.jpg', 'STILL',    '/wPxabdTM6GFnDNGcoC2MGtOQwsj.jpg', false, 5),
    (1210973, 'https://image.tmdb.org/t/p/w1280/wUVjdX7h9ecNL4kr1Ss1DDgB3CD.jpg', 'STILL',    '/wUVjdX7h9ecNL4kr1Ss1DDgB3CD.jpg', false, 6),

    (969681, 'https://image.tmdb.org/t/p/w780/x19dchU8e38vQfW4epzOsQNLuZ2.jpg',  'POSTER',   '/x19dchU8e38vQfW4epzOsQNLuZ2.jpg',  true,  1),
    (969681, 'https://image.tmdb.org/t/p/w1280/h0M2JTPUlR64jkfXAhZeD9e7ZWF.jpg', 'BACKDROP', '/h0M2JTPUlR64jkfXAhZeD9e7ZWF.jpg', true,  1),
    (969681, 'https://image.tmdb.org/t/p/w1280/qRB396vOc9xcqUVFqFnl0qQlolU.jpg', 'STILL',    '/qRB396vOc9xcqUVFqFnl0qQlolU.jpg', false, 2),
    (969681, 'https://image.tmdb.org/t/p/w1280/vjMvFSmGUxEtqVdaZgvFee9XkZl.jpg', 'STILL',    '/vjMvFSmGUxEtqVdaZgvFee9XkZl.jpg', false, 3),
    (969681, 'https://image.tmdb.org/t/p/w1280/5glivQffWJkRJttJ5g5LW14kmeC.jpg', 'STILL',    '/5glivQffWJkRJttJ5g5LW14kmeC.jpg', false, 4),
    (969681, 'https://image.tmdb.org/t/p/w1280/sYsaVy047cfGTLMfcRihee3ShnM.jpg', 'STILL',    '/sYsaVy047cfGTLMfcRihee3ShnM.jpg', false, 5),
    (969681, 'https://image.tmdb.org/t/p/w1280/jenQoCLJ4FEfFGZS13op91jlxjy.jpg', 'STILL',    '/jenQoCLJ4FEfFGZS13op91jlxjy.jpg', false, 6),

    (1339713, 'https://image.tmdb.org/t/p/w780/bRwnj8WEKBCvmfeUNOukJPwB43K.jpg',  'POSTER',   '/bRwnj8WEKBCvmfeUNOukJPwB43K.jpg',  true,  1),
    (1339713, 'https://image.tmdb.org/t/p/w1280/r013C8Me2bZ0pUi0OWJRh0h7MzT.jpg', 'BACKDROP', '/r013C8Me2bZ0pUi0OWJRh0h7MzT.jpg', true,  1),
    (1339713, 'https://image.tmdb.org/t/p/w1280/diOZbaDnB2CIilwd0527AB1qMvW.jpg', 'STILL',    '/diOZbaDnB2CIilwd0527AB1qMvW.jpg', false, 2),
    (1339713, 'https://image.tmdb.org/t/p/w1280/4k99kV4R1bbbrsnjR205v91Xbin.jpg', 'STILL',    '/4k99kV4R1bbbrsnjR205v91Xbin.jpg', false, 3),
    (1339713, 'https://image.tmdb.org/t/p/w1280/rZfmzpixLKLR3Hg2u0WgC7XLFl8.jpg', 'STILL',    '/rZfmzpixLKLR3Hg2u0WgC7XLFl8.jpg', false, 4),
    (1339713, 'https://image.tmdb.org/t/p/w1280/u5BkYDM5gfK4wINfoIFMAcEUKhx.jpg', 'STILL',    '/u5BkYDM5gfK4wINfoIFMAcEUKhx.jpg', false, 5),
    (1339713, 'https://image.tmdb.org/t/p/w1280/5lTZyuBTNOfawsfPT8Q0cIg6qAF.jpg', 'STILL',    '/5lTZyuBTNOfawsfPT8Q0cIg6qAF.jpg', false, 6),

    (1108427, 'https://image.tmdb.org/t/p/w780/zKVgiv5qHCvCLT4A2ymJi5QeXDH.jpg',  'POSTER',   '/zKVgiv5qHCvCLT4A2ymJi5QeXDH.jpg',  true,  1),
    (1108427, 'https://image.tmdb.org/t/p/w1280/mMkJq4dkQwfDieB9wRC9yPxDWv9.jpg', 'BACKDROP', '/mMkJq4dkQwfDieB9wRC9yPxDWv9.jpg', true,  1),
    (1108427, 'https://image.tmdb.org/t/p/w1280/lniL0aoEvuWxfZOcZss7vWQfi1x.jpg', 'STILL',    '/lniL0aoEvuWxfZOcZss7vWQfi1x.jpg', false, 2),
    (1108427, 'https://image.tmdb.org/t/p/w1280/1Qf5ClZJpmEPJgBqBB03UvCVXzO.jpg', 'STILL',    '/1Qf5ClZJpmEPJgBqBB03UvCVXzO.jpg', false, 3),
    (1108427, 'https://image.tmdb.org/t/p/w1280/ogv0eTxwCVcrfKYsl2GKH4hNHJL.jpg', 'STILL',    '/ogv0eTxwCVcrfKYsl2GKH4hNHJL.jpg', false, 4),
    (1108427, 'https://image.tmdb.org/t/p/w1280/lrXHXd0sFoKInEygRxu6aNiA9Xu.jpg', 'STILL',    '/lrXHXd0sFoKInEygRxu6aNiA9Xu.jpg', false, 5),
    (1108427, 'https://image.tmdb.org/t/p/w1280/76WFQTmh4gsqYpWTejxuEu5Iu69.jpg', 'STILL',    '/76WFQTmh4gsqYpWTejxuEu5Iu69.jpg', false, 6)
) AS v(tmdb_id, image_url, image_type, external_path, is_default, display_order)
WHERE m.tmdb_id = v.tmdb_id
ON CONFLICT (movie_id, source, external_path) WHERE source IS NOT NULL AND external_path IS NOT NULL DO NOTHING;
