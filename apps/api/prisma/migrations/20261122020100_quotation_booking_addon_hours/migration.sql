BEGIN;

-- Keep the existing validator and its grants. Earlier items omit totalHours.
CREATE OR REPLACE FUNCTION public.clemora_quotation_items_valid(items jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
DECLARE
  item jsonb;
  addon jsonb;
  source jsonb;
  field text;
  value numeric;
  source_key text;
  ids text[] := ARRAY[]::text[];
  sources text[] := ARRAY[]::text[];
  uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(items) > 100 THEN RETURN false; END IF;

  FOR item IN SELECT element FROM jsonb_array_elements(items) AS e(element) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF NOT (item ?& ARRAY['id','direction','kind','description','amountMinor']) THEN RETURN false; END IF;
    IF item - ARRAY['id','direction','kind','description','amountMinor','serviceId','addon'] <> '{}'::jsonb THEN RETURN false; END IF;
    IF jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR NOT (item->>'id' ~ uuid_pattern) THEN RETURN false; END IF;
    IF lower(item->>'id') = ANY(ids) THEN RETURN false; END IF;
    ids := array_append(ids, lower(item->>'id'));
    IF jsonb_typeof(item->'direction') IS DISTINCT FROM 'string' OR item->>'direction' NOT IN ('add','deduct') THEN RETURN false; END IF;
    IF jsonb_typeof(item->'kind') IS DISTINCT FROM 'string' OR item->>'kind' NOT IN ('addition','deduction','substitution','adjustment') THEN RETURN false; END IF;
    IF jsonb_typeof(item->'description') IS DISTINCT FROM 'string' OR length(btrim(item->>'description')) NOT BETWEEN 1 AND 4000 THEN RETURN false; END IF;
    IF item ? 'serviceId' AND item->'serviceId' <> 'null'::jsonb AND (jsonb_typeof(item->'serviceId') IS DISTINCT FROM 'string' OR NOT (item->>'serviceId' ~ uuid_pattern)) THEN RETURN false; END IF;

    IF NOT (item ? 'addon' AND item->'amountMinor' = 'null'::jsonb) THEN
      IF jsonb_typeof(item->'amountMinor') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      value := (item->>'amountMinor')::numeric;
      IF value <> trunc(value) OR value < 0 OR value > 2147483647 THEN RETURN false; END IF;
      IF NOT item ? 'addon' AND value = 0 THEN RETURN false; END IF;
    END IF;

    IF NOT item ? 'addon' THEN CONTINUE; END IF;
    IF item->>'direction' <> 'add' OR item->>'kind' <> 'addition' OR jsonb_typeof(item->'serviceId') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    addon := item->'addon';
    IF jsonb_typeof(addon) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF NOT (addon ?& ARRAY['source','hours','fixedPriceOverrideMinor','hourlyRateOverrideMinor']) THEN RETURN false; END IF;
    IF addon - ARRAY['source','hours','fixedPriceOverrideMinor','hourlyRateOverrideMinor','requiresRemoval','totalHours'] <> '{}'::jsonb THEN RETURN false; END IF;
    IF addon ? 'requiresRemoval' AND (jsonb_typeof(addon->'requiresRemoval') IS DISTINCT FROM 'string' OR addon->>'requiresRemoval' NOT IN ('included','archived')) THEN RETURN false; END IF;

    source := addon->'source';
    IF jsonb_typeof(source) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF NOT (source ?& ARRAY['packageId','addonId','fixedPriceMinor','includedHours','hourlyRateMinor']) THEN RETURN false; END IF;
    IF source - ARRAY['packageId','addonId','fixedPriceMinor','includedHours','hourlyRateMinor'] <> '{}'::jsonb THEN RETURN false; END IF;
    FOREACH field IN ARRAY ARRAY['packageId','addonId'] LOOP
      IF jsonb_typeof(source->field) IS DISTINCT FROM 'string' OR NOT (source->>field ~ uuid_pattern) THEN RETURN false; END IF;
    END LOOP;
    source_key := lower(source->>'packageId') || ':' || lower(source->>'addonId');
    IF source_key = ANY(sources) THEN RETURN false; END IF;
    sources := array_append(sources, source_key);

    FOREACH field IN ARRAY ARRAY['fixedPriceMinor','hourlyRateMinor','includedHours'] LOOP
      IF source->field = 'null'::jsonb THEN CONTINUE; END IF;
      IF jsonb_typeof(source->field) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      value := (source->>field)::numeric;
      IF value <> trunc(value) OR value < 1 OR value > (CASE WHEN field = 'includedHours' THEN 2147483647 ELSE 214748364700 END) THEN RETURN false; END IF;
    END LOOP;
    FOREACH field IN ARRAY ARRAY['hours','fixedPriceOverrideMinor','hourlyRateOverrideMinor'] LOOP
      IF addon->field = 'null'::jsonb THEN CONTINUE; END IF;
      IF jsonb_typeof(addon->field) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      value := (addon->>field)::numeric;
      IF value <> trunc(value) OR value < 0 OR value > 2147483647 THEN RETURN false; END IF;
    END LOOP;
    IF source->'includedHours' = 'null'::jsonb THEN
      IF source->'fixedPriceMinor' <> 'null'::jsonb OR addon->'fixedPriceOverrideMinor' <> 'null'::jsonb OR addon->'hours' = '0'::jsonb THEN RETURN false; END IF;
    ELSIF addon->'hours' = 'null'::jsonb THEN
      RETURN false;
    END IF;

    IF addon ? 'totalHours' THEN
      IF jsonb_typeof(addon->'totalHours') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
      value := (addon->>'totalHours')::numeric;
      IF value <> trunc(value) OR value < 1 OR value > 2147483647 THEN RETURN false; END IF;
      IF (addon->>'hours')::numeric IS DISTINCT FROM
         greatest(0, value - coalesce((source->>'includedHours')::numeric, 0)) THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

COMMIT;
