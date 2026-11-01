-- Earlier requests could be flagged for falling below a removed package minimum.
-- The retained maximum is now the only out-of-range rule.
UPDATE booking_requests AS br
SET out_of_range = br.guest_count > pv.guest_max
FROM package_versions AS pv
WHERE pv.id = br.package_version_id
  AND br.out_of_range IS DISTINCT FROM (br.guest_count > pv.guest_max);
