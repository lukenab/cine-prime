-- Backfills tmdb_company_id for production_company rows created before
-- V-fix/tmdb-company-id-not-set (see that MR for the code fix), matched one-by-one against
-- TMDB's /search/company by exact name and manually reviewed before this migration was written.
-- Matched by `name` (the only thing usable here - company_id is auto-generated and differs per
-- environment, and tmdb_company_id is exactly the column being fixed). Guarded by
-- `tmdb_company_id IS NULL` throughout, so this is a no-op on any row already backfilled or on
-- any environment where these companies were never created with a null tmdb id in the first place.
UPDATE production_company SET tmdb_company_id = 174    WHERE name = 'Warner Bros. Pictures'                  AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 420    WHERE name = 'Marvel Studios'                         AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 33     WHERE name = 'Universal Pictures'                     AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 4      WHERE name = 'Paramount Pictures'                     AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 127928 WHERE name = '20th Century Studios'                   AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 1632   WHERE name = 'Lionsgate'                               AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 4399   WHERE name = 'Barunson E&A'                            AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 923    WHERE name = 'Legendary Pictures'                      AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 9996   WHERE name = 'Syncopy'                                 AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 19551  WHERE name = 'Marvel Enterprises'                      AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 326    WHERE name = 'Laura Ziskin Productions'                AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 5      WHERE name = 'Columbia Pictures'                       AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 84041  WHERE name = 'Pascal Pictures'                         AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 207837 WHERE name = 'TSG Entertainment II'                    AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 107204 WHERE name = 'HK Film'                                 AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 152082 WHERE name = 'Trấn Thành Town'                          AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 152083 WHERE name = 'Galaxy Studio'                           AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 429    WHERE name = 'DC'                                      AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 19231  WHERE name = 'Patalex III Productions'                 AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 2173   WHERE name = 'Great Oaks Entertainment'                AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 2      WHERE name = 'Walt Disney Pictures'                    AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 176668 WHERE name = 'Wizzer Productions'                      AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 2651   WHERE name = 'Fragile Films'                           AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 152    WHERE name = 'Icon Productions'                        AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 718    WHERE name = 'Arts Council of England'                 AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 14     WHERE name = 'Miramax'                                 AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 552    WHERE name = 'Dark Horse Entertainment'                AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 925    WHERE name = 'Nu Image'                                AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 6819   WHERE name = 'Paradox Entertainment'                   AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 7636   WHERE name = 'Nimar Studios'                           AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 25673  WHERE name = 'Cinema Vehicle Services'                 AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 1020   WHERE name = 'Millennium Media'                        AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 3756   WHERE name = 'CoMix Wave Films'                        AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 882    WHERE name = 'TOHO'                                    AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 2073   WHERE name = 'KADOKAWA'                                AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 8157   WHERE name = 'jeki'                                    AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 14602  WHERE name = 'AMUSE'                                   AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 128617 WHERE name = 'voque ting'                              AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 104184 WHERE name = 'Lawson Entertainment'                    AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 5542   WHERE name = 'Toei Animation'                          AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 2918   WHERE name = 'Shueisha'                                AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 5822   WHERE name = 'Toei Company'                            AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 3341   WHERE name = 'Fuji Television Network'                 AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 155586 WHERE name = 'Bandai'                                  AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 12502  WHERE name = 'Bandai Namco Entertainment'              AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 173235 WHERE name = 'ADK Emotions'                            AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 1778   WHERE name = 'dentsu'                                  AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 2883   WHERE name = 'Aniplex'                                 AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 3234   WHERE name = 'Pierrot'                                 AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 528    WHERE name = 'Bandai Visual'                           AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 3034   WHERE name = 'TV Tokyo'                                AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 2849   WHERE name = 'BONES'                                   AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 11727  WHERE name = 'Yomiuri Telecasting Corporation'         AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 6755   WHERE name = 'Nippon Television Network Corporation'   AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 648    WHERE name = 'Sony Music Entertainment (Japan)'        AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 3466   WHERE name = 'movic'                                  AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 31453  WHERE name = 'HKFilm'                                  AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 126761 WHERE name = 'CJ HK Entertainment'                     AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 32301  WHERE name = 'Causeway Films'                          AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 150239 WHERE name = 'Salmira Productions'                     AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 7584   WHERE name = 'Screen Australia'                        AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 204763 WHERE name = 'VicScreen'                               AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 15780  WHERE name = 'Arenamedia'                               AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 159883 WHERE name = 'Lazy Susan Films'                        AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 187518 WHERE name = 'Kim Entertainment'                       AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 34084  WHERE name = 'Coma-Film'                               AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 85741  WHERE name = 'Slovenian Film Fund'                     AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 24827  WHERE name = 'Red Mullet'                              AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 97110  WHERE name = 'Project 8 Projects'                      AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 155758 WHERE name = 'Tea Shop Productions'                    AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 273145 WHERE name = 'Under the Shell'                         AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 154063 WHERE name = 'Capstone Pictures'                       AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 3172   WHERE name = 'Blumhouse Productions'                   AND tmdb_company_id IS NULL;
UPDATE production_company SET tmdb_company_id = 6704   WHERE name = 'Illumination'                            AND tmdb_company_id IS NULL;

-- "Pixar Animation Studios" is credited on a movie (Inside Out 2), so it's renamed to match
-- TMDB's canonical name ("Pixar", TMDB company id 3) and linked, rather than deleted - deleting
-- it would either violate movie_production_company's ON DELETE RESTRICT or silently drop Pixar
-- off that movie's production company credits.
UPDATE production_company SET name = 'Pixar', tmdb_company_id = 3
WHERE name = 'Pixar Animation Studios' AND tmdb_company_id IS NULL;

-- A24 and Pathé each had multiple exact-name matches on TMDB with no reliable way to pick the
-- right one, and (unlike Pixar) neither is credited on any movie yet, so they're removed rather
-- than left as permanently-unlinkable rows. Guarded by NOT EXISTS so this is skipped instead of
-- failing if either is ever credited on a movie before this migration runs.
DELETE FROM production_company
WHERE name IN ('A24', 'Pathé')
  AND tmdb_company_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM movie_production_company mpc WHERE mpc.company_id = production_company.company_id
  );
