-- ============================================================
-- AeroFlow — UNIFIED DATABASE LOGIC MODULE
-- db_logic.sql
-- ============================================================
-- PostgreSQL 10 Compatibility Notes (changes from original):
--   1. txn_book_passenger  (§7.1): SELECT insert_booking(...)
--      and SELECT insert_luggage(...) replaced with PERFORM.
--      In PL/pgSQL, calling a void-returning function via bare
--      SELECT (without INTO) is rejected in PG10; PERFORM is
--      the correct discard-result form.
--   2. txn_schedule_flight (§7.2): Same fix applied to
--      SELECT insert_flight(...) and SELECT insert_flight_leg(...)
--      calls inside the FOR loop body.
--   3. rpt_q25_aircraft_financial_efficiency (§8): Fixed a
--      non-aggregated column reference `m.total_cost` inside a
--      CASE expression in a GROUP BY query. Replaced with the
--      aggregate COALESCE(SUM(m.total_cost), 0).
--   4. rpt_q03_delayed_legs (§8): EXTRACT(EPOCH ...)/60 returns
--      double precision in PG10; cast to ::NUMERIC to match the
--      declared return-table column type (actual_min NUMERIC).
--   5. rpt_q35_peak_hour_congestion (§8): EXTRACT(HOUR ...) also
--      returns double precision in PG10; cast to ::NUMERIC to
--      match declared return column (departure_hour NUMERIC).
--   Trigger syntax: EXECUTE PROCEDURE retained (EXECUTE FUNCTION
--   alias was introduced in PG11; EXECUTE PROCEDURE is the
--   correct form for PG10). DROP TRIGGER IF EXISTS NOTICEs on
--   first run are expected and harmless — they just mean the
--   triggers did not yet exist before this script ran.
-- ============================================================
-- Single source of truth for all database-side intelligence.
-- Sections:
--   0.  Setup & Schema Path
--   1.  Schema Helpers       — Indexed views & utility queries
--   2.  Stored Functions     — CRUD read helpers
--   3.  Stored Procedures    — CRUD write operations (atomic)
--   4.  Business Logic Fns   — Complex multi-table computations
--   5.  Triggers             — Auto-update & validation triggers
--   6.  Constraint Functions — Custom CHECK / assertion helpers
--   7.  Transaction Wrappers — Multi-step atomic operations
--   8.  Analytics Functions  — All 37 report queries as functions
--   9.  Index Suggestions    — Performance indexes
-- ============================================================

-- ============================================================
-- SECTION 0: SETUP
-- ============================================================

SET search_path TO aeroflow, public;

-- ============================================================
-- SECTION 1: SCHEMA HELPERS — Utility Queries & Smart Views
-- ============================================================

-- View: Enriched Flight schedule (used by the frontend GET /api/flights)
CREATE OR REPLACE VIEW v_flight_schedule AS
    SELECT
        f.flight_id,
        f.aircraft_id,
        f.departure_time,
        f.arrival_time,
        f.source_airport_id,
        f.dest_airport_id,
        s.iata_code   AS source_iata,
        d.iata_code   AS dest_iata,
        s.airport_name AS source_name,
        d.airport_name AS dest_name,
        ac.model       AS aircraft_model,
        al.airline_name,
        al.airline_id,
        EXTRACT(EPOCH FROM (f.arrival_time - f.departure_time)) / 3600 AS duration_hours
    FROM flight f
    JOIN airport  s  ON f.source_airport_id = s.airport_id
    JOIN airport  d  ON f.dest_airport_id   = d.airport_id
    JOIN aircraft ac ON f.aircraft_id        = ac.aircraft_id
    JOIN airline  al ON ac.airline_id        = al.airline_id;

-- View: Enriched Aircraft with airline info
CREATE OR REPLACE VIEW v_aircraft_detail AS
    SELECT
        ac.*,
        al.airline_name,
        al.iata_designator_codes AS airline_iata,
        al.country               AS airline_country,
        (ac.tot_eco_seats + ac.tot_bus_seats) AS total_seats,
        ROUND(ac.current_fuel_level / NULLIF(ac.total_fuel_capacity, 0) * 100, 1) AS fuel_pct
    FROM aircraft ac
    JOIN airline al ON ac.airline_id = al.airline_id;

-- View: Full booking detail (passenger + flight + route)
CREATE OR REPLACE VIEW v_booking_detail AS
    SELECT
        b.booking_id,
        b.flight_id,
        b.route_id,
        b.leg_sequence_no,
        b.user_id,
        b.seat_type,
        b.seat_number,
        b.booking_date,
        b.booking_status,
        b.booking_sequence_no,
        u.name         AS passenger_name,
        u.email        AS passenger_email,
        u.phone        AS passenger_phone,
        f.departure_time,
        f.arrival_time,
        s.iata_code    AS source_iata,
        d.iata_code    AS dest_iata
    FROM booking b
    JOIN "User"  u ON b.user_id    = u.user_id
    JOIN flight  f ON b.flight_id  = f.flight_id
    JOIN airport s ON f.source_airport_id = s.airport_id
    JOIN airport d ON f.dest_airport_id   = d.airport_id;

-- View: Maintenance with aircraft & airline information
CREATE OR REPLACE VIEW v_maintenance_detail AS
    SELECT
        m.*,
        ac.model        AS aircraft_model,
        ac.status_type  AS aircraft_status,
        al.airline_name
    FROM maintenance m
    JOIN aircraft ac ON m.aircraft_id = ac.aircraft_id
    JOIN airline  al ON ac.airline_id = al.airline_id;


-- ============================================================
-- SECTION 2: STORED FUNCTIONS — Clean READ Interface for API
-- ============================================================

-- ----------------------------------------------------------
-- 2.1 get_airlines() → Full airline list ordered by ID
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_airlines()
RETURNS SETOF airline
LANGUAGE sql STABLE AS $$
    SELECT * FROM airline ORDER BY airline_id;
$$;

-- ----------------------------------------------------------
-- 2.2 get_aircrafts() → Full aircraft list ordered by ID
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_aircrafts()
RETURNS SETOF aircraft
LANGUAGE sql STABLE AS $$
    SELECT * FROM aircraft ORDER BY aircraft_id;
$$;

-- ----------------------------------------------------------
-- 2.3 get_airports() → Full airport list ordered by ID
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_airports()
RETURNS SETOF airport
LANGUAGE sql STABLE AS $$
    SELECT * FROM airport ORDER BY airport_id;
$$;

-- ----------------------------------------------------------
-- 2.4 get_users() → Full user list ordered by ID
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_users()
RETURNS TABLE (
    user_id  INT,
    name     VARCHAR,
    email    VARCHAR,
    phone    VARCHAR,
    address  VARCHAR
)
LANGUAGE sql STABLE AS $$
    SELECT * FROM "User" ORDER BY user_id;
$$;

-- ----------------------------------------------------------
-- 2.5 get_flights() → Enriched flight list (uses view)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_flights()
RETURNS SETOF v_flight_schedule
LANGUAGE sql STABLE AS $$
    SELECT * FROM v_flight_schedule ORDER BY flight_id;
$$;

-- ----------------------------------------------------------
-- 2.6 get_flight_by_id(p_id) → Single flight detail
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_flight_by_id(p_id INT)
RETURNS SETOF v_flight_schedule
LANGUAGE sql STABLE AS $$
    SELECT * FROM v_flight_schedule WHERE flight_id = p_id;
$$;

-- ----------------------------------------------------------
-- 2.7 get_bookings() → Full booking list
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_bookings()
RETURNS SETOF booking
LANGUAGE sql STABLE AS $$
    SELECT * FROM booking ORDER BY booking_id;
$$;

-- ----------------------------------------------------------
-- 2.8 get_maintenance() → Full maintenance list
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_maintenance()
RETURNS SETOF maintenance
LANGUAGE sql STABLE AS $$
    SELECT * FROM maintenance ORDER BY maintenance_id;
$$;

-- ----------------------------------------------------------
-- 2.9 get_flight_legs() → All legs ordered by flight/route/seq
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_flight_legs()
RETURNS SETOF flight_legs
LANGUAGE sql STABLE AS $$
    SELECT * FROM flight_legs ORDER BY flight_id, route_id, leg_sequence_no;
$$;

-- ----------------------------------------------------------
-- 2.10 check_airline_exists(p_id) → Boolean existence check
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION check_airline_exists(p_id INT)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM airline WHERE airline_id = p_id);
$$;

-- ----------------------------------------------------------
-- 2.11 check_aircraft_exists(p_id) → Boolean existence check
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION check_aircraft_exists(p_id INT)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM aircraft WHERE aircraft_id = p_id);
$$;

-- ----------------------------------------------------------
-- 2.12 get_aircraft_status(p_id) → Returns Status_Type string
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_aircraft_status(p_id INT)
RETURNS VARCHAR
LANGUAGE sql STABLE AS $$
    SELECT status_type FROM aircraft WHERE aircraft_id = p_id;
$$;

-- ----------------------------------------------------------
-- 2.13 get_available_aircraft() → Aircraft with status AVAILABLE
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_available_aircraft()
RETURNS TABLE (
    aircraft_id  INT,
    model        VARCHAR,
    airline_name VARCHAR,
    tot_eco_seats INT,
    tot_bus_seats INT,
    location     VARCHAR
)
LANGUAGE sql STABLE AS $$
    SELECT ac.aircraft_id, ac.model, al.airline_name,
           ac.tot_eco_seats, ac.tot_bus_seats, ac.location
    FROM aircraft ac
    JOIN airline al ON ac.airline_id = al.airline_id
    WHERE UPPER(ac.status_type) = 'AVAILABLE'
    ORDER BY ac.aircraft_id;
$$;


-- ============================================================
-- SECTION 3: STORED PROCEDURES — ATOMIC WRITE OPERATIONS
-- ============================================================
-- All writes go through these procedures.
-- Each one validates inputs and raises named exceptions
-- so the API layer only needs to catch, not compute.
-- ============================================================

-- ----------------------------------------------------------
-- 3.1 insert_airline — Create a new airline
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_airline(
    p_id            INT,
    p_name          VARCHAR(100),
    p_country       VARCHAR(50),
    p_headquarters  VARCHAR(100),
    p_email         VARCHAR(20),
    p_iata          VARCHAR(10)
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    -- Null / empty checks
    IF p_id IS NULL OR p_name IS NULL OR p_country IS NULL
       OR p_headquarters IS NULL OR p_email IS NULL OR p_iata IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: All airline fields are required.';
    END IF;

    -- Duplicate check
    IF EXISTS (SELECT 1 FROM airline WHERE airline_id = p_id) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Airline with ID % already exists.', p_id;
    END IF;

    INSERT INTO airline (airline_id, airline_name, country, headquarters, email, iata_designator_codes)
    VALUES (p_id, p_name, p_country, p_headquarters, p_email, p_iata);
END;
$$;

-- ----------------------------------------------------------
-- 3.2 update_airline — Update existing airline
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_airline(
    p_id            INT,
    p_name          VARCHAR,
    p_country       VARCHAR,
    p_headquarters  VARCHAR,
    p_email         VARCHAR,
    p_iata          VARCHAR
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM airline WHERE airline_id = p_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Airline with ID % does not exist.', p_id;
    END IF;

    UPDATE airline
    SET airline_name          = p_name,
        country               = p_country,
        headquarters          = p_headquarters,
        email                 = p_email,
        iata_designator_codes = p_iata
    WHERE airline_id = p_id;
END;
$$;

-- ----------------------------------------------------------
-- 3.3 delete_airline — Delete airline (FK is protected by DB)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_airline(p_id INT)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM airline WHERE airline_id = p_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Airline with ID % does not exist.', p_id;
    END IF;
    DELETE FROM airline WHERE airline_id = p_id;
END;
$$;

-- ----------------------------------------------------------
-- 3.4 insert_aircraft — Create a new aircraft
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_aircraft(
    p_id              INT,
    p_airline_id      INT,
    p_model           VARCHAR,
    p_manufacture_date DATE,
    p_hours           INT,
    p_cycle           INT,
    p_eco_seats       INT,
    p_bus_seats       INT,
    p_fuel_cap        DECIMAL,
    p_curr_fuel       DECIMAL,
    p_location        VARCHAR,
    p_status          VARCHAR
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_id IS NULL OR p_airline_id IS NULL OR p_model IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Aircraft ID, Airline ID, and Model are required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM airline WHERE airline_id = p_airline_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Airline with ID % does not exist.', p_airline_id;
    END IF;

    IF EXISTS (SELECT 1 FROM aircraft WHERE aircraft_id = p_id) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Aircraft with ID % already exists.', p_id;
    END IF;

    -- Fuel level cannot exceed capacity
    IF p_curr_fuel > p_fuel_cap THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Current fuel level (%) cannot exceed total capacity (%).', p_curr_fuel, p_fuel_cap;
    END IF;

    INSERT INTO aircraft (
        aircraft_id, airline_id, model, manufacture_date,
        total_flight_hours, total_flight_cycle, tot_eco_seats, tot_bus_seats,
        total_fuel_capacity, current_fuel_level, location, status_type
    ) VALUES (
        p_id, p_airline_id, p_model, p_manufacture_date,
        p_hours, p_cycle, p_eco_seats, p_bus_seats,
        p_fuel_cap, p_curr_fuel, p_location, p_status
    );
END;
$$;

-- ----------------------------------------------------------
-- 3.5 update_aircraft — Update aircraft record
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_aircraft(
    p_id              INT,
    p_airline_id      INT,
    p_model           VARCHAR,
    p_manufacture_date DATE,
    p_hours           INT,
    p_cycle           INT,
    p_eco_seats       INT,
    p_bus_seats       INT,
    p_fuel_cap        DECIMAL,
    p_curr_fuel       DECIMAL,
    p_location        VARCHAR,
    p_status          VARCHAR
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM aircraft WHERE aircraft_id = p_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Aircraft with ID % does not exist.', p_id;
    END IF;

    IF p_curr_fuel > p_fuel_cap THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Current fuel level cannot exceed total capacity.';
    END IF;

    UPDATE aircraft
    SET airline_id          = p_airline_id,
        model               = p_model,
        manufacture_date    = p_manufacture_date,
        total_flight_hours  = p_hours,
        total_flight_cycle  = p_cycle,
        tot_eco_seats       = p_eco_seats,
        tot_bus_seats       = p_bus_seats,
        total_fuel_capacity = p_fuel_cap,
        current_fuel_level  = p_curr_fuel,
        location            = p_location,
        status_type         = p_status
    WHERE aircraft_id = p_id;
END;
$$;

-- ----------------------------------------------------------
-- 3.6 cascade_delete_aircraft
--     Performs bottom-up deletion of an aircraft and ALL
--     dependent records inside ONE transaction block.
--     Replaces the 9-step manual cascade in the backend.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION cascade_delete_aircraft(p_id INT)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_flight_ids INT[];
    v_qs         TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM aircraft WHERE aircraft_id = p_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Aircraft with ID % does not exist.', p_id;
    END IF;

    -- Collect dependent flight IDs
    SELECT ARRAY_AGG(flight_id) INTO v_flight_ids
    FROM flight WHERE aircraft_id = p_id;

    IF v_flight_ids IS NOT NULL AND array_length(v_flight_ids, 1) > 0 THEN
        -- Build parameterised id list (ANY approach is cleaner in plpgsql)
        DELETE FROM luggage
        WHERE booking_id IN (
            SELECT booking_id FROM booking WHERE flight_id = ANY(v_flight_ids)
        );
        DELETE FROM booking      WHERE flight_id = ANY(v_flight_ids);
        DELETE FROM crew_assign  WHERE flight_id = ANY(v_flight_ids);
        DELETE FROM pilot_assign WHERE flight_id = ANY(v_flight_ids);
        DELETE FROM uses_gate    WHERE flight_id = ANY(v_flight_ids);
        DELETE FROM uses_runway  WHERE flight_id = ANY(v_flight_ids);
        DELETE FROM flight_legs  WHERE flight_id = ANY(v_flight_ids);
        DELETE FROM flight       WHERE aircraft_id = p_id;
    END IF;

    DELETE FROM maintenance WHERE aircraft_id = p_id;
    DELETE FROM aircraft    WHERE aircraft_id = p_id;

    RAISE NOTICE 'Aircraft % and all dependent records deleted.', p_id;
END;
$$;

-- ----------------------------------------------------------
-- 3.7 insert_airport — Create a new airport
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_airport(
    p_id        INT,
    p_name      VARCHAR,
    p_city      VARCHAR,
    p_state     VARCHAR,
    p_country   VARCHAR,
    p_iata_code VARCHAR
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_id IS NULL OR p_name IS NULL OR p_city IS NULL OR p_iata_code IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: All airport fields are required.';
    END IF;

    IF EXISTS (SELECT 1 FROM airport WHERE airport_id = p_id) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Airport with ID % already exists.', p_id;
    END IF;

    -- IATA code must be unique
    IF EXISTS (SELECT 1 FROM airport WHERE iata_code = p_iata_code) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: IATA code % is already in use.', p_iata_code;
    END IF;

    INSERT INTO airport (airport_id, airport_name, city, state, country, iata_code)
    VALUES (p_id, p_name, p_city, p_state, p_country, p_iata_code);
END;
$$;

-- ----------------------------------------------------------
-- 3.8 insert_user — Create a new passenger user
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_user(
    p_id      INT,
    p_name    VARCHAR,
    p_email   VARCHAR,
    p_phone   VARCHAR,
    p_address VARCHAR
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_id IS NULL OR p_name IS NULL OR p_email IS NULL
       OR p_phone IS NULL OR p_address IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: All user fields are required.';
    END IF;

    IF EXISTS (SELECT 1 FROM "User" WHERE user_id = p_id) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: User with ID % already exists.', p_id;
    END IF;

    -- Unique email check
    IF EXISTS (SELECT 1 FROM "User" WHERE email = p_email) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Email "%" is already registered.', p_email;
    END IF;

    INSERT INTO "User" (user_id, name, email, phone, address)
    VALUES (p_id, p_name, p_email, p_phone, p_address);
END;
$$;

-- ----------------------------------------------------------
-- 3.9 insert_flight — Create flight with aircraft validation
--     (Aircraft status side-effect handled in trigger, see §5)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_flight(
    p_id                INT,
    p_aircraft_id       INT,
    p_dep_time          TIMESTAMP,
    p_arr_time          TIMESTAMP,
    p_src_airport_id    INT,
    p_dest_airport_id   INT
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_ac_status VARCHAR;
BEGIN
    IF p_id IS NULL OR p_aircraft_id IS NULL
       OR p_dep_time IS NULL OR p_arr_time IS NULL
       OR p_src_airport_id IS NULL OR p_dest_airport_id IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: All flight fields are required.';
    END IF;

    IF p_arr_time <= p_dep_time THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Arrival time must be after departure time.';
    END IF;

    IF p_src_airport_id = p_dest_airport_id THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Source and destination airports must be different.';
    END IF;

    -- Aircraft must exist and be AVAILABLE
    SELECT status_type INTO v_ac_status FROM aircraft WHERE aircraft_id = p_aircraft_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Aircraft with ID % does not exist.', p_aircraft_id;
    END IF;
    IF UPPER(v_ac_status) <> 'AVAILABLE' THEN
        RAISE EXCEPTION 'CONSTRAINT_ERROR: Aircraft % is not available (current status: %).', p_aircraft_id, v_ac_status;
    END IF;

    IF EXISTS (SELECT 1 FROM flight WHERE flight_id = p_id) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Flight with ID % already exists.', p_id;
    END IF;

    INSERT INTO flight (flight_id, aircraft_id, departure_time, arrival_time, source_airport_id, dest_airport_id)
    VALUES (p_id, p_aircraft_id, p_dep_time, p_arr_time, p_src_airport_id, p_dest_airport_id);
    -- Note: aircraft status (AVAILABLE → ACTIVE) and hour increment
    --       are handled automatically by trg_flight_after_insert (Section 5).
END;
$$;

-- ----------------------------------------------------------
-- 3.10 update_flight — Update flight, handle aircraft swap
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_flight(
    p_id                INT,
    p_aircraft_id       INT,
    p_dep_time          TIMESTAMP,
    p_arr_time          TIMESTAMP,
    p_src_airport_id    INT,
    p_dest_airport_id   INT
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_old_aircraft_id   INT;
    v_old_dep_time      TIMESTAMP;
    v_old_arr_time      TIMESTAMP;
    v_old_hours         INT;
    v_new_hours         INT;
    v_delta             INT;
    v_ac_status         VARCHAR;
BEGIN
    IF p_arr_time <= p_dep_time THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Arrival time must be after departure time.';
    END IF;

    -- Snapshot old state
    SELECT aircraft_id, departure_time, arrival_time
    INTO v_old_aircraft_id, v_old_dep_time, v_old_arr_time
    FROM flight WHERE flight_id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Flight with ID % does not exist.', p_id;
    END IF;

    v_old_hours := CEIL(EXTRACT(EPOCH FROM (v_old_arr_time - v_old_dep_time)) / 3600.0);
    v_new_hours := CEIL(EXTRACT(EPOCH FROM (p_arr_time     - p_dep_time))     / 3600.0);

    IF v_old_aircraft_id <> p_aircraft_id THEN
        -- Validate new aircraft
        SELECT status_type INTO v_ac_status FROM aircraft WHERE aircraft_id = p_aircraft_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'NOT_FOUND: Aircraft with ID % does not exist.', p_aircraft_id;
        END IF;
        IF UPPER(v_ac_status) <> 'AVAILABLE' THEN
            RAISE EXCEPTION 'CONSTRAINT_ERROR: Aircraft % is not available (status: %).', p_aircraft_id, v_ac_status;
        END IF;

        -- Release old aircraft: roll back hours, mark AVAILABLE
        UPDATE aircraft
        SET status_type        = 'AVAILABLE',
            total_flight_hours = GREATEST(0, COALESCE(total_flight_hours, 0) - v_old_hours)
        WHERE aircraft_id = v_old_aircraft_id;

        -- Assign new aircraft: add hours, mark ACTIVE
        UPDATE aircraft
        SET status_type        = 'ACTIVE',
            total_flight_hours = COALESCE(total_flight_hours, 0) + v_new_hours
        WHERE aircraft_id = p_aircraft_id;
    ELSE
        -- Same aircraft — just apply the delta
        v_delta := v_new_hours - v_old_hours;
        UPDATE aircraft
        SET status_type        = 'ACTIVE',
            total_flight_hours = GREATEST(0, COALESCE(total_flight_hours, 0) + v_delta)
        WHERE aircraft_id = p_aircraft_id;
    END IF;

    UPDATE flight
    SET aircraft_id       = p_aircraft_id,
        departure_time    = p_dep_time,
        arrival_time      = p_arr_time,
        source_airport_id = p_src_airport_id,
        dest_airport_id   = p_dest_airport_id
    WHERE flight_id = p_id;
END;
$$;

-- ----------------------------------------------------------
-- 3.11 cascade_delete_flight
--      Deletes a flight and every dependent record atomically.
--      Replaces the 8 sequential backend queries.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION cascade_delete_flight(p_id INT)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM flight WHERE flight_id = p_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Flight with ID % does not exist.', p_id;
    END IF;

    DELETE FROM luggage      WHERE booking_id IN (SELECT booking_id FROM booking WHERE flight_id = p_id);
    DELETE FROM booking      WHERE flight_id = p_id;
    DELETE FROM crew_assign  WHERE flight_id = p_id;
    DELETE FROM pilot_assign WHERE flight_id = p_id;
    DELETE FROM uses_gate    WHERE flight_id = p_id;
    DELETE FROM uses_runway  WHERE flight_id = p_id;
    DELETE FROM flight_legs  WHERE flight_id = p_id;
    DELETE FROM flight       WHERE flight_id = p_id;
END;
$$;

-- ----------------------------------------------------------
-- 3.12 insert_booking — Validate & insert a booking
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_booking(
    p_id                INT,
    p_flight_id         INT,
    p_route_id          INT,
    p_leg_seq           INT,
    p_user_id           INT,
    p_seat_type         VARCHAR,
    p_seat_number       VARCHAR,
    p_booking_date      DATE,
    p_booking_status    VARCHAR,
    p_booking_seq       INT
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_id IS NULL OR p_flight_id IS NULL OR p_route_id IS NULL
       OR p_leg_seq IS NULL OR p_user_id IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: All booking fields are required.';
    END IF;

    -- Seat type check
    IF UPPER(p_seat_type) NOT IN ('ECONOMY', 'BUSINESS') THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Seat type must be Economy or Business, got %.', p_seat_type;
    END IF;

    -- Flight leg must exist (composite FK)
    IF NOT EXISTS (SELECT 1 FROM flight_legs
                   WHERE flight_id = p_flight_id
                     AND route_id  = p_route_id
                     AND leg_sequence_no = p_leg_seq) THEN
        RAISE EXCEPTION 'NOT_FOUND: Flight leg (%,  %,  %) does not exist.', p_flight_id, p_route_id, p_leg_seq;
    END IF;

    -- Check seat capacity
    IF NOT fn_check_seat_available(p_flight_id, p_route_id, p_leg_seq, p_seat_type) THEN
        RAISE EXCEPTION 'CAPACITY_ERROR: No % seats available on this flight leg.', p_seat_type;
    END IF;

    -- Duplicate booking ID
    IF EXISTS (SELECT 1 FROM booking WHERE booking_id = p_id) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Booking with ID % already exists.', p_id;
    END IF;

    -- Duplicate seat on same leg
    IF EXISTS (SELECT 1 FROM booking
               WHERE flight_id = p_flight_id AND route_id = p_route_id
                 AND leg_sequence_no = p_leg_seq AND seat_number = p_seat_number) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Seat % is already taken on this flight leg.', p_seat_number;
    END IF;

    INSERT INTO booking (
        booking_id, flight_id, route_id, leg_sequence_no, user_id,
        seat_type, seat_number, booking_date, booking_status, booking_sequence_no
    ) VALUES (
        p_id, p_flight_id, p_route_id, p_leg_seq, p_user_id,
        p_seat_type, p_seat_number, p_booking_date, p_booking_status, p_booking_seq
    );
END;
$$;

-- ----------------------------------------------------------
-- 3.13 insert_maintenance — Validate & insert maintenance record
--      Auto-updates aircraft status as a side-effect.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_maintenance(
    p_id               INT,
    p_aircraft_id      INT,
    p_type             VARCHAR,
    p_notes            TEXT,
    p_status           VARCHAR,
    p_scheduled_date   DATE,
    p_start_date       DATE,
    p_completion_date  DATE,
    p_total_cost       DECIMAL
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_aircraft_new_status VARCHAR;
BEGIN
    IF p_id IS NULL OR p_aircraft_id IS NULL OR p_type IS NULL
       OR p_status IS NULL OR p_scheduled_date IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Maintenance ID, Aircraft, Type, Status, and Scheduled Date are required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM aircraft WHERE aircraft_id = p_aircraft_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Aircraft with ID % does not exist.', p_aircraft_id;
    END IF;

    IF EXISTS (SELECT 1 FROM maintenance WHERE maintenance_id = p_id) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Maintenance record with ID % already exists.', p_id;
    END IF;

    IF p_completion_date IS NOT NULL AND p_start_date IS NOT NULL
       AND p_completion_date < p_start_date THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Completion date cannot be before start date.';
    END IF;

    INSERT INTO maintenance (
        maintenance_id, aircraft_id, maintenance_type, technician_notes,
        maintenance_status, scheduled_date, actual_start_date, completion_date, total_cost
    ) VALUES (
        p_id, p_aircraft_id, p_type, p_notes,
        p_status, p_scheduled_date, p_start_date, p_completion_date, p_total_cost
    );
    -- Aircraft status side-effect is handled by trg_maintenance_status_sync (Section 5).
END;
$$;

-- ----------------------------------------------------------
-- 3.14 update_maintenance — Update record, handle aircraft swap
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_maintenance(
    p_id               INT,
    p_aircraft_id      INT,
    p_type             VARCHAR,
    p_notes            TEXT,
    p_status           VARCHAR,
    p_scheduled_date   DATE,
    p_start_date       DATE,
    p_completion_date  DATE,
    p_total_cost       DECIMAL
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_old_aircraft_id INT;
BEGIN
    SELECT aircraft_id INTO v_old_aircraft_id
    FROM maintenance WHERE maintenance_id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Maintenance record with ID % does not exist.', p_id;
    END IF;

    UPDATE maintenance
    SET aircraft_id        = p_aircraft_id,
        maintenance_type   = p_type,
        technician_notes   = p_notes,
        maintenance_status = p_status,
        scheduled_date     = p_scheduled_date,
        actual_start_date  = p_start_date,
        completion_date    = p_completion_date,
        total_cost         = p_total_cost
    WHERE maintenance_id = p_id;
    -- Trigger trg_maintenance_status_sync handles the aircraft status update.

    -- If aircraft was swapped, restore old aircraft to AVAILABLE
    IF v_old_aircraft_id IS NOT NULL AND v_old_aircraft_id <> p_aircraft_id THEN
        UPDATE aircraft SET status_type = 'AVAILABLE' WHERE aircraft_id = v_old_aircraft_id;
    END IF;
END;
$$;

-- ----------------------------------------------------------
-- 3.15 insert_flight_leg — Validated flight leg insertion
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_flight_leg(
    p_flight_id   INT,
    p_route_id    INT,
    p_leg_seq     INT,
    p_takeoff     TIMESTAMP,
    p_landing     TIMESTAMP,
    p_status      VARCHAR
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_flight_id IS NULL OR p_route_id IS NULL OR p_leg_seq IS NULL
       OR p_takeoff IS NULL OR p_landing IS NULL OR p_status IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: All flight leg fields are required.';
    END IF;

    IF p_landing <= p_takeoff THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Landing time must be after takeoff time.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM flight WHERE flight_id = p_flight_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Flight with ID % does not exist.', p_flight_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM route WHERE route_id = p_route_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Route with ID % does not exist.', p_route_id;
    END IF;

    IF EXISTS (SELECT 1 FROM flight_legs
               WHERE flight_id = p_flight_id AND route_id = p_route_id AND leg_sequence_no = p_leg_seq) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Flight leg (%, %, %) already exists.', p_flight_id, p_route_id, p_leg_seq;
    END IF;

    INSERT INTO flight_legs (flight_id, route_id, leg_sequence_no, takeoff_time, landing_time, leg_status)
    VALUES (p_flight_id, p_route_id, p_leg_seq, p_takeoff, p_landing, p_status);
END;
$$;

-- ----------------------------------------------------------
-- 3.16 assign_pilot — Assign pilot to a flight leg
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_pilot(
    p_flight_id INT,
    p_route_id  INT,
    p_leg_seq   INT,
    p_pilot_id  INT
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_flight_id IS NULL OR p_route_id IS NULL OR p_leg_seq IS NULL OR p_pilot_id IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: All assignment fields are required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM flight_legs WHERE flight_id = p_flight_id AND route_id = p_route_id AND leg_sequence_no = p_leg_seq) THEN
        RAISE EXCEPTION 'NOT_FOUND: Flight leg does not exist.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pilot WHERE pilot_id = p_pilot_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Pilot with ID % does not exist.', p_pilot_id;
    END IF;

    IF EXISTS (SELECT 1 FROM pilot_assign WHERE flight_id = p_flight_id AND route_id = p_route_id AND leg_sequence_no = p_leg_seq AND pilot_id = p_pilot_id) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Pilot % is already assigned to this flight leg.', p_pilot_id;
    END IF;

    INSERT INTO pilot_assign (flight_id, route_id, leg_sequence_no, pilot_id)
    VALUES (p_flight_id, p_route_id, p_leg_seq, p_pilot_id);
END;
$$;

-- ----------------------------------------------------------
-- 3.17 assign_crew — Assign crew to a flight leg
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_crew(
    p_flight_id INT,
    p_route_id  INT,
    p_leg_seq   INT,
    p_crew_id   INT
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_flight_id IS NULL OR p_route_id IS NULL OR p_leg_seq IS NULL OR p_crew_id IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: All assignment fields are required.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM flight_legs WHERE flight_id = p_flight_id AND route_id = p_route_id AND leg_sequence_no = p_leg_seq) THEN
        RAISE EXCEPTION 'NOT_FOUND: Flight leg does not exist.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM crew WHERE crew_id = p_crew_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Crew member with ID % does not exist.', p_crew_id;
    END IF;

    IF EXISTS (SELECT 1 FROM crew_assign WHERE flight_id = p_flight_id AND route_id = p_route_id AND leg_sequence_no = p_leg_seq AND crew_id = p_crew_id) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Crew member % is already assigned to this flight leg.', p_crew_id;
    END IF;

    INSERT INTO crew_assign (flight_id, route_id, leg_sequence_no, crew_id)
    VALUES (p_flight_id, p_route_id, p_leg_seq, p_crew_id);
END;
$$;

-- ----------------------------------------------------------
-- 3.18 insert_luggage — Validate & insert luggage record
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_luggage(
    p_id         INT,
    p_booking_id INT,
    p_tag        VARCHAR,
    p_weight     DECIMAL
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF p_id IS NULL OR p_booking_id IS NULL OR p_tag IS NULL OR p_weight IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: All luggage fields are required.';
    END IF;

    IF p_weight <= 0 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Luggage weight must be positive.';
    END IF;

    IF p_weight > 50 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Single piece weight cannot exceed 50 kg (got %).', p_weight;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM booking WHERE booking_id = p_booking_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Booking with ID % does not exist.', p_booking_id;
    END IF;

    IF EXISTS (SELECT 1 FROM luggage WHERE luggage_id = p_id) THEN
        RAISE EXCEPTION 'DUPLICATE_ERROR: Luggage with ID % already exists.', p_id;
    END IF;

    INSERT INTO luggage (luggage_id, booking_id, tag_number, weight)
    VALUES (p_id, p_booking_id, p_tag, p_weight);
END;
$$;


-- ============================================================
-- SECTION 4: BUSINESS LOGIC FUNCTIONS
-- Derived computations that would otherwise live in JS backend
-- ============================================================

-- ----------------------------------------------------------
-- 4.1 fn_flight_duration_hours(p_flight_id) → NUMERIC
--     Returns actual duration in hours (ceiling).
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_flight_duration_hours(p_flight_id INT)
RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
    SELECT (CEIL(EXTRACT(EPOCH FROM (arrival_time - departure_time)) / 3600.0))::NUMERIC
    FROM flight WHERE flight_id = p_flight_id;
$$;

-- ----------------------------------------------------------
-- 4.2 fn_check_seat_available(flight, route, leg, seat_type)
--     Returns TRUE if seats of p_seat_type remain available.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_seat_available(
    p_flight_id INT, p_route_id INT, p_leg_seq INT, p_seat_type VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_capacity   INT;
    v_booked     INT;
BEGIN
    SELECT CASE UPPER(p_seat_type)
               WHEN 'ECONOMY'  THEN ac.tot_eco_seats
               WHEN 'BUSINESS' THEN ac.tot_bus_seats
               ELSE 0
           END
    INTO v_capacity
    FROM flight f
    JOIN aircraft ac ON f.aircraft_id = ac.aircraft_id
    WHERE f.flight_id = p_flight_id;

    SELECT COUNT(*) INTO v_booked
    FROM booking
    WHERE flight_id      = p_flight_id
      AND route_id       = p_route_id
      AND leg_sequence_no = p_leg_seq
      AND UPPER(seat_type) = UPPER(p_seat_type)
      AND UPPER(booking_status) <> 'CANCELLED';

    RETURN COALESCE(v_capacity, 0) > v_booked;
END;
$$;

-- ----------------------------------------------------------
-- 4.3 fn_loyalty_tier(p_user_id) → VARCHAR
--     Compute the loyalty tier for any user on-demand.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_loyalty_tier(p_user_id INT)
RETURNS VARCHAR
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_km NUMERIC;
BEGIN
    SELECT COALESCE(SUM(r.distance), 0)
    INTO v_km
    FROM booking b
    JOIN route r ON b.route_id = r.route_id
    WHERE b.user_id = p_user_id AND UPPER(b.booking_status) = 'CONFIRMED';

    RETURN CASE
        WHEN v_km >= 15000 THEN 'Platinum'
        WHEN v_km >= 10000 THEN 'Gold'
        WHEN v_km >= 5000  THEN 'Silver'
        ELSE 'Bronze'
    END;
END;
$$;

-- ----------------------------------------------------------
-- 4.4 fn_aircraft_load_factor(p_flight_id) → NUMERIC (pct)
--     Calculates the occupancy % for a given flight.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_aircraft_load_factor(p_flight_id INT)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_capacity INT;
    v_booked   INT;
BEGIN
    SELECT (ac.tot_eco_seats + ac.tot_bus_seats) INTO v_capacity
    FROM flight f JOIN aircraft ac ON f.aircraft_id = ac.aircraft_id
    WHERE f.flight_id = p_flight_id;

    SELECT COUNT(*) INTO v_booked
    FROM booking WHERE flight_id = p_flight_id AND UPPER(booking_status) = 'CONFIRMED';

    IF COALESCE(v_capacity, 0) = 0 THEN RETURN 0; END IF;
    RETURN ROUND(v_booked::NUMERIC / v_capacity * 100, 2);
END;
$$;

-- ----------------------------------------------------------
-- 4.5 fn_pilot_workload_tier(p_pilot_id) → VARCHAR
--     Returns Heavy / Moderate / Light for DGCA compliance.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_pilot_workload_tier(p_pilot_id INT)
RETURNS VARCHAR
LANGUAGE plpgsql STABLE AS $$
DECLARE v_legs INT;
BEGIN
    SELECT COUNT(*) INTO v_legs FROM pilot_assign WHERE pilot_id = p_pilot_id;
    RETURN CASE
        WHEN v_legs > 4  THEN 'Heavy'
        WHEN v_legs >= 2 THEN 'Moderate'
        ELSE 'Light'
    END;
END;
$$;

-- ----------------------------------------------------------
-- 4.6 fn_co2_metric_tons(p_airline_id) → NUMERIC
--     Estimated CO2 in metric tons (0.115 kg/km standard).
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_co2_metric_tons(p_airline_id INT)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE AS $$
DECLARE v_total NUMERIC;
BEGIN
    SELECT COALESCE(ROUND(SUM(r.distance * 0.115)::NUMERIC / 1000, 2), 0)
    INTO v_total
    FROM airline al
    JOIN aircraft ac ON al.airline_id = ac.airline_id
    JOIN flight   f  ON ac.aircraft_id = f.aircraft_id
    JOIN flight_legs fl ON f.flight_id = fl.flight_id
    JOIN route    r  ON fl.route_id   = r.route_id
    WHERE al.airline_id = p_airline_id;

    RETURN v_total;
END;
$$;

-- ----------------------------------------------------------
-- 4.7 fn_maintenance_cost_per_booking(p_aircraft_id) → NUMERIC
--     CFO efficiency metric: total maintenance ÷ confirmed bookings.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_maintenance_cost_per_booking(p_aircraft_id INT)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_cost    NUMERIC;
    v_bookings INT;
BEGIN
    SELECT COALESCE(SUM(total_cost), 0) INTO v_cost
    FROM maintenance WHERE aircraft_id = p_aircraft_id;

    SELECT COUNT(*) INTO v_bookings
    FROM flight f
    JOIN booking b ON f.flight_id = b.flight_id
    WHERE f.aircraft_id = p_aircraft_id AND UPPER(b.booking_status) = 'CONFIRMED';

    IF v_bookings = 0 THEN RETURN 2 * v_cost; END IF;
    RETURN ROUND(v_cost / v_bookings, 2);
END;
$$;

-- ----------------------------------------------------------
-- 4.8 fn_detect_crew_rest_violations() → TABLE
--     DGCA compliance: flags crew scheduled < 10h after landing.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_detect_crew_rest_violations()
RETURNS TABLE (
    crew_id    INT,
    crew_name  VARCHAR,
    flight_1   INT,
    landed_at  TIMESTAMP,
    flight_2   INT,
    departs_at TIMESTAMP,
    rest_hours NUMERIC
)
LANGUAGE sql STABLE AS $$
    SELECT
        ca1.crew_id,
        c.name           AS crew_name,
        ca1.flight_id    AS flight_1,
        f1.arrival_time  AS landed_at,
        ca2.flight_id    AS flight_2,
        f2.departure_time AS departs_at,
        ROUND((EXTRACT(EPOCH FROM (f2.departure_time - f1.arrival_time)) / 3600.0)::NUMERIC, 2) AS rest_hours
    FROM crew_assign ca1
    JOIN crew_assign ca2 ON ca1.crew_id = ca2.crew_id AND ca1.flight_id <> ca2.flight_id
    JOIN flight f1 ON ca1.flight_id = f1.flight_id
    JOIN flight f2 ON ca2.flight_id = f2.flight_id
    JOIN crew   c  ON ca1.crew_id   = c.crew_id
    WHERE f2.departure_time > f1.arrival_time
      AND EXTRACT(EPOCH FROM (f2.departure_time - f1.arrival_time)) / 3600.0 < 10
    ORDER BY ROUND((EXTRACT(EPOCH FROM (f2.departure_time - f1.arrival_time)) / 3600.0)::NUMERIC, 2) ASC;
$$;

-- ----------------------------------------------------------
-- 4.9 fn_airport_bottleneck_score() → TABLE
--     Infrastructure planning: runway + gate usage per airport.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_airport_bottleneck_score()
RETURNS TABLE (
    airport_id           INT,
    airport_name         VARCHAR,
    iata_code            VARCHAR,
    runway_ops           BIGINT,
    gate_ops             BIGINT,
    total_activity_score BIGINT
)
LANGUAGE sql STABLE AS $$
    WITH runway_act AS (
        SELECT airport_id, COUNT(*) AS ops FROM uses_runway GROUP BY airport_id
    ),
    gate_act AS (
        SELECT airport_id, COUNT(*) AS ops FROM uses_gate GROUP BY airport_id
    )
    SELECT
        ap.airport_id,
        ap.airport_name,
        ap.iata_code,
        COALESCE(ra.ops, 0),
        COALESCE(ga.ops, 0),
        COALESCE(ra.ops, 0) + COALESCE(ga.ops, 0) as total_activity_score
    FROM airport ap
    LEFT JOIN runway_act ra ON ap.airport_id = ra.airport_id
    LEFT JOIN gate_act   ga ON ap.airport_id = ga.airport_id
    WHERE COALESCE(ra.ops, 0) + COALESCE(ga.ops, 0) > 0
    ORDER BY COALESCE(ra.ops, 0) + COALESCE(ga.ops, 0) DESC;
$$;

-- ----------------------------------------------------------
-- 4.10 fn_route_string(p_flight_id) → TEXT
--      Human-readable route: 'Ahmedabad -> Mumbai -> Bengaluru'
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_route_string(p_flight_id INT)
RETURNS TEXT
LANGUAGE sql STABLE AS $$
    WITH leg_paths AS (
        SELECT fl.leg_sequence_no,
               src.city AS source_city,
               dst.city AS dest_city
        FROM flight_legs fl
        JOIN route   r   ON fl.route_id = r.route_id
        JOIN airport src ON r.source_airport_id = src.airport_id
        JOIN airport dst ON r.dest_airport_id   = dst.airport_id
        WHERE fl.flight_id = p_flight_id
    )
    SELECT
        MAX(CASE WHEN leg_sequence_no = 1 THEN source_city ELSE '' END) ||
        STRING_AGG(' -> ' || dest_city, '' ORDER BY leg_sequence_no)
    FROM leg_paths;
$$;


-- ============================================================
-- SECTION 5: TRIGGERS — Auto-update & Validation
-- ============================================================

-- ----------------------------------------------------------
-- 5.1 trg_flight_after_insert
--     AUTO: When a flight is INSERTed, set aircraft ACTIVE
--     and add the flight duration hours to flight hour tally.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trig_flight_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_hours INT;
BEGIN
    v_hours := CEIL(EXTRACT(EPOCH FROM (NEW.arrival_time - NEW.departure_time)) / 3600.0);

    UPDATE aircraft
    SET status_type        = 'ACTIVE',
        total_flight_hours = COALESCE(total_flight_hours, 0) + v_hours
    WHERE aircraft_id = NEW.aircraft_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flight_after_insert ON flight;
CREATE TRIGGER trg_flight_after_insert
AFTER INSERT ON flight
FOR EACH ROW EXECUTE PROCEDURE fn_trig_flight_after_insert();

-- ----------------------------------------------------------
-- 5.2 trg_flight_after_delete
--     AUTO: Restore aircraft to AVAILABLE when a flight is
--     deleted (if it has no remaining active flights).
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trig_flight_after_delete()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_remaining INT;
    v_hours     INT;
BEGIN
    v_hours := CEIL(EXTRACT(EPOCH FROM (OLD.arrival_time - OLD.departure_time)) / 3600.0);

    SELECT COUNT(*) INTO v_remaining
    FROM flight WHERE aircraft_id = OLD.aircraft_id;

    IF v_remaining = 0 THEN
        UPDATE aircraft
        SET status_type        = 'AVAILABLE',
            total_flight_hours = GREATEST(0, COALESCE(total_flight_hours, 0) - v_hours)
        WHERE aircraft_id = OLD.aircraft_id;
    ELSE
        UPDATE aircraft
        SET total_flight_hours = GREATEST(0, COALESCE(total_flight_hours, 0) - v_hours)
        WHERE aircraft_id = OLD.aircraft_id;
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_flight_after_delete ON flight;
CREATE TRIGGER trg_flight_after_delete
AFTER DELETE ON flight
FOR EACH ROW EXECUTE PROCEDURE fn_trig_flight_after_delete();

-- ----------------------------------------------------------
-- 5.3 trg_maintenance_status_sync
--     AUTO: Sync Aircraft.Status_Type whenever a Maintenance
--     record is INSERTed or UPDATEd.
--     Completed → AVAILABLE | Any other status → INACTIVE
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trig_maintenance_status_sync()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_new_status VARCHAR;
BEGIN
    v_new_status := CASE UPPER(NEW.maintenance_status)
                        WHEN 'COMPLETED' THEN 'AVAILABLE'
                        ELSE 'INACTIVE'
                    END;

    UPDATE aircraft
    SET status_type = v_new_status
    WHERE aircraft_id = NEW.aircraft_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_status_sync ON maintenance;
CREATE TRIGGER trg_maintenance_status_sync
AFTER INSERT OR UPDATE ON maintenance
FOR EACH ROW EXECUTE PROCEDURE fn_trig_maintenance_status_sync();

-- ----------------------------------------------------------
-- 5.4 trg_validate_flight_times  (BEFORE INSERT/UPDATE)
--     VALIDATION: Ensures arrival > departure and airports differ.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trig_validate_flight_times()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.arrival_time <= NEW.departure_time THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Arrival time must be strictly after departure time.';
    END IF;

    IF NEW.source_airport_id = NEW.dest_airport_id THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Source and destination airports must be different.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_flight_times ON flight;
CREATE TRIGGER trg_validate_flight_times
BEFORE INSERT OR UPDATE ON flight
FOR EACH ROW EXECUTE PROCEDURE fn_trig_validate_flight_times();

-- ----------------------------------------------------------
-- 5.5 trg_validate_leg_times  (BEFORE INSERT/UPDATE)
--     VALIDATION: Ensures landing > takeoff on every leg.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trig_validate_leg_times()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.landing_time <= NEW.takeoff_time THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Landing time must be strictly after takeoff time.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_leg_times ON flight_legs;
CREATE TRIGGER trg_validate_leg_times
BEFORE INSERT OR UPDATE ON flight_legs
FOR EACH ROW EXECUTE PROCEDURE fn_trig_validate_leg_times();

-- ----------------------------------------------------------
-- 5.6 trg_validate_fuel  (BEFORE INSERT/UPDATE on Aircraft)
--     VALIDATION: Current fuel cannot exceed total capacity.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trig_validate_fuel()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.current_fuel_level > NEW.total_fuel_capacity THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Current fuel level (%) cannot exceed total capacity (%) for aircraft %.', NEW.current_fuel_level, NEW.total_fuel_capacity, NEW.aircraft_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_fuel ON aircraft;
CREATE TRIGGER trg_validate_fuel
BEFORE INSERT OR UPDATE ON aircraft
FOR EACH ROW EXECUTE PROCEDURE fn_trig_validate_fuel();

-- ----------------------------------------------------------
-- 5.7 trg_validate_maintenance_dates (BEFORE INSERT/UPDATE)
--     VALIDATION: Completion date cannot precede start date.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trig_validate_maintenance_dates()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.completion_date IS NOT NULL AND NEW.actual_start_date IS NOT NULL
       AND NEW.completion_date < NEW.actual_start_date THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: Completion date (%) cannot be before start date (%).', NEW.completion_date, NEW.actual_start_date;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_maintenance_dates ON maintenance;
CREATE TRIGGER trg_validate_maintenance_dates
BEFORE INSERT OR UPDATE ON maintenance
FOR EACH ROW EXECUTE PROCEDURE fn_trig_validate_maintenance_dates();

-- ----------------------------------------------------------
-- 5.8 trg_audit_booking_status  (BEFORE UPDATE on Booking)
--     VALIDATION: Prevents status from reverting Cancelled → Confirmed.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trig_audit_booking_status()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF UPPER(OLD.booking_status) = 'CANCELLED' AND UPPER(NEW.booking_status) = 'CONFIRMED' THEN
        RAISE EXCEPTION 'BUSINESS_RULE: A cancelled booking cannot be reinstated to Confirmed.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_booking_status ON booking;
CREATE TRIGGER trg_audit_booking_status
BEFORE UPDATE ON booking
FOR EACH ROW EXECUTE PROCEDURE fn_trig_audit_booking_status();


-- ============================================================
-- SECTION 6: CONSTRAINT FUNCTIONS — Custom Assertions
-- ============================================================

-- ----------------------------------------------------------
-- 6.1 fn_assert_iata_unique(p_iata) → BOOLEAN
--     Returns FALSE if IATA code is already taken (for API use).
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_assert_iata_unique(p_iata VARCHAR, p_exclude_id INT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM airport
        WHERE iata_code = p_iata
          AND (p_exclude_id IS NULL OR airport_id <> p_exclude_id)
    );
$$;

-- ----------------------------------------------------------
-- 6.2 fn_assert_seat_type_valid(p_seat_type) → BOOLEAN
--     Returns TRUE only for allowed seat type values.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_assert_seat_type_valid(p_seat_type VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
    SELECT UPPER(p_seat_type) IN ('ECONOMY', 'BUSINESS');
$$;

-- ----------------------------------------------------------
-- 6.3 fn_assert_no_duplicate_seat(flight, route, leg, seat_no)
--     Returns TRUE if the seat number is still free on this leg.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_assert_no_duplicate_seat(
    p_flight_id INT, p_route_id INT, p_leg_seq INT, p_seat_no VARCHAR, p_exclude_booking INT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM booking
        WHERE flight_id       = p_flight_id
          AND route_id        = p_route_id
          AND leg_sequence_no = p_leg_seq
          AND seat_number     = p_seat_no
          AND UPPER(booking_status) <> 'CANCELLED'
          AND (p_exclude_booking IS NULL OR booking_id <> p_exclude_booking)
    );
$$;

-- ----------------------------------------------------------
-- 6.4 fn_assert_aircraft_status_valid(p_status) → BOOLEAN
--     Validates that status is one of the permitted values.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_assert_aircraft_status_valid(p_status VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
    SELECT UPPER(p_status) IN ('AVAILABLE', 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'GROUNDED');
$$;


-- ============================================================
-- SECTION 7: TRANSACTION WRAPPERS
-- Multi-step atomic operations with full rollback on failure
-- ============================================================

-- ----------------------------------------------------------
-- 7.1 txn_book_passenger
--     Atomically: validates leg → validates seat → inserts booking
--     → optionally inserts luggage records in one transaction.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION txn_book_passenger(
    p_booking_id        INT,
    p_flight_id         INT,
    p_route_id          INT,
    p_leg_seq           INT,
    p_user_id           INT,
    p_seat_type         VARCHAR,
    p_seat_number       VARCHAR,
    p_booking_date      DATE,
    p_booking_status    VARCHAR,
    p_booking_seq       INT,
    p_luggage_id        INT         DEFAULT NULL,
    p_luggage_tag       VARCHAR     DEFAULT NULL,
    p_luggage_weight    DECIMAL     DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    -- Step 1: Insert the booking (all validation inside insert_booking)
    PERFORM insert_booking(
        p_booking_id, p_flight_id, p_route_id, p_leg_seq, p_user_id,
        p_seat_type, p_seat_number, p_booking_date, p_booking_status, p_booking_seq
    );

    -- Step 2: Optionally attach luggage in same transaction
    IF p_luggage_id IS NOT NULL THEN
        PERFORM insert_luggage(p_luggage_id, p_booking_id, p_luggage_tag, p_luggage_weight);
    END IF;

    -- Both or neither — PostgreSQL rolls back automatically on any exception
END;
$$;

-- ----------------------------------------------------------
-- 7.2 txn_schedule_flight
--     Atomically: inserts flight → inserts first flight leg.
--     If either fails, neither is committed.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION txn_schedule_flight(
    p_flight_id         INT,
    p_aircraft_id       INT,
    p_dep_time          TIMESTAMP,
    p_arr_time          TIMESTAMP,
    p_src_airport_id    INT,
    p_dest_airport_id   INT,
    
    -- Arrays for multiple legs
    p_route_ids         INT[],
    p_leg_seqs          INT[],
    p_takeoffs          TIMESTAMP[],
    p_landings          TIMESTAMP[],
    p_leg_statuses      VARCHAR[]
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    i INT;
BEGIN
    -- Step 1: Insert flight (only once)
    PERFORM insert_flight(p_flight_id, p_aircraft_id, p_dep_time, p_arr_time, p_src_airport_id, p_dest_airport_id);
    
    -- Step 2: Insert ALL legs in one transaction
    FOR i IN 1 .. array_length(p_route_ids, 1) LOOP
        PERFORM insert_flight_leg(
            p_flight_id,
            p_route_ids[i],
            p_leg_seqs[i],
            p_takeoffs[i],
            p_landings[i],
            p_leg_statuses[i]
        );
    END LOOP;
END;
$$;

-- ----------------------------------------------------------
-- 7.3 txn_cancel_booking
--     Marks booking as Cancelled and deletes its luggage records.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION txn_cancel_booking(p_booking_id INT)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM booking WHERE booking_id = p_booking_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Booking with ID % does not exist.', p_booking_id;
    END IF;

    -- Trigger trg_audit_booking_status will reject reinstatement attempts
    UPDATE booking SET booking_status = 'Cancelled' WHERE booking_id = p_booking_id;
    DELETE FROM luggage WHERE booking_id = p_booking_id;
END;
$$;

-- ----------------------------------------------------------
-- 7.4 txn_complete_maintenance
--     Marks maintenance as Completed and sets completion_date.
--     Trigger automatically restores aircraft to AVAILABLE.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION txn_complete_maintenance(
    p_maintenance_id INT,
    p_completion_date DATE DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM maintenance WHERE maintenance_id = p_maintenance_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Maintenance record % does not exist.', p_maintenance_id;
    END IF;

    UPDATE maintenance
    SET maintenance_status = 'Completed',
        completion_date    = p_completion_date
    WHERE maintenance_id = p_maintenance_id;
    -- Aircraft restored to AVAILABLE by trigger trg_maintenance_status_sync automatically.
END;
$$;

-- ----------------------------------------------------------
-- 7.5 txn_retire_aircraft
--     Marks aircraft RETIRED and cancels all future flights.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION txn_retire_aircraft(p_aircraft_id INT)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_future_flights INT[];
BEGIN
    IF NOT EXISTS (SELECT 1 FROM aircraft WHERE aircraft_id = p_aircraft_id) THEN
        RAISE EXCEPTION 'NOT_FOUND: Aircraft with ID % does not exist.', p_aircraft_id;
    END IF;

    -- Collect future unstarted flights to cancel bookings on them
    SELECT ARRAY_AGG(flight_id) INTO v_future_flights
    FROM flight
    WHERE aircraft_id = p_aircraft_id AND departure_time > NOW();

    IF v_future_flights IS NOT NULL THEN
        -- Cancel all bookings on those future flights
        UPDATE booking
        SET booking_status = 'Cancelled'
        WHERE flight_id = ANY(v_future_flights)
          AND UPPER(booking_status) <> 'CANCELLED';
    END IF;

    UPDATE aircraft SET status_type = 'GROUNDED' WHERE aircraft_id = p_aircraft_id;
END;
$$;


-- ============================================================
-- SECTION 8: ANALYTICS FUNCTIONS (All 37 Report Queries)
-- Each query from AeroFlow_Queries_Solutions.txt is wrapped
-- into a callable SQL function for the /api/reports endpoint.
-- ============================================================

-- === SCENARIO 1: FLIGHT SCHEDULING & OPERATIONS ===

CREATE OR REPLACE FUNCTION rpt_q01_full_flight_schedule()
RETURNS TABLE (flight_id INT, source TEXT, destination TEXT, aircraft_model VARCHAR, airline_name VARCHAR, departure_time TIMESTAMP, arrival_time TIMESTAMP)
LANGUAGE sql STABLE AS $$
    SELECT f.flight_id, a_src.iata_code, a_dst.iata_code, ac.model, al.airline_name, f.departure_time, f.arrival_time
    FROM flight f
    JOIN airport  a_src ON f.source_airport_id = a_src.airport_id
    JOIN airport  a_dst ON f.dest_airport_id   = a_dst.airport_id
    JOIN aircraft ac    ON f.aircraft_id        = ac.aircraft_id
    JOIN airline  al    ON ac.airline_id        = al.airline_id
    ORDER BY f.departure_time;
$$;

CREATE OR REPLACE FUNCTION rpt_q02_top3_busiest_routes()
RETURNS TABLE (route_id INT, from_airport VARCHAR, to_airport VARCHAR, distance DECIMAL, duration_min INT, booking_count BIGINT)
LANGUAGE sql STABLE AS $$
    SELECT r.route_id, a_src.airport_name, a_dst.airport_name, r.distance, r.estimated_duration, COUNT(b.booking_id)
    FROM route r
    JOIN airport     a_src ON r.source_airport_id = a_src.airport_id
    JOIN airport     a_dst ON r.dest_airport_id   = a_dst.airport_id
    JOIN flight_legs fl    ON r.route_id           = fl.route_id
    JOIN booking     b     ON b.flight_id = fl.flight_id AND b.route_id = fl.route_id AND b.leg_sequence_no = fl.leg_sequence_no
    GROUP BY r.route_id, a_src.airport_name, a_dst.airport_name, r.distance, r.estimated_duration
    ORDER BY COUNT(b.booking_id) DESC
    LIMIT 3;
$$;

CREATE OR REPLACE FUNCTION rpt_q03_delayed_legs()
RETURNS TABLE (flight_id INT, leg_sequence_no INT, leg_from TEXT, leg_to TEXT, planned_min INT, actual_min NUMERIC, delay_min NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT fl.flight_id, fl.leg_sequence_no, a_src.iata_code, a_dst.iata_code,
           r.estimated_duration,
           (EXTRACT(EPOCH FROM (fl.landing_time - fl.takeoff_time))/60)::NUMERIC,
           ROUND((EXTRACT(EPOCH FROM (fl.landing_time - fl.takeoff_time))/60 - r.estimated_duration)::NUMERIC, 1) as delay_min
    FROM flight_legs fl
    JOIN route   r     ON fl.route_id          = r.route_id
    JOIN airport a_src ON r.source_airport_id  = a_src.airport_id
    JOIN airport a_dst ON r.dest_airport_id    = a_dst.airport_id
    WHERE EXTRACT(EPOCH FROM (fl.landing_time - fl.takeoff_time))/60 > r.estimated_duration
    ORDER BY ROUND((EXTRACT(EPOCH FROM (fl.landing_time - fl.takeoff_time))/60 - r.estimated_duration)::NUMERIC, 1) DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q04_hub_airports()
RETURNS TABLE (airport_id INT, iata_code VARCHAR, airport_name VARCHAR)
LANGUAGE sql STABLE AS $$
    SELECT ap.airport_id, ap.iata_code, ap.airport_name
    FROM airport ap
    WHERE ap.airport_id IN (SELECT source_airport_id FROM route INTERSECT SELECT dest_airport_id FROM route)
    ORDER BY ap.iata_code;
$$;

CREATE OR REPLACE FUNCTION rpt_q05_pilot_crew_counts()
RETURNS TABLE (flight_id INT, source TEXT, destination TEXT, distinct_pilots BIGINT, distinct_crew BIGINT)
LANGUAGE sql STABLE AS $$
    SELECT f.flight_id, a_src.iata_code, a_dst.iata_code,
           (SELECT COUNT(DISTINCT pilot_id) FROM pilot_assign pa WHERE pa.flight_id = f.flight_id),
           (SELECT COUNT(DISTINCT crew_id)  FROM crew_assign  ca WHERE ca.flight_id = f.flight_id)
    FROM flight f
    JOIN airport a_src ON f.source_airport_id = a_src.airport_id
    JOIN airport a_dst ON f.dest_airport_id   = a_dst.airport_id
    ORDER BY f.flight_id;
$$;

CREATE OR REPLACE FUNCTION rpt_q06_high_utilisation_routes()
RETURNS TABLE (route_id INT, from_iata TEXT, to_iata TEXT, distance DECIMAL, avg_bookings_per_leg NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT r.route_id, a_src.iata_code, a_dst.iata_code, r.distance, rbs.avg_bpl
    FROM route r
    JOIN airport a_src ON r.source_airport_id = a_src.airport_id
    JOIN airport a_dst ON r.dest_airport_id   = a_dst.airport_id
    JOIN (
        SELECT fl.route_id, AVG(COALESCE(lb.bk_count, 0)) AS avg_bpl
        FROM flight_legs fl
        LEFT JOIN (SELECT flight_id, route_id, leg_sequence_no, COUNT(*) AS bk_count FROM booking GROUP BY flight_id, route_id, leg_sequence_no) lb
               ON fl.flight_id = lb.flight_id AND fl.route_id = lb.route_id AND fl.leg_sequence_no = lb.leg_sequence_no
        GROUP BY fl.route_id HAVING AVG(COALESCE(lb.bk_count, 0)) > 1
    ) rbs ON r.route_id = rbs.route_id
    ORDER BY rbs.avg_bpl DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q07_gate_usage()
RETURNS TABLE (iata_code TEXT, gate_no INT, gate_status VARCHAR, departures BIGINT, arrivals BIGINT, gate_usage_flag TEXT)
LANGUAGE sql STABLE AS $$
    SELECT ap.iata_code, g.gate_no, g.gate_status,
           COUNT(CASE WHEN ug.usage_type = 'Departure' THEN 1 END),
           COUNT(CASE WHEN ug.usage_type = 'Arrival'   THEN 1 END),
           CASE WHEN COUNT(ug.gate_no) = 0 THEN 'Idle' ELSE 'Used' END
    FROM gate g
    JOIN airport ap ON g.airport_id = ap.airport_id
    LEFT JOIN uses_gate ug ON g.airport_id = ug.airport_id AND g.gate_no = ug.gate_no
    GROUP BY ap.iata_code, g.gate_no, g.gate_status
    ORDER BY ap.iata_code, g.gate_no;
$$;

CREATE OR REPLACE FUNCTION rpt_q08_multi_leg_itinerary()
RETURNS TABLE (passenger_name VARCHAR, flight_id INT, journey_start TIMESTAMP, journey_end TIMESTAMP, legs_flown BIGINT, total_luggage_kg NUMERIC, route_path TEXT)
LANGUAGE sql STABLE AS $$
    SELECT u.name, f.flight_id, MIN(fl.takeoff_time), MAX(fl.landing_time), COUNT(b.booking_id),
           SUM(l.weight),
           STRING_AGG(a_src.iata_code || '->' || a_dst.iata_code, ' | ' ORDER BY b.leg_sequence_no)
    FROM "User" u
    JOIN booking     b  ON u.user_id     = b.user_id
    JOIN flight      f  ON b.flight_id   = f.flight_id
    JOIN flight_legs fl ON b.flight_id   = fl.flight_id AND b.route_id = fl.route_id AND b.leg_sequence_no = fl.leg_sequence_no
    JOIN route       r  ON fl.route_id   = r.route_id
    JOIN airport  a_src ON r.source_airport_id = a_src.airport_id
    JOIN airport  a_dst ON r.dest_airport_id   = a_dst.airport_id
    LEFT JOIN luggage l ON b.booking_id  = l.booking_id
    WHERE UPPER(b.booking_status) = 'CONFIRMED'
    GROUP BY u.user_id, u.name, f.flight_id
    HAVING COUNT(b.booking_id) > 1
    ORDER BY MIN(fl.takeoff_time);
$$;

CREATE OR REPLACE FUNCTION rpt_q09_airport_bottleneck()
RETURNS TABLE (airport_id INT, airport_name VARCHAR, iata_code VARCHAR, scheduled_runway_uses BIGINT, scheduled_gate_uses BIGINT, total_activity_score BIGINT)
LANGUAGE sql STABLE AS $$
    SELECT * FROM fn_airport_bottleneck_score();
$$;

CREATE OR REPLACE FUNCTION rpt_q10_pilot_roster()
RETURNS TABLE (flight_id INT, leg_sequence_no INT, pilot_name VARCHAR, experience_level VARCHAR, license_number VARCHAR)
LANGUAGE sql STABLE AS $$
    SELECT pa.flight_id, pa.leg_sequence_no, p.name, p.experience_level, p.license_number
    FROM pilot_assign pa JOIN pilot p ON pa.pilot_id = p.pilot_id
    ORDER BY pa.flight_id, pa.leg_sequence_no;
$$;

CREATE OR REPLACE FUNCTION rpt_q11_flight_route_strings()
RETURNS TABLE (flight_id INT, flight_route TEXT)
LANGUAGE sql STABLE AS $$
    WITH leg_paths AS (
        SELECT fl.flight_id, fl.leg_sequence_no, src.city AS source_city, dst.city AS dest_city
        FROM flight_legs fl
        JOIN route r ON fl.route_id = r.route_id
        JOIN airport src ON r.source_airport_id = src.airport_id
        JOIN airport dst ON r.dest_airport_id   = dst.airport_id
    )
    SELECT flight_id,
           MAX(CASE WHEN leg_sequence_no = 1 THEN source_city ELSE '' END) ||
           STRING_AGG(' -> ' || dest_city, '' ORDER BY leg_sequence_no)
    FROM leg_paths
    GROUP BY flight_id
    ORDER BY flight_id;
$$;

-- === SCENARIO 2: PASSENGER EXPERIENCE & BOOKING ANALYTICS ===

CREATE OR REPLACE FUNCTION rpt_q12_revenue_per_route()
RETURNS TABLE (from_airport TEXT, to_airport TEXT, route_distance_km DECIMAL, total_confirmed_bookings BIGINT, est_revenue_inr NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT a_src.iata_code, a_dst.iata_code, r.distance, COUNT(b.booking_id),
           SUM(CASE WHEN b.seat_type = 'Business' THEN 8000 ELSE 4500 END)::NUMERIC
    FROM booking b
    JOIN flight_legs fl ON b.flight_id = fl.flight_id AND b.route_id = fl.route_id AND b.leg_sequence_no = fl.leg_sequence_no
    JOIN route   r      ON fl.route_id = r.route_id
    JOIN airport a_src  ON r.source_airport_id = a_src.airport_id
    JOIN airport a_dst  ON r.dest_airport_id   = a_dst.airport_id
    WHERE UPPER(b.booking_status) = 'CONFIRMED'
    GROUP BY a_src.iata_code, a_dst.iata_code, r.distance
    ORDER BY SUM(CASE WHEN b.seat_type = 'Business' THEN 8000 ELSE 4500 END)::NUMERIC DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q13_power_passengers()
RETURNS TABLE (user_id INT, name VARCHAR, email VARCHAR, booking_count BIGINT)
LANGUAGE sql STABLE AS $$
    SELECT u.user_id, u.name, u.email, ub.cnt
    FROM "User" u
    JOIN (SELECT user_id, COUNT(*) AS cnt FROM booking GROUP BY user_id) ub ON u.user_id = ub.user_id
    JOIN (SELECT AVG(c) AS avg_cnt FROM (SELECT COUNT(*) AS c FROM booking GROUP BY user_id) t) av
      ON ub.cnt > av.avg_cnt
    ORDER BY ub.cnt DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q14_aircraft_passenger_volume()
RETURNS TABLE (airline_name VARCHAR, model VARCHAR, aircraft_id INT, total_bookings BIGINT, unique_passengers BIGINT)
LANGUAGE sql STABLE AS $$
    SELECT al.airline_name, ac.model, ac.aircraft_id, COUNT(b.booking_id), COUNT(DISTINCT b.user_id)
    FROM aircraft ac
    JOIN airline     al ON ac.airline_id  = al.airline_id
    JOIN flight       f ON ac.aircraft_id = f.aircraft_id
    JOIN flight_legs fl ON f.flight_id    = fl.flight_id
    JOIN booking      b ON b.flight_id = fl.flight_id AND b.route_id = fl.route_id AND b.leg_sequence_no = fl.leg_sequence_no
    GROUP BY al.airline_name, ac.model, ac.aircraft_id
    ORDER BY COUNT(b.booking_id) DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q15_heavy_luggage_flights()
RETURNS TABLE (flight_id INT, source TEXT, destination TEXT, total_luggage_kg NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT f.flight_id, a_src.iata_code, a_dst.iata_code, ROUND(SUM(l.weight)::NUMERIC, 2)
    FROM flight f
    JOIN airport a_src ON f.source_airport_id = a_src.airport_id
    JOIN airport a_dst ON f.dest_airport_id   = a_dst.airport_id
    JOIN flight_legs fl ON f.flight_id = fl.flight_id
    JOIN booking     b  ON b.flight_id = fl.flight_id AND b.route_id = fl.route_id AND b.leg_sequence_no = fl.leg_sequence_no
    JOIN luggage     l  ON b.booking_id = l.booking_id
    GROUP BY f.flight_id, a_src.iata_code, a_dst.iata_code
    HAVING SUM(l.weight) > 200
    ORDER BY ROUND(SUM(l.weight)::NUMERIC, 2) DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q16_mixed_class_passengers()
RETURNS TABLE (user_id INT, name VARCHAR, email VARCHAR)
LANGUAGE sql STABLE AS $$
    SELECT u.user_id, u.name, u.email FROM "User" u
    WHERE EXISTS (SELECT 1 FROM booking b1 WHERE b1.user_id = u.user_id AND b1.seat_type = 'Economy')
      AND EXISTS (SELECT 1 FROM booking b2 WHERE b2.user_id = u.user_id AND b2.seat_type = 'Business');
$$;

CREATE OR REPLACE FUNCTION rpt_q17_loyal_passengers()
RETURNS TABLE (user_id INT, name VARCHAR, email VARCHAR)
LANGUAGE sql STABLE AS $$
    SELECT u.user_id, u.name, u.email FROM "User" u
    WHERE NOT EXISTS (SELECT 1 FROM booking b WHERE b.user_id = u.user_id AND UPPER(b.booking_status) = 'CANCELLED')
      AND EXISTS     (SELECT 1 FROM booking b2 WHERE b2.user_id = u.user_id);
$$;

CREATE OR REPLACE FUNCTION rpt_q18_indigo_only_passengers()
RETURNS TABLE (user_id INT, name VARCHAR)
LANGUAGE sql STABLE AS $$
    SELECT u.user_id, u.name FROM "User" u
    WHERE NOT EXISTS (
        (SELECT DISTINCT f.flight_id FROM booking b JOIN flight_legs fl ON b.flight_id = fl.flight_id AND b.route_id = fl.route_id JOIN flight f ON fl.flight_id = f.flight_id WHERE b.user_id = u.user_id)
        EXCEPT
        (SELECT f2.flight_id FROM flight f2 JOIN aircraft ac ON f2.aircraft_id = ac.aircraft_id JOIN airline al ON ac.airline_id = al.airline_id WHERE al.airline_name = 'IndiGo')
    ) AND EXISTS (SELECT 1 FROM booking b2 WHERE b2.user_id = u.user_id);
$$;

CREATE OR REPLACE FUNCTION rpt_q19_manual_bag_inspection()
RETURNS TABLE (booking_id INT, passenger VARCHAR, total_luggage_kg NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT b.booking_id, u.name, ROUND(SUM(l.weight)::NUMERIC, 2)
    FROM booking b JOIN "User" u ON b.user_id = u.user_id JOIN luggage l ON b.booking_id = l.booking_id
    GROUP BY b.booking_id, u.name ORDER BY ROUND(SUM(l.weight)::NUMERIC, 2) DESC OFFSET 1 LIMIT 2;
$$;

CREATE OR REPLACE FUNCTION rpt_q20_travel_buddy_matching(p_reference_user_id INT DEFAULT 401)
RETURNS TABLE (user_id INT, name VARCHAR, email VARCHAR)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT u.user_id, u.name, u.email FROM "User" u
    WHERE u.user_id <> p_reference_user_id
      AND NOT EXISTS (
          (SELECT DISTINCT route_id FROM booking WHERE user_id = p_reference_user_id)
          EXCEPT
          (SELECT DISTINCT route_id FROM booking WHERE user_id = u.user_id)
      )
      AND EXISTS (SELECT 1 FROM booking WHERE user_id = u.user_id);
END;
$$;

-- === SCENARIO 3: FLEET HEALTH, INFRASTRUCTURE & CREW ===

CREATE OR REPLACE FUNCTION rpt_q21_fleet_summary()
RETURNS TABLE (airline_name VARCHAR, total_aircraft BIGINT, avg_flight_hours NUMERIC, max_flight_hours INT, min_flight_hours INT)
LANGUAGE sql STABLE AS $$
    SELECT al.airline_name, COUNT(ac.aircraft_id), AVG(ac.total_flight_hours)::NUMERIC, MAX(ac.total_flight_hours), MIN(ac.total_flight_hours)
    FROM airline al JOIN aircraft ac ON al.airline_id = ac.airline_id
    GROUP BY al.airline_name HAVING COUNT(ac.aircraft_id) > 1
    ORDER BY COUNT(ac.aircraft_id) DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q22_maintenance_cost_audit()
RETURNS TABLE (airline_name VARCHAR, maintenance_count BIGINT, total_cost NUMERIC, avg_cost_per_event NUMERIC, costliest_job DECIMAL)
LANGUAGE sql STABLE AS $$
    SELECT al.airline_name, COUNT(m.maintenance_id), ROUND(SUM(m.total_cost)::NUMERIC,2), ROUND(AVG(m.total_cost)::NUMERIC,2), MAX(m.total_cost)
    FROM airline al JOIN aircraft ac ON al.airline_id = ac.airline_id JOIN maintenance m ON ac.aircraft_id = m.aircraft_id
    GROUP BY al.airline_name HAVING SUM(m.total_cost) > 50000
    ORDER BY ROUND(SUM(m.total_cost)::NUMERIC,2) DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q23_high_utilisation_vs_gofirst()
RETURNS TABLE (aircraft_id INT, model VARCHAR, airline_name VARCHAR, total_flight_hours INT)
LANGUAGE sql STABLE AS $$
    SELECT ac.aircraft_id, ac.model, al.airline_name, ac.total_flight_hours
    FROM aircraft ac JOIN airline al ON ac.airline_id = al.airline_id
    WHERE ac.total_flight_hours > ALL (SELECT total_flight_hours FROM aircraft WHERE airline_id = 5)
    ORDER BY ac.total_flight_hours DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q24_post_maintenance_reliability()
RETURNS TABLE (aircraft_id INT, model VARCHAR, status_type VARCHAR, airline_name VARCHAR, maintenance_type VARCHAR, completion_date DATE)
LANGUAGE sql STABLE AS $$
    SELECT ac.aircraft_id, ac.model, ac.status_type, al.airline_name, m.maintenance_type, m.completion_date
    FROM aircraft ac JOIN airline al ON ac.airline_id = al.airline_id JOIN maintenance m ON ac.aircraft_id = m.aircraft_id
    WHERE UPPER(ac.status_type) IN ('ACTIVE', 'AVAILABLE') AND UPPER(m.maintenance_status) = 'COMPLETED'
    ORDER BY m.completion_date DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q25_aircraft_financial_efficiency()
RETURNS TABLE (aircraft_id INT, airline_name VARCHAR, model VARCHAR, total_maintenance_cost NUMERIC, total_confirmed_bookings BIGINT, maintenance_cost_per_booking NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT a.aircraft_id, al.airline_name, a.model,
           COALESCE(SUM(m.total_cost), 0),
           COUNT(b.booking_id),
           CASE WHEN COUNT(b.booking_id) = 0 THEN 2 * COALESCE(SUM(m.total_cost), 0)
                ELSE ROUND(COALESCE(SUM(m.total_cost), 0) / COUNT(b.booking_id), 2) END
    FROM aircraft a JOIN airline al ON a.airline_id = al.airline_id
    LEFT JOIN maintenance m ON a.aircraft_id = m.aircraft_id
    LEFT JOIN flight f      ON a.aircraft_id = f.aircraft_id
    LEFT JOIN booking b     ON f.flight_id   = b.flight_id AND UPPER(b.booking_status) = 'CONFIRMED'
    GROUP BY a.aircraft_id, al.airline_name, a.model
    HAVING COALESCE(SUM(m.total_cost), 0) > 0
    ORDER BY CASE WHEN COUNT(b.booking_id) = 0 THEN 2 * COALESCE(SUM(m.total_cost), 0)
                ELSE ROUND(COALESCE(SUM(m.total_cost), 0) / COUNT(b.booking_id), 2) END DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q26_runway_traffic_profile()
RETURNS TABLE (iata_code TEXT, airport_name VARCHAR, takeoff_count BIGINT, landing_count BIGINT, total_runway_uses BIGINT)
LANGUAGE sql STABLE AS $$
    SELECT ap.iata_code, ap.airport_name,
           COUNT(CASE WHEN ur.usage_type = 'Takeoff' THEN 1 END),
           COUNT(CASE WHEN ur.usage_type = 'Landing' THEN 1 END),
           COUNT(ur.runway_id)
    FROM airport ap LEFT JOIN uses_runway ur ON ap.airport_id = ur.airport_id
    GROUP BY ap.airport_id, ap.iata_code, ap.airport_name
    ORDER BY COUNT(ur.runway_id) DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q27_cabin_manager_appraisal()
RETURNS TABLE (crew_id INT, name VARCHAR, experience INT, legs_managed BIGINT, departure_cities TEXT)
LANGUAGE sql STABLE AS $$
    SELECT c.Crew_ID, c.Name, c.Experience,
           COUNT(DISTINCT (ca.Route_ID, ca.Leg_Sequence_No)),
           STRING_AGG(DISTINCT ap.City, ', ' ORDER BY ap.City)
    FROM Crew c
    JOIN Crew_Assign ca ON c.Crew_ID = ca.Crew_ID
    JOIN Route r ON ca.Route_ID = r.Route_ID
    JOIN Airport ap ON r.Source_Airport_ID = ap.Airport_ID
    WHERE c.Role = 'Cabin Manager'
    GROUP BY c.Crew_ID, c.Name, c.Experience
    ORDER BY COUNT(DISTINCT (ca.Route_ID, ca.Leg_Sequence_No)) DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q28_pilot_workload_tiers()
RETURNS TABLE (pilot_id INT, name VARCHAR, experience_level VARCHAR, legs_flown BIGINT, workload TEXT)
LANGUAGE sql STABLE AS $$
    SELECT p.pilot_id, p.name, p.experience_level, COUNT(pa.flight_id),
           CASE WHEN COUNT(pa.flight_id) > 4  THEN 'Heavy'
                WHEN COUNT(pa.flight_id) >= 2 THEN 'Moderate'
                ELSE 'Light' END
    FROM pilot p LEFT JOIN pilot_assign pa ON p.pilot_id = pa.pilot_id
    GROUP BY p.pilot_id, p.name, p.experience_level
    ORDER BY COUNT(pa.flight_id) DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q29_crew_completeness(p_flight_id INT DEFAULT 1001)
RETURNS TABLE (crew_id INT, name VARCHAR, role VARCHAR)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT c.crew_id, c.name, c.role FROM crew c
    WHERE NOT EXISTS (
        (SELECT route_id, leg_sequence_no FROM flight_legs WHERE flight_id = p_flight_id)
        EXCEPT
        (SELECT route_id, leg_sequence_no FROM crew_assign WHERE flight_id = p_flight_id AND crew_id = c.crew_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION rpt_q30_pilot_completeness(p_flight_id INT DEFAULT 1003)
RETURNS TABLE (pilot_id INT, name VARCHAR, experience_level VARCHAR)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT p.pilot_id, p.name, p.experience_level FROM pilot p
    WHERE p.pilot_id NOT IN (
        SELECT pilot_id FROM (
            (SELECT pa2.pilot_id, fl.route_id, fl.leg_sequence_no
             FROM (SELECT DISTINCT pilot_id FROM pilot_assign WHERE flight_id = p_flight_id) pa2
             CROSS JOIN (SELECT route_id, leg_sequence_no FROM flight_legs WHERE flight_id = p_flight_id) fl)
            EXCEPT
            (SELECT pilot_id, route_id, leg_sequence_no FROM pilot_assign WHERE flight_id = p_flight_id)
        ) AS missing
    );
END;
$$;

-- === SCENARIO 4: STRATEGIC ANALYTICS, SUSTAINABILITY & RISK ===

CREATE OR REPLACE FUNCTION rpt_q31_flight_load_factor()
RETURNS TABLE (flight_id INT, model VARCHAR, total_capacity INT, seats_filled BIGINT, load_factor_percentage NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT f.flight_id, ac.model, (ac.tot_eco_seats + ac.tot_bus_seats), COUNT(b.booking_id),
           ROUND((COUNT(b.booking_id)::NUMERIC / (ac.tot_eco_seats + ac.tot_bus_seats)) * 100, 2)
    FROM flight f JOIN aircraft ac ON f.aircraft_id = ac.aircraft_id
    LEFT JOIN booking b ON f.flight_id = b.flight_id AND UPPER(b.booking_status) = 'CONFIRMED'
    GROUP BY f.flight_id, ac.model, ac.tot_eco_seats, ac.tot_bus_seats
    HAVING (COUNT(b.booking_id)::NUMERIC / (ac.tot_eco_seats + ac.tot_bus_seats)) < 0.50
    ORDER BY ROUND((COUNT(b.booking_id)::NUMERIC / (ac.tot_eco_seats + ac.tot_bus_seats)) * 100, 2) ASC;
$$;

CREATE OR REPLACE FUNCTION rpt_q32_frequent_flyer_tiers()
RETURNS TABLE (user_id INT, name VARCHAR, total_km_flown NUMERIC, loyalty_tier TEXT)
LANGUAGE sql STABLE AS $$
    SELECT u.user_id, u.name, SUM(r.distance)::NUMERIC,
           CASE WHEN SUM(r.distance) >= 15000 THEN 'Platinum'
                WHEN SUM(r.distance) >= 10000 THEN 'Gold'
                WHEN SUM(r.distance) >= 5000  THEN 'Silver'
                ELSE 'Bronze' END
    FROM "User" u JOIN booking b ON u.user_id = b.user_id JOIN route r ON b.route_id = r.route_id
    WHERE UPPER(b.booking_status) = 'CONFIRMED'
    GROUP BY u.user_id, u.name
    ORDER BY SUM(r.distance)::NUMERIC DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q33_carbon_footprint()
RETURNS TABLE (airline_name VARCHAR, total_distance_flown NUMERIC, est_co2_metric_tons NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT al.airline_name, SUM(r.distance)::NUMERIC, ROUND(SUM(r.distance * 0.115)::NUMERIC / 1000, 2)
    FROM airline al
    JOIN aircraft    ac ON al.airline_id   = ac.airline_id
    JOIN flight       f ON ac.aircraft_id  = f.aircraft_id
    JOIN flight_legs fl ON f.flight_id     = fl.flight_id
    JOIN route        r ON fl.route_id     = r.route_id
    GROUP BY al.airline_name ORDER BY ROUND(SUM(r.distance * 0.115)::NUMERIC / 1000, 2) DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q34_crew_rest_violations()
RETURNS TABLE (crew_id INT, crew_name VARCHAR, flight_1 INT, landed_at TIMESTAMP, flight_2 INT, departs_at TIMESTAMP, rest_hours NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT * FROM fn_detect_crew_rest_violations();
$$;

CREATE OR REPLACE FUNCTION rpt_q35_peak_hour_congestion()
RETURNS TABLE (iata_code TEXT, departure_hour NUMERIC, departure_count BIGINT)
LANGUAGE sql STABLE AS $$
    SELECT ap.iata_code, EXTRACT(HOUR FROM f.departure_time)::NUMERIC, COUNT(f.flight_id)
    FROM flight f JOIN airport ap ON f.source_airport_id = ap.airport_id
    GROUP BY ap.iata_code, EXTRACT(HOUR FROM f.departure_time)::NUMERIC
    ORDER BY COUNT(f.flight_id) DESC, EXTRACT(HOUR FROM f.departure_time)::NUMERIC ASC;
$$;

CREATE OR REPLACE FUNCTION rpt_q36_revenue_leakage()
RETURNS TABLE (airline_name VARCHAR, cancelled_count BIGINT, potential_revenue_lost_inr NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT al.airline_name, COUNT(b.booking_id),
           SUM(CASE WHEN b.seat_type = 'Business' THEN 8000 ELSE 4500 END)::NUMERIC
    FROM airline al JOIN aircraft ac ON al.airline_id = ac.airline_id
    JOIN flight f ON ac.aircraft_id = f.aircraft_id
    JOIN booking b ON f.flight_id = b.flight_id
    WHERE UPPER(b.booking_status) = 'CANCELLED'
    GROUP BY al.airline_name ORDER BY SUM(CASE WHEN b.seat_type = 'Business' THEN 8000 ELSE 4500 END)::NUMERIC DESC;
$$;

CREATE OR REPLACE FUNCTION rpt_q37_route_difficulty_vs_seniority()
RETURNS TABLE (experience_level VARCHAR, avg_route_distance NUMERIC, total_legs_assigned BIGINT)
LANGUAGE sql STABLE AS $$
    SELECT p.experience_level, AVG(r.distance)::NUMERIC, COUNT(pa.flight_id)
    FROM pilot p
    JOIN pilot_assign pa ON p.pilot_id = pa.pilot_id
    JOIN route        r  ON pa.route_id = r.route_id
    GROUP BY p.experience_level ORDER BY AVG(r.distance)::NUMERIC DESC;
$$;


-- ============================================================
-- SECTION 9: PERFORMANCE INDEXES (Suggestions)
-- ============================================================
-- These substantially reduce query time for joins & lookups
-- used by the report functions and CRUD operations above.
-- ============================================================

-- Flight lookups by aircraft and airport
CREATE INDEX IF NOT EXISTS idx_flight_aircraft  ON flight(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_flight_src_ap    ON flight(source_airport_id);
CREATE INDEX IF NOT EXISTS idx_flight_dest_ap   ON flight(dest_airport_id);
CREATE INDEX IF NOT EXISTS idx_flight_dep_time  ON flight(departure_time);

-- Booking lookups by user and status (critical for analytics)
CREATE INDEX IF NOT EXISTS idx_booking_user_id    ON booking(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_flight_id  ON booking(flight_id);
CREATE INDEX IF NOT EXISTS idx_booking_status     ON booking(booking_status);
CREATE INDEX IF NOT EXISTS idx_booking_route_id   ON booking(route_id);
CREATE INDEX IF NOT EXISTS idx_booking_seat_type  ON booking(seat_type);

-- Flight legs: most queries join on composite PK components
CREATE INDEX IF NOT EXISTS idx_flight_legs_flight ON flight_legs(flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_legs_route  ON flight_legs(route_id);

-- Maintenance lookups by aircraft
CREATE INDEX IF NOT EXISTS idx_maintenance_aircraft ON maintenance(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status   ON maintenance(maintenance_status);

-- Aircraft by airline and status
CREATE INDEX IF NOT EXISTS idx_aircraft_airline ON aircraft(airline_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_status  ON aircraft(status_type);

-- Luggage by booking (frequent cascade deletes & joins)
CREATE INDEX IF NOT EXISTS idx_luggage_booking  ON luggage(booking_id);

-- Pilot / Crew assign by flight
CREATE INDEX IF NOT EXISTS idx_pilot_assign_flight ON pilot_assign(flight_id);
CREATE INDEX IF NOT EXISTS idx_crew_assign_flight  ON crew_assign(flight_id);
CREATE INDEX IF NOT EXISTS idx_pilot_assign_pilot  ON pilot_assign(pilot_id);
CREATE INDEX IF NOT EXISTS idx_crew_assign_crew    ON crew_assign(crew_id);

-- Uses_Runway / Uses_Gate by airport (infrastructure reports)
CREATE INDEX IF NOT EXISTS idx_uses_runway_airport ON uses_runway(airport_id);
CREATE INDEX IF NOT EXISTS idx_uses_gate_airport   ON uses_gate(airport_id);

-- Airport IATA Code (uniqueness + lookup performance)
CREATE UNIQUE INDEX IF NOT EXISTS uix_airport_iata_code ON airport(iata_code);

-- Route source/dest airports (hub airport query)
CREATE INDEX IF NOT EXISTS idx_route_src_ap  ON route(source_airport_id);
CREATE INDEX IF NOT EXISTS idx_route_dest_ap ON route(dest_airport_id);

-- ============================================================
-- END OF db_logic.sql — AeroFlow Unified Database Logic Module
-- ============================================================