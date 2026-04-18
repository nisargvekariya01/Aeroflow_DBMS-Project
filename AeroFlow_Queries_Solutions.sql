-- ============================================================
-- AeroFlow PostgreSQL — QUERIES & SQL SOLUTIONS
-- ============================================================

SET SEARCH_PATH TO AeroFlow;

-- ============================================================
-- AeroFlow: Flight Operations and Passenger Management Database System
-- SQL Query Scenarios & Solutions
-- Real-World Airline Operations Database
-- 4 Scenarios | 42 Queries | PostgreSQL
-- ============================================================

-- ============================================================
-- SCENARIO 1: FLIGHT SCHEDULING & OPERATIONS CENTER
-- ============================================================
-- Real-World Problem:
-- AeroFlow's Operations Control Centre (OCC) handles hundreds of flight
-- departures and arrivals every day. The operations team needs real-time
-- dashboards and reports to: schedule flights efficiently, track delayed
-- legs, identify heavily used airports and runways, visualise complete
-- multi-leg itineraries, and assign pilots correctly to each flight leg.
-- Without structured SQL queries, operations staff would be blind to
-- route bottlenecks, idle gates, and pilot workload distribution —
-- directly impacting on-time performance and safety compliance.
--
-- Scenario Description:
-- This scenario covers the day-to-day operational queries executed by
-- AeroFlow's OCC. It draws on tables such as Flight, Flight_Legs,
-- Route, Airport, Gate, Runway, Uses_Gate, Uses_Runway, and
-- Pilot_Assign to answer scheduling, delay-tracking, and
-- infrastructure-utilisation questions.
-- ============================================================

-- ============================================================
-- Q1. Full Flight Schedule with Source, Destination & Aircraft
-- ============================================================
-- Purpose: The OCC morning briefing lists every flight in
-- departure-time order, showing IATA codes, aircraft model, and airline.

SELECT
    f.Flight_ID,
    a_src.IATA_Code        AS Source,
    a_dst.IATA_Code        AS Destination,
    ac.Model               AS Aircraft_Model,
    al.Airline_Name,
    f.Departure_Time,
    f.Arrival_Time
FROM Flight f
JOIN Airport  a_src ON f.Source_Airport_ID = a_src.Airport_ID
JOIN Airport  a_dst ON f.Dest_Airport_ID   = a_dst.Airport_ID
JOIN Aircraft ac    ON f.Aircraft_ID        = ac.Aircraft_ID
JOIN Airline  al    ON ac.Airline_ID        = al.Airline_ID
ORDER BY f.Departure_Time;


-- ============================================================
-- Q2. Top 3 Most-Used Routes by Booking Volume
-- ============================================================
-- Purpose: Revenue management identifies the busiest routes to
-- increase frequency or upgrade aircraft.

SELECT
    r.Route_ID,
    a_src.Airport_Name AS From_Airport,
    a_dst.Airport_Name AS To_Airport,
    r.Distance,
    r.Estimated_Duration AS Duration_Min,
    COUNT(b.Booking_ID)  AS Booking_Count
FROM Route r
JOIN Airport  a_src ON r.Source_Airport_ID = a_src.Airport_ID
JOIN Airport  a_dst ON r.Dest_Airport_ID   = a_dst.Airport_ID
JOIN Flight_Legs fl ON r.Route_ID          = fl.Route_ID
JOIN Booking  b    ON  b.Flight_ID         = fl.Flight_ID
                   AND b.Route_ID          = fl.Route_ID
                   AND b.Leg_Sequence_No   = fl.Leg_Sequence_No
GROUP BY r.Route_ID, a_src.Airport_Name, a_dst.Airport_Name,
         r.Distance, r.Estimated_Duration
ORDER BY Booking_Count DESC
LIMIT 3;


-- ============================================================
-- Q3. Delayed Flight Legs — Actual vs Estimated Duration
-- ============================================================
-- Purpose: ATC and the OCC flag every leg where the actual airborne
-- time exceeded the planned route duration.

SELECT
    fl.Flight_ID,
    fl.Leg_Sequence_No,
    a_src.IATA_Code            AS Leg_From,
    a_dst.IATA_Code            AS Leg_To,
    r.Estimated_Duration       AS Planned_Min,
    EXTRACT(EPOCH FROM (fl.Landing_Time - fl.Takeoff_Time))/60
                               AS Actual_Min,
    ROUND((EXTRACT(EPOCH FROM (fl.Landing_Time - fl.Takeoff_Time))/60
           - r.Estimated_Duration)::NUMERIC, 1) AS Delay_Min
FROM Flight_Legs fl
JOIN Route   r      ON fl.Route_ID         = r.Route_ID
JOIN Airport a_src  ON r.Source_Airport_ID = a_src.Airport_ID
JOIN Airport a_dst  ON r.Dest_Airport_ID   = a_dst.Airport_ID
WHERE EXTRACT(EPOCH FROM (fl.Landing_Time - fl.Takeoff_Time))/60
      > r.Estimated_Duration
ORDER BY Delay_Min DESC;


-- ============================================================
-- Q4. Airports Used as Both Source and Destination (Hub Airports)
-- ============================================================
-- Purpose: Network planning identifies airports that serve as genuine
-- hubs — used at both ends of routes.

SELECT ap.Airport_ID, ap.IATA_Code, ap.Airport_Name
FROM Airport ap
WHERE ap.Airport_ID IN (
    SELECT Source_Airport_ID FROM Route
    INTERSECT
    SELECT Dest_Airport_ID   FROM Route
)
ORDER BY ap.IATA_Code;


-- ============================================================
-- Q5. Distinct Pilots and Crew per Flight
-- ============================================================
-- Purpose: The OCC verifies that each flight has the minimum required
-- number of pilots and cabin crew across all legs.

SELECT
    f.Flight_ID,
    a_src.IATA_Code  AS Source,
    a_dst.IATA_Code  AS Destination,
    (SELECT COUNT(DISTINCT Pilot_ID)
     FROM Pilot_Assign pa
     WHERE pa.Flight_ID = f.Flight_ID)  AS Distinct_Pilots,
    (SELECT COUNT(DISTINCT Crew_ID)
     FROM Crew_Assign ca
     WHERE ca.Flight_ID = f.Flight_ID)  AS Distinct_Crew
FROM Flight f
JOIN Airport a_src ON f.Source_Airport_ID = a_src.Airport_ID
JOIN Airport a_dst ON f.Dest_Airport_ID   = a_dst.Airport_ID
ORDER BY f.Flight_ID;


-- ============================================================
-- Q6. Routes with Average Booking > 1 Per Leg
-- ============================================================
-- Purpose: Yield management highlights under-utilised routes that
-- consistently fill more than one seat per leg, justifying
-- higher-frequency scheduling.

SELECT
    r.Route_ID,
    a_src.IATA_Code  AS From_IATA,
    a_dst.IATA_Code  AS To_IATA,
    r.Distance,
    rbs.Avg_Bookings_Per_Leg
FROM Route r
JOIN Airport a_src ON r.Source_Airport_ID = a_src.Airport_ID
JOIN Airport a_dst ON r.Dest_Airport_ID   = a_dst.Airport_ID
JOIN (
    SELECT fl.Route_ID,
           AVG(leg_bk.bk_count) AS Avg_Bookings_Per_Leg
    FROM Flight_Legs fl
    LEFT JOIN (
        SELECT Flight_ID, Route_ID, Leg_Sequence_No, COUNT(*) AS bk_count
        FROM Booking
        GROUP BY Flight_ID, Route_ID, Leg_Sequence_No
    ) leg_bk ON fl.Flight_ID       = leg_bk.Flight_ID
            AND fl.Route_ID        = leg_bk.Route_ID
            AND fl.Leg_Sequence_No = leg_bk.Leg_Sequence_No
    GROUP BY fl.Route_ID
    HAVING AVG(COALESCE(leg_bk.bk_count, 0)) > 1
) rbs ON r.Route_ID = rbs.Route_ID
ORDER BY rbs.Avg_Bookings_Per_Leg DESC;


-- ============================================================
-- Q7. Gate Usage — Departures, Arrivals, and Idle Gates
-- ============================================================
-- Purpose: Airport operations flags gates that have had zero usage
-- so ground staff can redeploy resources.

SELECT
    ap.IATA_Code,
    g.Gate_No,
    g.Gate_Status,
    COUNT(CASE WHEN ug.Usage_Type = 'Departure' THEN 1 END) AS Departures,
    COUNT(CASE WHEN ug.Usage_Type = 'Arrival'   THEN 1 END) AS Arrivals,
    CASE WHEN COUNT(ug.Gate_No) = 0 THEN 'Idle' ELSE 'Used' END AS Gate_Usage_Flag
FROM Gate g
JOIN Airport ap ON g.Airport_ID = ap.Airport_ID
LEFT JOIN Uses_Gate ug ON g.Airport_ID = ug.Airport_ID
                      AND g.Gate_No    = ug.Gate_No
GROUP BY ap.IATA_Code, g.Gate_No, g.Gate_Status
ORDER BY ap.IATA_Code, g.Gate_No;


-- ============================================================
-- Q8. Multi-Leg Passenger Itinerary Builder
-- ============================================================
-- Purpose: Customer support and check-in agents need a single-row
-- itinerary per passenger showing the full route path and total
-- luggage weight for multi-stop journeys.

SELECT
    u.Name AS Passenger_Name,
    f.Flight_ID,
    MIN(fl.Takeoff_Time) AS Journey_Start,
    MAX(fl.Landing_Time) AS Journey_End,
    COUNT(b.Booking_ID) AS Legs_Flown,
    SUM(l.Weight) AS Total_Luggage_Weight,
    STRING_AGG(a_src.IATA_Code || '->' || a_dst.IATA_Code,
               ' | ' ORDER BY b.Leg_Sequence_No) AS Route_Path
FROM "User" u
JOIN Booking b ON u.User_ID = b.User_ID
JOIN Flight f ON b.Flight_ID = f.Flight_ID
JOIN Flight_Legs fl ON b.Flight_ID       = fl.Flight_ID
                   AND b.Route_ID        = fl.Route_ID
                   AND b.Leg_Sequence_No = fl.Leg_Sequence_No
JOIN Route r ON fl.Route_ID = r.Route_ID
JOIN Airport a_src ON r.Source_Airport_ID = a_src.Airport_ID
JOIN Airport a_dst ON r.Dest_Airport_ID   = a_dst.Airport_ID
LEFT JOIN Luggage l ON b.Booking_ID = l.Booking_ID
WHERE b.booking_status = 'Confirmed'
GROUP BY u.User_ID, u.Name, f.Flight_ID
HAVING COUNT(b.Booking_ID) > 1
ORDER BY Journey_Start;


-- ============================================================
-- Q9. Airport Infrastructure Bottleneck Analysis (CTE)
-- ============================================================
-- Purpose: Infrastructure planning combines runway and gate operation
-- counts per airport to compute a Total Activity Score, helping
-- identify airports requiring expansion.

WITH RunwayActivity AS (
    SELECT Airport_ID, COUNT(*) AS Total_Runway_Ops
    FROM Uses_Runway
    GROUP BY Airport_ID
),
GateActivity AS (
    SELECT Airport_ID, COUNT(*) AS Total_Gate_Ops
    FROM Uses_Gate
    GROUP BY Airport_ID
)
SELECT
    ap.Airport_ID,
    ap.Airport_Name,
    ap.IATA_Code,
    COALESCE(ra.Total_Runway_Ops, 0) AS Scheduled_Runway_Uses,
    COALESCE(ga.Total_Gate_Ops,   0) AS Scheduled_Gate_Uses,
    (COALESCE(ra.Total_Runway_Ops, 0) +
     COALESCE(ga.Total_Gate_Ops,   0)) AS Total_Activity_Score
FROM Airport ap
LEFT JOIN RunwayActivity ra ON ap.Airport_ID = ra.Airport_ID
LEFT JOIN GateActivity   ga ON ap.Airport_ID = ga.Airport_ID
WHERE (COALESCE(ra.Total_Runway_Ops, 0) +
       COALESCE(ga.Total_Gate_Ops,   0)) > 0
ORDER BY Total_Activity_Score DESC;


-- ============================================================
-- Q10. Pilot Roster per Flight Ordered by Leg Sequence
-- ============================================================
-- Purpose: The OCC prints a pilot roster sheet per flight, showing
-- every pilot and their leg assignment in sequence order.

SELECT
    pa.Flight_ID,
    pa.Leg_Sequence_No,
    p.Name AS Pilot_Name,
    p.Experience_Level,
    p.License_Number
FROM Pilot_Assign pa
JOIN Pilot p ON pa.Pilot_ID = p.Pilot_ID
ORDER BY pa.Flight_ID ASC, pa.Leg_Sequence_No ASC;


-- ============================================================
-- Q11. Human-Readable Flight Route String (CTE + STRING_AGG)
-- ============================================================
-- Purpose: Departure boards and booking confirmations need a clean
-- route string such as 'Ahmedabad -> Mumbai -> Bengaluru' without
-- repeating connecting cities.

WITH LegPaths AS (
    SELECT
        fl.Flight_ID,
        fl.Leg_Sequence_No,
        src.City AS Source_City,
        dst.City AS Dest_City
    FROM Flight_Legs fl
    JOIN Route   r   ON fl.Route_ID = r.Route_ID
    JOIN Airport src ON r.Source_Airport_ID = src.Airport_ID
    JOIN Airport dst ON r.Dest_Airport_ID   = dst.Airport_ID
)
SELECT
    Flight_ID,
    MAX(CASE WHEN Leg_Sequence_No = 1 THEN Source_City ELSE '' END) ||
    STRING_AGG(' -> ' || Dest_City, '' ORDER BY Leg_Sequence_No) AS Flight_Route
FROM LegPaths
GROUP BY Flight_ID
ORDER BY Flight_ID ASC;


-- ============================================================
-- SCENARIO 2: PASSENGER EXPERIENCE & BOOKING ANALYTICS
-- ============================================================
-- Real-World Problem:
-- AeroFlow's Customer Experience team must understand passenger
-- behaviour: who books the most, which routes generate highest revenue,
-- how much luggage passengers carry, and whether passengers are loyal
-- to a single airline. Marketing uses these insights to personalise
-- promotions, loyalty programmes, and cabin-upgrade offers. Without
-- these analytics, the airline risks over-booking some flights while
-- leaving premium cabins half-empty.
--
-- Scenario Description:
-- This scenario queries the Booking, User, Luggage, Flight, Route,
-- Airport, and Airline tables. It demonstrates aggregation, subqueries,
-- division logic (NOT EXISTS / EXCEPT), and set operations to answer
-- passenger-centric business questions.
-- ============================================================

-- ============================================================
-- Q12. Revenue per Route — Confirmed Bookings Only
-- ============================================================
-- Purpose: Finance calculates estimated revenue per route segment by
-- seat class to feed into the quarterly P&L report.

SELECT
    a_src.IATA_Code        AS From_Airport,
    a_dst.IATA_Code        AS To_Airport,
    r.Distance             AS Route_Distance_KM,
    COUNT(b.Booking_ID)    AS Total_Confirmed_Bookings,
    SUM(CASE WHEN b.Seat_Type = 'Business' THEN 8000 ELSE 4500 END)
                           AS Est_Revenue_INR
FROM Booking b
JOIN Flight_Legs fl ON  b.Flight_ID       = fl.Flight_ID
                    AND b.Route_ID        = fl.Route_ID
                    AND b.Leg_Sequence_No = fl.Leg_Sequence_No
JOIN Route   r      ON fl.Route_ID        = r.Route_ID
JOIN Airport a_src  ON r.Source_Airport_ID = a_src.Airport_ID
JOIN Airport a_dst  ON r.Dest_Airport_ID   = a_dst.Airport_ID
WHERE b.booking_status = 'Confirmed'
GROUP BY a_src.IATA_Code, a_dst.IATA_Code, r.Distance
ORDER BY Est_Revenue_INR DESC;


-- ============================================================
-- Q13. Power Passengers — Users Who Book Above Average
-- ============================================================
-- Purpose: The loyalty programme team targets frequent fliers with
-- premium offers — these are users whose booking count exceeds
-- the platform average.

SELECT
    u.User_ID,
    u.Name,
    u.Email,
    ub.Booking_Count
FROM "User" u
JOIN (
    SELECT User_ID, COUNT(*) AS Booking_Count
    FROM Booking
    GROUP BY User_ID
) AS ub ON u.User_ID = ub.User_ID
JOIN (
    SELECT AVG(cnt) AS Avg_Bookings
    FROM (SELECT COUNT(*) AS cnt FROM Booking GROUP BY User_ID) AS t
) AS av ON ub.Booking_Count > av.Avg_Bookings
ORDER BY ub.Booking_Count DESC;


-- ============================================================
-- Q14. Total Bookings and Unique Passengers per Aircraft
-- ============================================================
-- Purpose: Fleet utilisation reports show which aircraft carry the
-- most passengers, informing decisions about aircraft allocation.

SELECT
    al.Airline_Name,
    ac.Model,
    ac.Aircraft_ID,
    COUNT(b.Booking_ID)          AS Total_Bookings,
    COUNT(DISTINCT b.User_ID)    AS Unique_Passengers
FROM Aircraft ac
JOIN Airline     al ON ac.Airline_ID  = al.Airline_ID
JOIN Flight       f ON ac.Aircraft_ID = f.Aircraft_ID
JOIN Flight_Legs fl ON  f.Flight_ID   = fl.Flight_ID
JOIN Booking      b ON  b.Flight_ID       = fl.Flight_ID
                    AND b.Route_ID        = fl.Route_ID
                    AND b.Leg_Sequence_No = fl.Leg_Sequence_No
GROUP BY al.Airline_Name, ac.Model, ac.Aircraft_ID
ORDER BY Total_Bookings DESC;


-- ============================================================
-- Q15. Heavy-Luggage Flights — Total Luggage Weight Exceeds 200 kg
-- ============================================================
-- Purpose: Ground handling allocates extra cargo loaders to flights
-- whose total checked-in luggage exceeds 200 kg.

SELECT
    f.Flight_ID,
    a_src.IATA_Code  AS Source,
    a_dst.IATA_Code  AS Destination,
    ROUND(SUM(l.Weight)::NUMERIC, 2) AS Total_Luggage_KG
FROM Flight f
JOIN Airport a_src ON f.Source_Airport_ID = a_src.Airport_ID
JOIN Airport a_dst ON f.Dest_Airport_ID   = a_dst.Airport_ID
JOIN Flight_Legs fl ON f.Flight_ID        = fl.Flight_ID
JOIN Booking b     ON  b.Flight_ID        = fl.Flight_ID
                   AND b.Route_ID         = fl.Route_ID
                   AND b.Leg_Sequence_No  = fl.Leg_Sequence_No
JOIN Luggage l     ON b.Booking_ID        = l.Booking_ID
GROUP BY f.Flight_ID, a_src.IATA_Code, a_dst.IATA_Code
HAVING SUM(l.Weight) > 200
ORDER BY Total_Luggage_KG DESC;


-- ============================================================
-- Q16. Passengers Holding Both Economy and Business Bookings
-- ============================================================
-- Purpose: Upgrade campaign identifies passengers who have experienced
-- both cabins and are prime candidates for a premium membership offer.

SELECT u.User_ID, u.Name, u.Email
FROM "User" u
WHERE EXISTS (
    SELECT 1 FROM Booking b1
    WHERE b1.User_ID = u.User_ID AND b1.Seat_Type = 'Economy'
)
AND EXISTS (
    SELECT 1 FROM Booking b2
    WHERE b2.User_ID = u.User_ID AND b2.Seat_Type = 'Business'
);


-- ============================================================
-- Q17. Loyal Passengers — Never Cancelled a Booking
-- ============================================================
-- Purpose: Retention marketing rewards reliability; this list finds
-- users who have never cancelled a booking.

SELECT u.User_ID, u.Name, u.Email
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1 FROM Booking b
    WHERE b.User_ID = u.User_ID
      AND b.booking_status = 'Cancelled'
)
AND EXISTS (
    SELECT 1 FROM Booking b2 WHERE b2.User_ID = u.User_ID
);


-- ============================================================
-- Q18. IndiGo-Only Passengers (Division — NOT EXISTS + EXCEPT)
-- ============================================================
-- Purpose: Partnership analysis finds users whose entire booking
-- history is exclusively on IndiGo — useful for co-branding
-- loyalty deals.

SELECT u.User_ID, u.Name
FROM "User" u
WHERE NOT EXISTS (
    (SELECT DISTINCT f.Flight_ID
     FROM Booking b
     JOIN Flight_Legs fl ON b.Flight_ID = fl.Flight_ID
                        AND b.Route_ID  = fl.Route_ID
     JOIN Flight f ON fl.Flight_ID = f.Flight_ID
     WHERE b.User_ID = u.User_ID)
    EXCEPT
    (SELECT f2.Flight_ID
     FROM Flight f2
     JOIN Aircraft ac ON f2.Aircraft_ID = ac.Aircraft_ID
     JOIN Airline  al ON ac.Airline_ID  = al.Airline_ID
     WHERE al.Airline_Name = 'IndiGo')
)
AND EXISTS (SELECT 1 FROM Booking b2 WHERE b2.User_ID = u.User_ID);


-- ============================================================
-- Q19. 2nd and 3rd Highest Luggage Weight Bookings (OFFSET + LIMIT)
-- ============================================================
-- Purpose: Baggage screening picks the 2nd and 3rd heaviest overall
-- booking-level luggage loads for manual inspection queuing.

SELECT
    b.Booking_ID,
    u.Name          AS Passenger,
    ROUND(SUM(l.Weight)::NUMERIC, 2) AS Total_Luggage_KG
FROM Booking b
JOIN "User"  u ON b.User_ID    = u.User_ID
JOIN Luggage l ON b.Booking_ID = l.Booking_ID
GROUP BY b.Booking_ID, u.Name
ORDER BY Total_Luggage_KG DESC
OFFSET 1 LIMIT 2;


-- ============================================================
-- Q20. Users Who Have Booked All Routes That User 401 Has Booked
-- ============================================================
-- Purpose: Travel buddy matching — finds passengers with the same
-- complete route footprint as a reference user (User 401).

SELECT u.User_ID, u.Name, u.Email
FROM "User" u
WHERE u.User_ID <> 401
  AND NOT EXISTS (
      (SELECT DISTINCT Route_ID FROM Booking WHERE User_ID = 401)
      EXCEPT
      (SELECT DISTINCT Route_ID FROM Booking WHERE User_ID = u.User_ID)
  )
  AND EXISTS (SELECT 1 FROM Booking WHERE User_ID = u.User_ID);


-- ============================================================
-- SCENARIO 3: FLEET HEALTH, INFRASTRUCTURE & CREW OPERATIONS
-- ============================================================
-- Real-World Problem:
-- AeroFlow’s operational integrity depends on the seamless coordination
-- of its "physical backbone"—the aircraft, the ground assets, and the
-- personnel. Engineering must keep the fleet airworthy and financially
-- efficient; Airport Managers must optimize runway and gate usage to
-- avoid costly bottlenecks; and Crew Operations must distribute pilots
-- and cabin staff while adhering to strict safety and duty-hour
-- regulations. A breakdown in any of these areas—be it an overdue
-- maintenance check, an idle gate, or an incomplete crew assignment—
-- directly compromises the airline's safety standards and its
-- bottom-line performance.
--
-- Scenario Description:
-- This integrated scenario draws on tables including Aircraft, Airline,
-- Maintenance, Airport, Runway, Gate, Uses_Runway, Crew, Crew_Assign,
-- and Pilot_Assign. It demonstrates advanced SQL techniques such as
-- complex GROUP BY aggregations with HAVING clauses, conditional CASE
-- logic for workload and asset audits, Relational Division (via
-- NOT EXISTS and EXCEPT) for completeness checks, and the use of
-- ALL/ANY subqueries and COALESCE to handle fleet-wide health
-- and financial analytics.
-- ============================================================

-- ============================================================
-- Q21. Fleet Summary per Airline — Aircraft Count & Flight Hours
-- ============================================================
-- Purpose: The Engineering Director's monthly dashboard shows aircraft
-- count, average/max/min total flight hours per airline — but only
-- for airlines operating more than one aircraft.

SELECT
    al.Airline_Name,
    COUNT(ac.Aircraft_ID)        AS Total_Aircraft,
    AVG(ac.Total_Flight_Hours)   AS Avg_Flight_Hours,
    MAX(ac.Total_Flight_Hours)   AS Max_Flight_Hours,
    MIN(ac.Total_Flight_Hours)   AS Min_Flight_Hours
FROM Airline al
JOIN Aircraft ac ON al.Airline_ID = ac.Airline_ID
GROUP BY al.Airline_Name
HAVING COUNT(ac.Aircraft_ID) > 1
ORDER BY Total_Aircraft DESC;


-- ============================================================
-- Q22. Maintenance Cost Statistics per Airline (HAVING > 50,000)
-- ============================================================
-- Purpose: Finance flags airlines whose cumulative maintenance spend
-- exceeds INR 50,000, alongside per-event averages and the single
-- costliest job.

SELECT
    al.Airline_Name,
    COUNT(m.Maintenance_ID)               AS Maintenance_Count,
    ROUND(SUM(m.Total_Cost)::NUMERIC, 2)  AS Total_Cost,
    ROUND(AVG(m.Total_Cost)::NUMERIC, 2)  AS Avg_Cost_Per_Event,
    MAX(m.Total_Cost)                     AS Costliest_Job
FROM Airline al
JOIN Aircraft ac  ON al.Airline_ID   = ac.Airline_ID
JOIN Maintenance m ON ac.Aircraft_ID = m.Aircraft_ID
GROUP BY al.Airline_Name
HAVING SUM(m.Total_Cost) > 50000
ORDER BY Total_Cost DESC;


-- ============================================================
-- Q23. Aircraft with More Flight Hours than ALL GoFirst Aircraft
-- ============================================================
-- Purpose: Safety auditors look for aircraft that have accumulated
-- more flight hours than every aircraft in the GoFirst fleet —
-- a proxy for aggressive utilisation.

SELECT
    ac.Aircraft_ID,
    ac.Model,
    al.Airline_Name,
    ac.Total_Flight_Hours
FROM Aircraft ac
JOIN Airline al ON ac.Airline_ID = al.Airline_ID
WHERE ac.Total_Flight_Hours > ALL (
    SELECT Total_Flight_Hours
    FROM Aircraft
    WHERE Airline_ID = 5
)
ORDER BY ac.Total_Flight_Hours DESC;


-- ============================================================
-- Q24. Active Aircraft that Have Completed Maintenance
--      (Returned to Service)
-- ============================================================
-- Purpose: Post-maintenance inspection confirms which aircraft are
-- marked Active and have at least one Completed maintenance record —
-- proving they passed their return-to-service check.

SELECT
    ac.Aircraft_ID,
    ac.Model,
    ac.Status_Type,
    al.Airline_Name,
    m.Maintenance_Type,
    m.Completion_Date
FROM Aircraft ac
JOIN Airline     al ON ac.Airline_ID  = al.Airline_ID
JOIN Maintenance m  ON ac.Aircraft_ID = m.Aircraft_ID
WHERE ac.Status_Type     = 'Active'
  AND m.Maintenance_Status = 'Completed'
ORDER BY m.Completion_Date DESC;


-- ============================================================
-- Q25. Aircraft Financial Efficiency — Maintenance Cost per Booking
-- ============================================================
-- Purpose: The CFO wants a Maintenance Cost Per Passenger metric.
-- Aircraft with a high ratio (high maintenance cost, few bookings)
-- are candidates for early retirement.

SELECT
    a.Aircraft_ID,
    al.Airline_Name,
    a.Model,
    COALESCE(SUM(m.Total_Cost), 0)  AS Total_Maintenance_Cost,
    COUNT(b.Booking_ID)             AS Total_Confirmed_Bookings,
    CASE
        WHEN COUNT(b.Booking_ID) = 0 THEN 0
        ELSE ROUND(COALESCE(SUM(m.Total_Cost), 0) / COUNT(b.Booking_ID), 2)
    END AS Maintenance_Cost_Per_Booking
FROM Aircraft a
JOIN Airline al ON a.Airline_ID = al.Airline_ID
LEFT JOIN Maintenance m ON a.Aircraft_ID = m.Aircraft_ID
LEFT JOIN Flight f ON a.Aircraft_ID = f.Aircraft_ID
LEFT JOIN Booking b ON f.Flight_ID = b.Flight_ID
    AND b.booking_status = 'Confirmed'
GROUP BY a.Aircraft_ID, al.Airline_Name, a.Model
HAVING COALESCE(SUM(m.Total_Cost), 0) > 0
ORDER BY Maintenance_Cost_Per_Booking DESC;


-- ============================================================
-- Q26. Runway Usage — Takeoffs vs Landings per Airport
-- ============================================================
-- Purpose: Air traffic control needs to know how many takeoffs and
-- landings each airport's runways are handling, to spot imbalances
-- early.

SELECT
    ap.IATA_Code,
    ap.Airport_Name,
    COUNT(CASE WHEN ur.Usage_Type = 'Takeoff'  THEN 1 END) AS Takeoff_Count,
    COUNT(CASE WHEN ur.Usage_Type = 'Landing'  THEN 1 END) AS Landing_Count,
    COUNT(ur.Runway_ID)                                     AS Total_Runway_Uses
FROM Airport ap
LEFT JOIN Uses_Runway ur ON ap.Airport_ID = ur.Airport_ID
GROUP BY ap.Airport_ID, ap.IATA_Code, ap.Airport_Name
ORDER BY Total_Runway_Uses DESC;


-- ============================================================
-- Q27. Cabin Manager Performance — Flights Managed & Departure Cities
-- ============================================================
-- Purpose: HR produces annual appraisal data for every Cabin Manager:
-- how many distinct flights they led and which cities they operated
-- from.

SELECT
    c.Crew_ID,
    c.Name,
    c.Experience,
    COUNT(DISTINCT (ca.Route_ID, ca.Leg_Sequence_No)) AS Legs_Managed,
    STRING_AGG(DISTINCT ap.City, ', ' ORDER BY ap.City) AS Departure_Cities
FROM Crew c
JOIN Crew_Assign ca ON c.Crew_ID = ca.Crew_ID
JOIN Route r ON ca.Route_ID = r.Route_ID
JOIN Airport ap ON r.Source_Airport_ID = ap.Airport_ID
WHERE c.Role = 'Cabin Manager'
GROUP BY c.Crew_ID, c.Name, c.Experience
ORDER BY Legs_Managed DESC;


-- ============================================================
-- Q28. Pilot Leg Workload — Heavy / Moderate / Light
-- ============================================================
-- Purpose: Crew scheduling enforces DGCA duty-hour rules by
-- classifying each pilot's workload tier based on total legs flown.

SELECT
    p.Pilot_ID,
    p.Name,
    p.Experience_Level,
    COUNT(pa.Flight_ID)  AS Legs_Flown,
    CASE
        WHEN COUNT(pa.Flight_ID) > 4 THEN 'Heavy'
        WHEN COUNT(pa.Flight_ID) >= 2 THEN 'Moderate'
        ELSE 'Light'
    END AS Workload
FROM Pilot p
LEFT JOIN Pilot_Assign pa ON p.Pilot_ID = pa.Pilot_ID
GROUP BY p.Pilot_ID, p.Name, p.Experience_Level
ORDER BY Legs_Flown DESC;


-- ============================================================
-- Q29. Crew Members on ALL Legs of Flight 1001 (Completeness Check)
-- ============================================================
-- Purpose: Safety audit verifies that every crew member on flight
-- 1001 actually flew every scheduled leg — not just a subset.

SELECT c.Crew_ID, c.Name, c.Role
FROM Crew c
WHERE NOT EXISTS (
    (SELECT Route_ID, Leg_Sequence_No
     FROM Flight_Legs WHERE Flight_ID = 1001)
    EXCEPT
    (SELECT Route_ID, Leg_Sequence_No
     FROM Crew_Assign
     WHERE Flight_ID = 1001 AND Crew_ID = c.Crew_ID)
);


-- ============================================================
-- Q30. Pilots on ALL Legs of Flight 1003
--      (Division — NOT IN + EXCEPT)
-- ============================================================
-- Purpose: Flight command accountability requires confirming which
-- pilots were present on every leg of flight 1003.

SELECT p.Pilot_ID, p.Name, p.Experience_Level
FROM Pilot p
WHERE p.Pilot_ID NOT IN (
    SELECT p.Pilot_ID FROM (
        (SELECT pa2.Pilot_ID, fl.Route_ID, fl.Leg_Sequence_No
         FROM (SELECT DISTINCT Pilot_ID FROM Pilot_Assign WHERE Flight_ID = 1003) pa2
         CROSS JOIN
         (SELECT Route_ID, Leg_Sequence_No FROM Flight_Legs WHERE Flight_ID = 1003) fl)
        EXCEPT
        (SELECT Pilot_ID, Route_ID, Leg_Sequence_No
         FROM Pilot_Assign WHERE Flight_ID = 1003)
    ) AS missing
);

-- ============================================================
-- SCENARIO 4: STRATEGIC ANALYTICS, SUSTAINABILITY & RISK MANAGEMENT
-- ============================================================
-- Real-World Problem:
-- AeroFlow’s leadership must pivot from daily logs to long-term survival 
-- and efficiency. This requires identifying underperforming "ghost flights,"
-- rewarding high-value "Elite" passengers, and managing environmental compliance
-- through carbon tracking. Simultaneously, the airline must mitigate high-stakes
-- operational risks, such as gate scheduling conflicts, pilot fatigue that violates
-- safety regulations, and maintenance "clusters" that threaten to ground entire 
-- sections of the fleet.
--
-- Scenario Description:
-- This scenario serves as the executive intelligence layer of AeroFlow, utilizing 
-- the entire relational schema with a heavy focus on the Flight, Aircraft, 
-- Maintenance, Route, Booking, and assignment tables. Its technical implementations
-- involve advanced data aggregation to calculate critical metrics like load factors
-- and profitability indices through complex multi-table joins. Additionally, the 
-- scenario incorporates rigorous safety and compliance logic by utilizing interval 
-- math to detect crew rest-period violations and potential gate overlaps. 
-- Beyond operations, it addresses modern environmental standards via sustainability
-- modeling, applying mathematical constants within SQL to estimate CO2 emissions.
-- ============================================================

-- ============================================================
-- Q31. Flight Load Factor (Occupancy Rate)
-- ============================================================
-- Purpose: Finance identifies flights with low occupancy. This calculates the 
-- percentage of seats filled relative to the aircraft's total capacity

SELECT 
    f.Flight_ID,
    ac.Model,
    (ac.Tot_Eco_Seats + ac.Tot_Bus_Seats) AS Total_Capacity,
    COUNT(b.Booking_ID) AS Seats_Filled,
    ROUND((COUNT(b.Booking_ID)::NUMERIC / (ac.Tot_Eco_Seats + ac.Tot_Bus_Seats)) * 100, 2) AS Load_Factor_Percentage
FROM Flight f
JOIN Aircraft ac ON f.Aircraft_ID = ac.Aircraft_ID
LEFT JOIN Booking b ON f.Flight_ID = b.Flight_ID 
    AND b.booking_status = 'Confirmed'
GROUP BY f.Flight_ID, ac.Model, ac.Tot_Eco_Seats, ac.Tot_Bus_Seats
HAVING (COUNT(b.Booking_ID)::NUMERIC / (ac.Tot_Eco_Seats + ac.Tot_Bus_Seats)) < 0.50
ORDER BY Load_Factor_Percentage ASC;


-- ============================================================
-- Q32. Frequent Flyer Tier Eligibility (Cumulative Distance)
-- ============================================================
-- Purpose: Marketing identifies passengers based on total distance 
-- flown across all confirmed bookings to assign loyalty tiers.

SELECT 
    u.User_ID,
    u.Name,
    SUM(r.Distance) AS Total_KM_Flown,
    CASE 
        WHEN SUM(r.Distance) >= 15000 THEN 'Platinum'
        WHEN SUM(r.Distance) >= 10000 THEN 'Gold'
        WHEN SUM(r.Distance) >= 5000  THEN 'Silver'
        ELSE 'Bronze'
    END AS Loyalty_Tier
FROM "User" u
JOIN Booking b ON u.User_ID = b.User_ID
JOIN Route r ON b.Route_ID = r.Route_ID
WHERE b.booking_status = 'Confirmed'
GROUP BY u.User_ID, u.Name
ORDER BY Total_KM_Flown DESC;

-- ============================================================
-- Q33. Estimated Carbon Footprint per Airline
-- ============================================================
-- Purpose:  Calculates CO_2 emissions for environmental reporting 
-- based on a standard of 0.115kg of CO_2 per KM.

SELECT 
    al.Airline_Name,
    SUM(r.Distance) AS Total_Distance_Flown,
    ROUND(SUM(r.Distance * 0.115)::NUMERIC / 1000, 2) AS Est_CO2_Metric_Tons
FROM Airline al
JOIN Aircraft ac ON al.Airline_ID = ac.Airline_ID
JOIN Flight f ON ac.Aircraft_ID = f.Aircraft_ID
JOIN Flight_Legs fl ON f.Flight_ID = fl.Flight_ID
JOIN Route r ON fl.Route_ID = r.Route_ID
GROUP BY al.Airline_Name
ORDER BY Est_CO2_Metric_Tons DESC;

-- ============================================================
-- Q34. Crew Fatigue & Rest Period Compliance
-- ============================================================
-- Purpose:  Flags instances where a crew member is assigned to a flight
-- that departs less than 10 hours after their previous flight landed.

SELECT 
    ca1.Crew_ID,
    c.Name AS Crew_Name,
    ca1.Flight_ID AS Flight_1,
    f1.Arrival_Time AS Landed_At,
    ca2.Flight_ID AS Flight_2,
    f2.Departure_Time AS Departs_At,
    EXTRACT(EPOCH FROM (f2.Departure_Time - f1.Arrival_Time))/3600 AS Rest_Hours
FROM Crew_Assign ca1
JOIN Crew_Assign ca2 ON ca1.Crew_ID = ca2.Crew_ID
JOIN Flight f1 ON ca1.Flight_ID = f1.Flight_ID
JOIN Flight f2 ON ca2.Flight_ID = f2.Flight_ID
JOIN Crew c ON ca1.Crew_ID = c.Crew_ID
WHERE f2.Departure_Time > f1.Arrival_Time
  AND EXTRACT(EPOCH FROM (f2.Departure_Time - f1.Arrival_Time))/3600 < 10
ORDER BY Rest_Hours ASC;

-- ============================================================
-- Q35. Peak Hour Airport Congestion Profile
-- ============================================================
-- Purpose:  Identifies the busiest departure hour for specific
-- airports to optimize security and staffing.

SELECT 
    ap.IATA_Code,
    EXTRACT(HOUR FROM f.Departure_Time) AS Departure_Hour,
    COUNT(f.Flight_ID) AS Departure_Count
FROM Flight f
JOIN Airport ap ON f.Source_Airport_ID = ap.Airport_ID
GROUP BY ap.IATA_Code, Departure_Hour
ORDER BY Departure_Count DESC, Departure_Hour ASC;

-- ============================================================
-- Q36. Revenue Leakage from Cancellations
-- ============================================================
-- Purpose:  Calculates potential revenue lost to "Cancelled" 
-- status bookings to analyze financial impact.

SELECT 
    al.Airline_Name,
    COUNT(b.Booking_ID) AS Cancelled_Count,
    SUM(CASE WHEN b.Seat_Type = 'Business' THEN 8000 ELSE 4500 END) AS Potential_Revenue_Lost_INR
FROM Airline al
JOIN Aircraft ac ON al.Airline_ID = ac.Airline_ID
JOIN Flight f ON ac.Aircraft_ID = f.Aircraft_ID
JOIN Booking b ON f.Flight_ID = b.Flight_ID
WHERE b.booking_status = 'Cancelled'
GROUP BY al.Airline_Name
ORDER BY Potential_Revenue_Lost_INR DESC;

-- ============================================================
-- Q37. Seniority vs. Route Difficulty Audit
-- ============================================================
-- Purpose:  Verify that "Long-Haul" or high-distance routes are being handled by 
-- senior pilots. This identifies if junior pilots are being overworked on 
-- physically demanding routes, a key factor in safety audits.

SELECT 
    p.Experience_Level,
    AVG(r.Distance) AS Avg_Route_Distance,
    COUNT(pa.Flight_ID) AS Total_Legs_Assigned
FROM Pilot p
JOIN Pilot_Assign pa ON p.Pilot_ID = pa.Pilot_ID
JOIN Route r ON pa.Route_ID = r.Route_ID
GROUP BY p.Experience_Level
ORDER BY Avg_Route_Distance DESC;

-- ============================================================
-- END OF QUERIES
-- ============================================================
