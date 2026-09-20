/**
 * Frontend Type Definitions
 */

export interface ChillerRecord {
  timestamp: string;
  equipment_id: string;
  chilled_water_rate: number;
  cooling_water_temp: number;
  building_load: number;
  energy_consumption: number;
  outside_temp: number;
  dew_point: number;
  humidity: number;
  wind_speed: number;
  pressure: number;
  is_imputed: boolean;
  power_kw: number;
  specific_power_kw_rt: number;
  cop: number;
  wet_bulb_temp_c: number;
  cooling_approach_c: number;
  flow_per_rt: number;
  expected_energy_kwh: number;
  energy_residual_kwh: number;
  percent_deviation: number;
  anomaly_score: number;
  severity: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_anomaly: boolean;
  evidence_reasons: string[];
  recommendation: string;
}

export interface EquipmentSummary {
  equipment_id: string;
  record_count: number;
  anomaly_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_energy_kwh: number;
  avg_power_kw: number;
  avg_specific_power_kw_rt: number;
  avg_cop: number;
  health_score: number;
  potential_savings_kwh: number;
  start_time: string;
  end_time: string;
}

export interface SystemSummary {
  fleet_health_score: number;
  total_equipment: number;
  total_records: number;
  total_anomalies: number;
  total_energy_kwh: number;
  potential_savings_kwh: number;
  estimated_cost_savings_usd: number;
  sensitivity_threshold: number;
}
