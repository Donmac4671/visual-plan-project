
CREATE OR REPLACE FUNCTION public.generate_topup_reference_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_code text;
  v_attempts int := 0;
  v_letters text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_digits  text := '0123456789';
  v_chars   text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_arr text[];
  v_tmp text;
  i int;
  j int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  LOOP
    v_attempts := v_attempts + 1;

    -- Build a 6-char code guaranteed to have >=2 digits and >=2 letters
    v_arr := ARRAY[
      substr(v_letters, 1 + floor(random() * length(v_letters))::int, 1),
      substr(v_letters, 1 + floor(random() * length(v_letters))::int, 1),
      substr(v_digits,  1 + floor(random() * length(v_digits))::int, 1),
      substr(v_digits,  1 + floor(random() * length(v_digits))::int, 1),
      substr(v_chars,   1 + floor(random() * length(v_chars))::int, 1),
      substr(v_chars,   1 + floor(random() * length(v_chars))::int, 1)
    ];

    -- Fisher-Yates shuffle
    FOR i IN REVERSE 6..2 LOOP
      j := 1 + floor(random() * i)::int;
      v_tmp := v_arr[i];
      v_arr[i] := v_arr[j];
      v_arr[j] := v_tmp;
    END LOOP;

    v_code := array_to_string(v_arr, '');

    BEGIN
      UPDATE public.profiles
        SET topup_reference_code = v_code
        WHERE user_id = v_user_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts > 20 THEN
        RAISE EXCEPTION 'Could not generate unique code, please retry';
      END IF;
    END;
  END LOOP;

  RETURN v_code;
END;
$function$;
