-- Match Prisma's canonical 63-character index name without rebuilding the index.
ALTER INDEX booking_request_status_history_booking_request_id_created_at_id
  RENAME TO booking_request_status_history_booking_request_id_created_a_idx;
