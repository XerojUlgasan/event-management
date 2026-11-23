BEGIN;

-- Deploy with the matching API and worker. Share the queue's transition lock;
-- saved attachments, rather than a payload flag, identify image work.
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(1129073994, 1);

UPDATE public.background_jobs AS job
SET type = 'process_image_message', updated_at = clock_timestamp()
WHERE job.type = 'process_message'
  AND EXISTS (
    SELECT 1 FROM public.message_images AS image
    WHERE image.message_id::text = job.dedupe_key
  );

-- Retire outstanding text-only jobs without deleting messages or replaying
-- their provider calls. Clearing the lease fences an interrupted old worker.
WITH retired AS (
  UPDATE public.background_jobs
  SET status = 'failed', last_error = 'processing_unavailable',
      lease_token = NULL, lease_expires_at = NULL,
      completed_at = clock_timestamp(), updated_at = clock_timestamp()
  WHERE type = 'process_message' AND status IN ('pending', 'running')
  RETURNING dedupe_key
)
UPDATE public.guest_message_requests AS request
SET completed = TRUE,
    assistant_message_id = reply.id,
    assistant_error = CASE WHEN reply.id IS NULL THEN
      'Your message was saved, but the AI reply is unavailable. You do not need to resend your message.'
      ELSE NULL END
FROM retired
LEFT JOIN public.messages AS reply
  ON reply.reply_to_message_id::text = retired.dedupe_key
WHERE request.message_id::text = retired.dedupe_key;

COMMIT;
