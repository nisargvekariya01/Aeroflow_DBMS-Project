import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * Report registry — maps report ID to its stored DB function name and title.
 *
 * Every SQL string that previously lived in this file has been moved into
 * db_logic.sql (Section 8, rpt_q01_* … rpt_q37_*) and deployed as a
 * PostgreSQL function. The API now just calls the function by name.
 *
 * Functions that accept a parameter (20, 29, 30) use the default values
 * baked into the function signature; they can be extended with ?param= later.
 */
const REPORTS = {
  // === Scenario 1: Flight Scheduling & Operations ===
  '1':  { title: 'Full Flight Schedule',               fn: 'rpt_q01_full_flight_schedule()' },
  '2':  { title: 'Top 3 Busiest Routes',               fn: 'rpt_q02_top3_busiest_routes()' },
  '3':  { title: 'Delayed Flight Legs',                fn: 'rpt_q03_delayed_legs()' },
  '4':  { title: 'Hub Airport Analysis',               fn: 'rpt_q04_hub_airports()' },
  '5':  { title: 'Pilot & Crew Counts',                fn: 'rpt_q05_pilot_crew_counts()' },
  '6':  { title: 'High-Utilization Routes',            fn: 'rpt_q06_high_utilisation_routes()' },
  '7':  { title: 'Gate Usage Profile',                 fn: 'rpt_q07_gate_usage()' },
  '8':  { title: 'Multi-Leg Passenger Paths',          fn: 'rpt_q08_multi_leg_itinerary()' },
  '9':  { title: 'Airport Bottleneck Score',           fn: 'rpt_q09_airport_bottleneck()' },
  '10': { title: 'Pilot Rosters',                      fn: 'rpt_q10_pilot_roster()' },
  '11': { title: 'Flight Route Strings',               fn: 'rpt_q11_flight_route_strings()' },

  // === Scenario 2: Passenger Experience ===
  '12': { title: 'Revenue per Route',                  fn: 'rpt_q12_revenue_per_route()' },
  '13': { title: 'Power Passengers',                   fn: 'rpt_q13_power_passengers()' },
  '14': { title: 'Aircraft Passenger Volume',          fn: 'rpt_q14_aircraft_passenger_volume()' },
  '15': { title: 'Heavy Luggage Flights',              fn: 'rpt_q15_heavy_luggage_flights()' },
  '16': { title: 'Mixed Class Passengers',             fn: 'rpt_q16_mixed_class_passengers()' },
  '17': { title: 'Loyal Passengers (No Cancellations)', fn: 'rpt_q17_loyal_passengers()' },
  '18': { title: 'IndiGo-Only Passengers',             fn: 'rpt_q18_indigo_only_passengers()' },
  '19': { title: 'Manual Bag Inspection Queue (2nd/3rd Heaviest)', fn: 'rpt_q19_manual_bag_inspection()' },
  '20': { title: 'Travel Buddy Matching (vs User 401)', fn: 'rpt_q20_travel_buddy_matching()' },

  // === Scenario 3: Fleet & Crew ===
  '21': { title: 'Airline Fleet Summary',              fn: 'rpt_q21_fleet_summary()' },
  '22': { title: 'Maintenance Cost Audit',             fn: 'rpt_q22_maintenance_cost_audit()' },
  '23': { title: 'High-Utilisation Benchmarking (vs GoFirst)', fn: 'rpt_q23_high_utilisation_vs_gofirst()' },
  '24': { title: 'Post-Maintenance Reliability',       fn: 'rpt_q24_post_maintenance_reliability()' },
  '25': { title: 'Aircraft Financial Efficiency',      fn: 'rpt_q25_aircraft_financial_efficiency()' },
  '26': { title: 'Runway Traffic Profile',             fn: 'rpt_q26_runway_traffic_profile()' },
  '27': { title: 'Cabin Manager Appraisal',            fn: 'rpt_q27_cabin_manager_appraisal()' },
  '28': { title: 'Pilot Workload Tiers',               fn: 'rpt_q28_pilot_workload_tiers()' },
  '29': { title: 'Crew Itinerary Completeness (Flight 1001)', fn: 'rpt_q29_crew_completeness()' },
  '30': { title: 'Pilot Itinerary Completeness (Flight 1003)', fn: 'rpt_q30_pilot_completeness()' },

  // === Scenario 4: Strategic & Risk ===
  '31': { title: 'Flight Load Factor (Ghost Flights)',  fn: 'rpt_q31_flight_load_factor()' },
  '32': { title: 'Frequent Flyer Tier Eligibility',    fn: 'rpt_q32_frequent_flyer_tiers()' },
  '33': { title: 'Carbon Footprint Profile',           fn: 'rpt_q33_carbon_footprint()' },
  '34': { title: 'Crew Fatigue / Safety Violations',   fn: 'rpt_q34_crew_rest_violations()' },
  '35': { title: 'Peak Hour Congestion',               fn: 'rpt_q35_peak_hour_congestion()' },
  '36': { title: 'Revenue Leakage (Cancellations)',    fn: 'rpt_q36_revenue_leakage()' },
  '37': { title: 'Route Difficulty vs Pilot Seniority', fn: 'rpt_q37_route_difficulty_vs_seniority()' },
};

// GET /api/reports?id=N
// Calls the corresponding rpt_qNN_* stored function. Zero SQL in this file.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !REPORTS[id]) {
    return NextResponse.json({ error: 'Invalid Report ID' }, { status: 400 });
  }

  try {
    const report = REPORTS[id];
    const result = await query(`SELECT * FROM ${report.fn}`);
    return NextResponse.json({
      title: report.title,
      data: result.rows,
    });
  } catch (error) {
    console.error('Report Error:', error.message);
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
