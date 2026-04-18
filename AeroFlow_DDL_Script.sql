<<<<<<< HEAD
-- ============================================================
-- PostgreSQL DDL Script — AeroFlow
-- ============================================================

CREATE SCHEMA AeroFlow;
SET SEARCH_PATH TO AeroFlow;

-- ------------------------------------------------------------
-- 1. AIRLINE
-- ------------------------------------------------------------
CREATE TABLE Airline (
    Airline_ID              INT             PRIMARY KEY,
    Airline_Name            VARCHAR(100)    NOT NULL,
    Country                 VARCHAR(50)     NOT NULL,
    Headquarters            VARCHAR(100)    NOT NULL,
    Email                   VARCHAR(20)     NOT NULL,
    IATA_Designator_Codes   VARCHAR(10)     NOT NULL
);

-- ------------------------------------------------------------
-- 2. AIRCRAFT
-- ------------------------------------------------------------
CREATE TABLE Aircraft (
    Aircraft_ID             INT             PRIMARY KEY,
    Airline_ID              INT             NOT NULL,
    Model                   VARCHAR(50)     NOT NULL,
    Manufacture_Date        DATE            NOT NULL,
    Total_Flight_Hours      INT             NOT NULL,
    Total_Flight_Cycle      INT             NOT NULL,
    Tot_Eco_Seats           INT             NOT NULL,
    Tot_Bus_Seats           INT             NOT NULL,
    Total_Fuel_Capacity     DECIMAL(10,2)   NOT NULL,
    Current_Fuel_Level      DECIMAL(10,2)   NOT NULL,
    Location                VARCHAR(100)    NOT NULL,
    Status_Type             VARCHAR(20)     NOT NULL,
    Current_Speed           DECIMAL(10,2),
    Autopilot_Status        VARCHAR(30),
    Cabin_Pressure_PSI      DECIMAL(5,2),
    Outside_Air_Temperature DECIMAL(5,2),
    Altitude                DECIMAL(9,3),
    Is_In_Aviation          BOOLEAN,

    FOREIGN KEY (Airline_ID) REFERENCES Airline(Airline_ID)
);

-- ------------------------------------------------------------
-- 3. MAINTENANCE
-- ------------------------------------------------------------
CREATE TABLE Maintenance (
    Maintenance_ID      INT             PRIMARY KEY,
    Aircraft_ID         INT             NOT NULL,
    Maintenance_Type    VARCHAR(50)     NOT NULL,
    Technician_Notes    TEXT,
    Maintenance_Status  VARCHAR(30)     NOT NULL,
    Scheduled_Date      DATE            NOT NULL,
    Actual_Start_Date   DATE,
    Completion_Date     DATE,
    Total_Cost          DECIMAL(10,2),

    FOREIGN KEY (Aircraft_ID) REFERENCES Aircraft(Aircraft_ID)
);

-- ------------------------------------------------------------
-- 4. AIRPORT
-- ------------------------------------------------------------
CREATE TABLE Airport (
    Airport_ID      INT             PRIMARY KEY,
    Airport_Name    VARCHAR(100)    NOT NULL,
    City            VARCHAR(50)     NOT NULL,
    State           VARCHAR(50)     NOT NULL,
    Country         VARCHAR(50)     NOT NULL,
    IATA_Code       VARCHAR(10)     NOT NULL
);

-- ------------------------------------------------------------
-- 5. RUNWAY
-- ------------------------------------------------------------
CREATE TABLE Runway (
    Airport_ID      INT             NOT NULL,
    Runway_ID       INT             NOT NULL,
    Surface_Type    VARCHAR(30)     NOT NULL,
    Runway_Length   DECIMAL(10,2)   NOT NULL,
    Status          VARCHAR(20)     NOT NULL,

    PRIMARY KEY (Airport_ID, Runway_ID),
    FOREIGN KEY (Airport_ID) REFERENCES Airport(Airport_ID)
);

-- ------------------------------------------------------------
-- 6. GATE
-- ------------------------------------------------------------
CREATE TABLE Gate (
    Airport_ID      INT             NOT NULL,
    Gate_No         INT             NOT NULL,
    Gate_Status     VARCHAR(20)     NOT NULL,

    PRIMARY KEY (Airport_ID, Gate_No),
    FOREIGN KEY (Airport_ID) REFERENCES Airport(Airport_ID)
);

-- ------------------------------------------------------------
-- 7. ROUTE
-- ------------------------------------------------------------
CREATE TABLE Route (
    Route_ID            INT             PRIMARY KEY,
    Distance            DECIMAL(10,2)   NOT NULL,
    Estimated_Duration  INT     	NOT NULL,
    Source_Airport_ID   INT     	NOT NULL,
    Dest_Airport_ID     INT     	NOT NULL,

    FOREIGN KEY (Source_Airport_ID) REFERENCES Airport(Airport_ID),
    FOREIGN KEY (Dest_Airport_ID)   REFERENCES Airport(Airport_ID)
);

-- ------------------------------------------------------------
-- 8. FLIGHT
-- ------------------------------------------------------------
CREATE TABLE Flight (
    Flight_ID           INT             PRIMARY KEY,
    Aircraft_ID         INT             NOT NULL,
    Departure_Time      TIMESTAMP       NOT NULL,
    Arrival_Time        TIMESTAMP       NOT NULL,
    Source_Airport_ID   INT     	NOT NULL,
    Dest_Airport_ID     INT     	NOT NULL,

    FOREIGN KEY (Aircraft_ID)       REFERENCES Aircraft(Aircraft_ID),
    FOREIGN KEY (Source_Airport_ID) REFERENCES Airport(Airport_ID),
    FOREIGN KEY (Dest_Airport_ID)   REFERENCES Airport(Airport_ID)
);

-- ------------------------------------------------------------
-- 9. FLIGHT_LEGS
-- ------------------------------------------------------------
CREATE TABLE Flight_Legs (
    Flight_ID       INT           NOT NULL,
    Route_ID        INT           NOT NULL,
    Leg_Sequence_No INT           NOT NULL,
    Takeoff_Time    TIMESTAMP     NOT NULL,
    Landing_Time    TIMESTAMP     NOT NULL,
    Leg_Status      VARCHAR(30)   NOT NULL,

    PRIMARY KEY (Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (Flight_ID) REFERENCES Flight(Flight_ID),
    FOREIGN KEY (Route_ID)  REFERENCES Route(Route_ID)
);

-- ------------------------------------------------------------
-- 10. PILOT
-- ------------------------------------------------------------
CREATE TABLE Pilot (
    Pilot_ID            INT             PRIMARY KEY,
    Name                VARCHAR(100)    NOT NULL,
    License_Number      VARCHAR(50)     NOT NULL,
    Email               VARCHAR(100)    NOT NULL,
    Experience_Level    VARCHAR(30)     NOT NULL
);

-- ------------------------------------------------------------
-- 11. CREW
-- ------------------------------------------------------------
CREATE TABLE Crew (
    Crew_ID                 INT             PRIMARY KEY,
    Name                    VARCHAR(100)    NOT NULL,
    Role                    VARCHAR(50)     NOT NULL,
    Experience              INT     	    NOT NULL,
    Language_Proficiency    VARCHAR(100)    NOT NULL
);

-- ------------------------------------------------------------
-- 12. USER
-- ------------------------------------------------------------
CREATE TABLE "User" (
    User_ID     INT             PRIMARY KEY,
    Name        VARCHAR(100)    NOT NULL,
    Email       VARCHAR(100)    NOT NULL,
    Phone       VARCHAR(20)     NOT NULL,
    Address     VARCHAR(200)    NOT NULL
);

-- ------------------------------------------------------------
-- 13. BOOKING
-- ------------------------------------------------------------
CREATE TABLE Booking (
    Booking_ID          INT             PRIMARY KEY,
    Flight_ID           INT             NOT NULL,
    Route_ID            INT             NOT NULL,
    Leg_Sequence_No     INT             NOT NULL,
    User_ID             INT             NOT NULL,
    Seat_Type           VARCHAR(20)     NOT NULL,
    Seat_Number         VARCHAR(10)     NOT NULL,
    Booking_Date        DATE     	NOT NULL,
    Booking_Status       VARCHAR(30)     NOT NULL,
    Booking_Sequence_No INT     	NOT NULL,

    FOREIGN KEY (Flight_ID, Route_ID, Leg_Sequence_No)
    	REFERENCES Flight_Legs(Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (User_ID) REFERENCES "User"(User_ID)
);

-- ------------------------------------------------------------
-- 14. LUGGAGE
-- ------------------------------------------------------------
CREATE TABLE Luggage (
    Luggage_ID  INT             PRIMARY KEY,
    Booking_ID  INT             NOT NULL,
    Tag_Number  VARCHAR(50)     NOT NULL,
    Weight      DECIMAL(6,2)    NOT NULL,

    FOREIGN KEY (Booking_ID) REFERENCES Booking(Booking_ID)
);

-- ------------------------------------------------------------
-- 15. PILOT_ASSIGN
-- ------------------------------------------------------------
CREATE TABLE Pilot_Assign (
    Flight_ID       INT   NOT NULL,
    Route_ID        INT   NOT NULL,
    Leg_Sequence_No INT   NOT NULL,
    Pilot_ID        INT   NOT NULL,

    PRIMARY KEY (Flight_ID, Route_ID, Leg_Sequence_No, Pilot_ID),
    FOREIGN KEY (Flight_ID, Route_ID, Leg_Sequence_No)
    	REFERENCES Flight_Legs(Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (Pilot_ID) REFERENCES Pilot(Pilot_ID)
);

-- ------------------------------------------------------------
-- 16. CREW_ASSIGN
-- ------------------------------------------------------------
CREATE TABLE Crew_Assign (
    Flight_ID       INT   NOT NULL,
    Route_ID        INT   NOT NULL,
    Leg_Sequence_No INT   NOT NULL,
    Crew_ID         INT   NOT NULL,

    PRIMARY KEY (Flight_ID, Route_ID, Leg_Sequence_No, Crew_ID),
    FOREIGN KEY (Flight_ID, Route_ID, Leg_Sequence_No)
    	REFERENCES Flight_Legs(Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (Crew_ID) REFERENCES Crew(Crew_ID)
);

-- ------------------------------------------------------------
-- 17. USES_RUNWAY
-- ------------------------------------------------------------
CREATE TABLE Uses_Runway (
    Flight_ID       INT             NOT NULL,
    Route_ID        INT             NOT NULL,
    Leg_Sequence_No INT             NOT NULL,
    Airport_ID      INT             NOT NULL,
    Runway_ID       INT             NOT NULL,
    Usage_Type      VARCHAR(30)     NOT NULL,

    PRIMARY KEY (Flight_ID, Route_ID, Leg_Sequence_No, Airport_ID, Runway_ID),
    FOREIGN KEY (Flight_ID, Route_ID, Leg_Sequence_No)
    	REFERENCES Flight_Legs(Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (Airport_ID, Runway_ID)
    	REFERENCES Runway(Airport_ID, Runway_ID)
);

-- ------------------------------------------------------------
-- 18. USES_GATE
-- ------------------------------------------------------------
CREATE TABLE Uses_Gate (
    Flight_ID       INT             NOT NULL,
    Route_ID        INT             NOT NULL,
    Leg_Sequence_No INT             NOT NULL,
    Airport_ID      INT             NOT NULL,
    Gate_No         INT             NOT NULL,
    Usage_Type      VARCHAR(30)     NOT NULL,

    PRIMARY KEY (Flight_ID, Route_ID, Leg_Sequence_No, Airport_ID, Gate_No),
    FOREIGN KEY (Flight_ID, Route_ID, Leg_Sequence_No)
    	REFERENCES Flight_Legs(Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (Airport_ID, Gate_No)
    	REFERENCES Gate(Airport_ID, Gate_No)
=======
-- ============================================================
-- PostgreSQL DDL Script — AeroFlow
-- ============================================================

CREATE SCHEMA AeroFlow;
SET SEARCH_PATH TO AeroFlow;

-- ------------------------------------------------------------
-- 1. AIRLINE
-- ------------------------------------------------------------
CREATE TABLE Airline (
    Airline_ID              INT             PRIMARY KEY,
    Airline_Name            VARCHAR(100)    NOT NULL,
    Country                 VARCHAR(50)     NOT NULL,
    Headquarters            VARCHAR(100)    NOT NULL,
    Email                   VARCHAR(20)     NOT NULL,
    IATA_Designator_Codes   VARCHAR(10)     NOT NULL
);

-- ------------------------------------------------------------
-- 2. AIRCRAFT
-- ------------------------------------------------------------
CREATE TABLE Aircraft (
    Aircraft_ID             INT             PRIMARY KEY,
    Airline_ID              INT             NOT NULL,
    Model                   VARCHAR(50)     NOT NULL,
    Manufacture_Date        DATE            NOT NULL,
    Total_Flight_Hours      INT             NOT NULL,
    Total_Flight_Cycle      INT             NOT NULL,
    Tot_Eco_Seats           INT             NOT NULL,
    Tot_Bus_Seats           INT             NOT NULL,
    Total_Fuel_Capacity     DECIMAL(10,2)   NOT NULL,
    Current_Fuel_Level      DECIMAL(10,2)   NOT NULL,
    Location                VARCHAR(100)    NOT NULL,
    Status_Type             VARCHAR(20)     NOT NULL,
    Current_Speed           DECIMAL(10,2),
    Autopilot_Status        VARCHAR(30),
    Cabin_Pressure_PSI      DECIMAL(5,2),
    Outside_Air_Temperature DECIMAL(5,2),
    Altitude                DECIMAL(9,3),
    Is_In_Aviation          BOOLEAN,

    FOREIGN KEY (Airline_ID) REFERENCES Airline(Airline_ID)
);

-- ------------------------------------------------------------
-- 3. MAINTENANCE
-- ------------------------------------------------------------
CREATE TABLE Maintenance (
    Maintenance_ID      INT             PRIMARY KEY,
    Aircraft_ID         INT             NOT NULL,
    Maintenance_Type    VARCHAR(50)     NOT NULL,
    Technician_Notes    TEXT,
    Maintenance_Status  VARCHAR(30)     NOT NULL,
    Scheduled_Date      DATE            NOT NULL,
    Actual_Start_Date   DATE,
    Completion_Date     DATE,
    Total_Cost          DECIMAL(10,2),

    FOREIGN KEY (Aircraft_ID) REFERENCES Aircraft(Aircraft_ID)
);

-- ------------------------------------------------------------
-- 4. AIRPORT
-- ------------------------------------------------------------
CREATE TABLE Airport (
    Airport_ID      INT             PRIMARY KEY,
    Airport_Name    VARCHAR(100)    NOT NULL,
    City            VARCHAR(50)     NOT NULL,
    State           VARCHAR(50)     NOT NULL,
    Country         VARCHAR(50)     NOT NULL,
    IATA_Code       VARCHAR(10)     NOT NULL
);

-- ------------------------------------------------------------
-- 5. RUNWAY
-- ------------------------------------------------------------
CREATE TABLE Runway (
    Airport_ID      INT             NOT NULL,
    Runway_ID       INT             NOT NULL,
    Surface_Type    VARCHAR(30)     NOT NULL,
    Runway_Length   DECIMAL(10,2)   NOT NULL,
    Status          VARCHAR(20)     NOT NULL,

    PRIMARY KEY (Airport_ID, Runway_ID),
    FOREIGN KEY (Airport_ID) REFERENCES Airport(Airport_ID)
);

-- ------------------------------------------------------------
-- 6. GATE
-- ------------------------------------------------------------
CREATE TABLE Gate (
    Airport_ID      INT             NOT NULL,
    Gate_No         INT             NOT NULL,
    Gate_Status     VARCHAR(20)     NOT NULL,

    PRIMARY KEY (Airport_ID, Gate_No),
    FOREIGN KEY (Airport_ID) REFERENCES Airport(Airport_ID)
);

-- ------------------------------------------------------------
-- 7. ROUTE
-- ------------------------------------------------------------
CREATE TABLE Route (
    Route_ID            INT             PRIMARY KEY,
    Distance            DECIMAL(10,2)   NOT NULL,
    Estimated_Duration  INT     	NOT NULL,
    Source_Airport_ID   INT     	NOT NULL,
    Dest_Airport_ID     INT     	NOT NULL,

    FOREIGN KEY (Source_Airport_ID) REFERENCES Airport(Airport_ID),
    FOREIGN KEY (Dest_Airport_ID)   REFERENCES Airport(Airport_ID)
);

-- ------------------------------------------------------------
-- 8. FLIGHT
-- ------------------------------------------------------------
CREATE TABLE Flight (
    Flight_ID           INT             PRIMARY KEY,
    Aircraft_ID         INT             NOT NULL,
    Departure_Time      TIMESTAMP       NOT NULL,
    Arrival_Time        TIMESTAMP       NOT NULL,
    Source_Airport_ID   INT     	NOT NULL,
    Dest_Airport_ID     INT     	NOT NULL,

    FOREIGN KEY (Aircraft_ID)       REFERENCES Aircraft(Aircraft_ID),
    FOREIGN KEY (Source_Airport_ID) REFERENCES Airport(Airport_ID),
    FOREIGN KEY (Dest_Airport_ID)   REFERENCES Airport(Airport_ID)
);

-- ------------------------------------------------------------
-- 9. FLIGHT_LEGS
-- ------------------------------------------------------------
CREATE TABLE Flight_Legs (
    Flight_ID       INT           NOT NULL,
    Route_ID        INT           NOT NULL,
    Leg_Sequence_No INT           NOT NULL,
    Takeoff_Time    TIMESTAMP     NOT NULL,
    Landing_Time    TIMESTAMP     NOT NULL,
    Leg_Status      VARCHAR(30)   NOT NULL,

    PRIMARY KEY (Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (Flight_ID) REFERENCES Flight(Flight_ID),
    FOREIGN KEY (Route_ID)  REFERENCES Route(Route_ID)
);

-- ------------------------------------------------------------
-- 10. PILOT
-- ------------------------------------------------------------
CREATE TABLE Pilot (
    Pilot_ID            INT             PRIMARY KEY,
    Name                VARCHAR(100)    NOT NULL,
    License_Number      VARCHAR(50)     NOT NULL,
    Email               VARCHAR(100)    NOT NULL,
    Experience_Level    VARCHAR(30)     NOT NULL
);

-- ------------------------------------------------------------
-- 11. CREW
-- ------------------------------------------------------------
CREATE TABLE Crew (
    Crew_ID                 INT             PRIMARY KEY,
    Name                    VARCHAR(100)    NOT NULL,
    Role                    VARCHAR(50)     NOT NULL,
    Experience              INT     	    NOT NULL,
    Language_Proficiency    VARCHAR(100)    NOT NULL
);

-- ------------------------------------------------------------
-- 12. USER
-- ------------------------------------------------------------
CREATE TABLE "User" (
    User_ID     INT             PRIMARY KEY,
    Name        VARCHAR(100)    NOT NULL,
    Email       VARCHAR(100)    NOT NULL,
    Phone       VARCHAR(20)     NOT NULL,
    Address     VARCHAR(200)    NOT NULL
);

-- ------------------------------------------------------------
-- 13. BOOKING
-- ------------------------------------------------------------
CREATE TABLE Booking (
    Booking_ID          INT             PRIMARY KEY,
    Flight_ID           INT             NOT NULL,
    Route_ID            INT             NOT NULL,
    Leg_Sequence_No     INT             NOT NULL,
    User_ID             INT             NOT NULL,
    Seat_Type           VARCHAR(20)     NOT NULL,
    Seat_Number         VARCHAR(10)     NOT NULL,
    Booking_Date        DATE     	NOT NULL,
    Booking_Status       VARCHAR(30)     NOT NULL,
    Booking_Sequence_No INT     	NOT NULL,

    FOREIGN KEY (Flight_ID, Route_ID, Leg_Sequence_No)
    	REFERENCES Flight_Legs(Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (User_ID) REFERENCES "User"(User_ID)
);

-- ------------------------------------------------------------
-- 14. LUGGAGE
-- ------------------------------------------------------------
CREATE TABLE Luggage (
    Luggage_ID  INT             PRIMARY KEY,
    Booking_ID  INT             NOT NULL,
    Tag_Number  VARCHAR(50)     NOT NULL,
    Weight      DECIMAL(6,2)    NOT NULL,

    FOREIGN KEY (Booking_ID) REFERENCES Booking(Booking_ID)
);

-- ------------------------------------------------------------
-- 15. PILOT_ASSIGN
-- ------------------------------------------------------------
CREATE TABLE Pilot_Assign (
    Flight_ID       INT   NOT NULL,
    Route_ID        INT   NOT NULL,
    Leg_Sequence_No INT   NOT NULL,
    Pilot_ID        INT   NOT NULL,

    PRIMARY KEY (Flight_ID, Route_ID, Leg_Sequence_No, Pilot_ID),
    FOREIGN KEY (Flight_ID, Route_ID, Leg_Sequence_No)
    	REFERENCES Flight_Legs(Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (Pilot_ID) REFERENCES Pilot(Pilot_ID)
);

-- ------------------------------------------------------------
-- 16. CREW_ASSIGN
-- ------------------------------------------------------------
CREATE TABLE Crew_Assign (
    Flight_ID       INT   NOT NULL,
    Route_ID        INT   NOT NULL,
    Leg_Sequence_No INT   NOT NULL,
    Crew_ID         INT   NOT NULL,

    PRIMARY KEY (Flight_ID, Route_ID, Leg_Sequence_No, Crew_ID),
    FOREIGN KEY (Flight_ID, Route_ID, Leg_Sequence_No)
    	REFERENCES Flight_Legs(Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (Crew_ID) REFERENCES Crew(Crew_ID)
);

-- ------------------------------------------------------------
-- 17. USES_RUNWAY
-- ------------------------------------------------------------
CREATE TABLE Uses_Runway (
    Flight_ID       INT             NOT NULL,
    Route_ID        INT             NOT NULL,
    Leg_Sequence_No INT             NOT NULL,
    Airport_ID      INT             NOT NULL,
    Runway_ID       INT             NOT NULL,
    Usage_Type      VARCHAR(30)     NOT NULL,

    PRIMARY KEY (Flight_ID, Route_ID, Leg_Sequence_No, Airport_ID, Runway_ID),
    FOREIGN KEY (Flight_ID, Route_ID, Leg_Sequence_No)
    	REFERENCES Flight_Legs(Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (Airport_ID, Runway_ID)
    	REFERENCES Runway(Airport_ID, Runway_ID)
);

-- ------------------------------------------------------------
-- 18. USES_GATE
-- ------------------------------------------------------------
CREATE TABLE Uses_Gate (
    Flight_ID       INT             NOT NULL,
    Route_ID        INT             NOT NULL,
    Leg_Sequence_No INT             NOT NULL,
    Airport_ID      INT             NOT NULL,
    Gate_No         INT             NOT NULL,
    Usage_Type      VARCHAR(30)     NOT NULL,

    PRIMARY KEY (Flight_ID, Route_ID, Leg_Sequence_No, Airport_ID, Gate_No),
    FOREIGN KEY (Flight_ID, Route_ID, Leg_Sequence_No)
    	REFERENCES Flight_Legs(Flight_ID, Route_ID, Leg_Sequence_No),
    FOREIGN KEY (Airport_ID, Gate_No)
    	REFERENCES Gate(Airport_ID, Gate_No)
>>>>>>> f8cbf6c3f47ba8d8769832393f34840d633809d6
);