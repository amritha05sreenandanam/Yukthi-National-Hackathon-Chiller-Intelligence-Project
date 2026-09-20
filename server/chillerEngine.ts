/**
 * YUKTHI 2026: Intelligent Energy & Equipment Monitoring
 * TypeScript Core Chiller Pipeline & Contextual Anomaly Engine
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export interface RawRecord {
  timestamp: string;
  equipment_id: string;
  'Chilled Water Rate (L/sec)'?: number | null | string;
  'Cooling Water Temperature (C)'?: number | null | string;
  'Building Load (RT)'?: number | null | string;
  'Chiller Energy Consumption (kWh)'?: number | null | string;
  'Outside Temperature (F)'?: number | null | string;
  'Dew Point (F)'?: number | null | string;
  'Humidity (%)'?: number | null | string;
  'Wind Speed (mph)'?: number | null | string;
  'Pressure (in)'?: number | null | string;
  [key: string]: any;
}

export interface ProcessedRecord {
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
  // Imputed flags
  is_imputed: boolean;
  // Engineered thermodynamic features
  power_kw: number;
  specific_power_kw_rt: number; // kW / RT
  cop: number; // Coefficient of Performance
  wet_bulb_temp_c: number;
  cooling_approach_c: number;
  flow_per_rt: number;
  // ML predictions and residuals
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
  health_score: number; // 0 - 100
  potential_savings_kwh: number;
  start_time: string;
  end_time: string;
}

export const EXPECTED_FIELDS = [
  'timestamp',
  'equipment_id',
  'Chilled Water Rate (L/sec)',
  'Cooling Water Temperature (C)',
  'Building Load (RT)',
  'Chiller Energy Consumption (kWh)',
  'Outside Temperature (F)',
  'Dew Point (F)',
  'Humidity (%)',
  'Wind Speed (mph)',
  'Pressure (in)',
];

/**
 * Calculates Wet-Bulb Temperature (Celsius) using Stull's empirical psychrometric formula
 */
function calculateWetBulbC(tempF: number, humidityPct: number): number {
  const tempC = (tempF - 32.0) * (5.0 / 9.0);
  const rh = Math.max(1.0, Math.min(100.0, humidityPct));
  const tw =
    tempC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(tempC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035;
  return Math.round(tw * 100) / 100;
}

class RidgeRegressor {
  private weights: number[] = [];
  private bias: number = 0;
  private featureMeans: number[] = [];
  private featureStds: number[] = [];
  private targetMean: number = 0;
  private targetStd: number = 1;

  fit(X: number[][], y: number[]) {
    const n = X.length;
    if (n === 0) return;
    const numFeatures = X[0].length;

    this.featureMeans = Array(numFeatures).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < numFeatures; j++) {
        this.featureMeans[j] += X[i][j];
      }
    }
    this.featureMeans = this.featureMeans.map((s) => s / n);

    this.featureStds = Array(numFeatures).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < numFeatures; j++) {
        this.featureStds[j] += Math.pow(X[i][j] - this.featureMeans[j], 2);
      }
    }
    this.featureStds = this.featureStds.map((s) => Math.sqrt(s / Math.max(1, n - 1)) || 1.0);

    this.targetMean = y.reduce((a, b) => a + b, 0) / n;
    this.targetStd =
      Math.sqrt(y.reduce((acc, v) => acc + Math.pow(v - this.targetMean, 2), 0) / Math.max(1, n - 1)) || 1.0;

    const XNorm = X.map((row) =>
      row.map((val, j) => (val - this.featureMeans[j]) / this.featureStds[j])
    );
    const yNorm = y.map((val) => (val - this.targetMean) / this.targetStd);

    // Gradient descent with L2 Ridge regularizer
    const w = Array(numFeatures).fill(0);
    let b = 0;
    const lr = 0.05;
    const alpha = 0.02;
    const epochs = 220;

    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradW = Array(numFeatures).fill(0);
      let gradB = 0;

      for (let i = 0; i < n; i++) {
        let pred = b;
        for (let j = 0; j < numFeatures; j++) {
          pred += w[j] * XNorm[i][j];
        }
        const err = pred - yNorm[i];
        for (let j = 0; j < numFeatures; j++) {
          gradW[j] += err * XNorm[i][j];
        }
        gradB += err;
      }

      for (let j = 0; j < numFeatures; j++) {
        w[j] -= lr * (gradW[j] / n + alpha * w[j]);
      }
      b -= lr * (gradB / n);
    }

    this.weights = w;
    this.bias = b;
  }

  predict(X: number[][]): number[] {
    const numFeatures = this.weights.length;
    return X.map((row) => {
      let normPred = this.bias;
      for (let j = 0; j < numFeatures; j++) {
        const normVal = (row[j] - this.featureMeans[j]) / this.featureStds[j];
        normPred += this.weights[j] * normVal;
      }
      const rawPred = normPred * this.targetStd + this.targetMean;
      return Math.max(0, Math.round(rawPred * 100) / 100);
    });
  }
}

export class ChillerEngine {
  private dataStore: Map<string, ProcessedRecord[]> = new Map();
  private models: Map<string, RidgeRegressor> = new Map();
  private stats: Map<
    string,
    { meanResidual: number; stdResidual: number; meanKwRt: number; stdKwRt: number }
  > = new Map();
  public sensitivityThreshold: number = 50.0;

  constructor(sensitivity = 50.0) {
    this.sensitivityThreshold = sensitivity;
    this.loadDefaultDataset();
  }

  public loadDefaultDataset(): void {
    const samplePath = path.resolve(process.cwd(), 'data', 'sample_chiller_data.csv');
    if (fs.existsSync(samplePath)) {
      const csvData = fs.readFileSync(samplePath, 'utf-8');
      this.ingestCsv(csvData);
    } else {
      console.warn(`Sample data not found at ${samplePath}`);
    }
  }

  public ingestCsv(csvString: string): { success: boolean; message: string; chillers: string[]; recordCount: number } {
    const parsed = Papa.parse<Record<string, string>>(csvString.trim(), {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error(`CSV Parsing failed: ${parsed.errors[0].message}`);
    }

    // Verify fields
    const headers = parsed.meta.fields || [];
    const missing = EXPECTED_FIELDS.filter((f) => !headers.includes(f));
    if (missing.length > 0) {
      throw new Error(`Invalid Schema! Missing required columns: ${missing.join(', ')}`);
    }

    // Group rows by equipment_id
    const grouped: Map<string, any[]> = new Map();
    for (const r of parsed.data) {
      const eq = (r['equipment_id'] || 'UNKNOWN').trim();
      if (!grouped.has(eq)) grouped.set(eq, []);
      grouped.get(eq)!.push(r);
    }

    this.dataStore.clear();
    this.models.clear();
    this.stats.clear();

    let totalProcessed = 0;

    for (const [eqId, rows] of grouped.entries()) {
      // Sort chronologically (preserve temporal gaps without creating fake timestamps)
      rows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Pass 1: Imputation of numeric columns via forward-fill and rolling window
      const numericCols = [
        'Chilled Water Rate (L/sec)',
        'Cooling Water Temperature (C)',
        'Building Load (RT)',
        'Chiller Energy Consumption (kWh)',
        'Outside Temperature (F)',
        'Dew Point (F)',
        'Humidity (%)',
        'Wind Speed (mph)',
        'Pressure (in)',
      ];

      // Calculate global equipment averages
      const colSums: Record<string, number> = {};
      const colCounts: Record<string, number> = {};
      numericCols.forEach((c) => {
        colSums[c] = 0;
        colCounts[c] = 0;
      });

      rows.forEach((r) => {
        numericCols.forEach((c) => {
          const val = parseFloat(r[c]);
          if (!isNaN(val)) {
            colSums[c] += val;
            colCounts[c] += 1;
          }
        });
      });

      const colMeans: Record<string, number> = {};
      numericCols.forEach((c) => {
        colMeans[c] = colCounts[c] > 0 ? colSums[c] / colCounts[c] : 0;
      });

      // Impute forward-fill + rolling
      const lastKnown: Record<string, number | null> = {};
      const windowBuf: Record<string, number[]> = {};
      numericCols.forEach((c) => {
        lastKnown[c] = null;
        windowBuf[c] = [];
      });

      const cleanedRows: any[] = [];
      for (const r of rows) {
        let isImputed = false;
        const cleaned: Record<string, any> = {
          timestamp: r.timestamp,
          equipment_id: eqId,
        };

        for (const c of numericCols) {
          const raw = r[c];
          let val = parseFloat(raw);
          if (isNaN(val) || raw === '' || raw === undefined || raw === null) {
            isImputed = true;
            const buf = windowBuf[c];
            if (buf.length > 0) {
              val = buf.reduce((a, b) => a + b, 0) / buf.length;
            } else if (lastKnown[c] !== null) {
              val = lastKnown[c]!;
            } else {
              val = colMeans[c];
            }
          } else {
            lastKnown[c] = val;
            windowBuf[c].push(val);
            if (windowBuf[c].length > 5) windowBuf[c].shift();
          }
          cleaned[c] = Math.round(val * 1000) / 1000;
        }
        cleaned.is_imputed = isImputed;
        cleanedRows.push(cleaned);
      }

      // Feature Engineering
      const processed: ProcessedRecord[] = cleanedRows.map((r) => {
        const chilledRate = r['Chilled Water Rate (L/sec)'];
        const coolWaterTemp = r['Cooling Water Temperature (C)'];
        const load = Math.max(10, r['Building Load (RT)']);
        const energyKwh = r['Chiller Energy Consumption (kWh)'];
        const outTemp = r['Outside Temperature (F)'];
        const dewPoint = r['Dew Point (F)'];
        const humidity = r['Humidity (%)'];
        const windSpeed = r['Wind Speed (mph)'];
        const pressure = r['Pressure (in)'];

        // 30 min kWh -> instantaneous average electrical power (kW)
        const powerKw = Math.round(energyKwh * 2.0 * 100) / 100;
        const specificPowerKwRt = Math.round((powerKw / load) * 1000) / 1000;

        // 1 RT = 3.517 kW thermal cooling
        const thermalKw = load * 3.517;
        const cop = Math.round((thermalKw / Math.max(1, powerKw)) * 100) / 100;

        const wetBulb = calculateWetBulbC(outTemp, humidity);
        const coolingApproach = Math.round((coolWaterTemp - wetBulb) * 100) / 100;
        const flowPerRt = Math.round((chilledRate / load) * 1000) / 1000;

        return {
          timestamp: r.timestamp,
          equipment_id: eqId,
          chilled_water_rate: chilledRate,
          cooling_water_temp: coolWaterTemp,
          building_load: load,
          energy_consumption: energyKwh,
          outside_temp: outTemp,
          dew_point: dewPoint,
          humidity,
          wind_speed: windSpeed,
          pressure,
          is_imputed: r.is_imputed,
          power_kw: powerKw,
          specific_power_kw_rt: specificPowerKwRt,
          cop,
          wet_bulb_temp_c: wetBulb,
          cooling_approach_c: coolingApproach,
          flow_per_rt: flowPerRt,
          expected_energy_kwh: 0,
          energy_residual_kwh: 0,
          percent_deviation: 0,
          anomaly_score: 0,
          severity: 'NORMAL',
          is_anomaly: false,
          evidence_reasons: [],
          recommendation: '',
        };
      });

      // Train Equipment Baseline Regression
      const X = processed.map((p) => [
        p.building_load,
        p.outside_temp,
        p.cooling_water_temp,
        p.chilled_water_rate,
        p.dew_point,
        p.humidity,
        (p.building_load / 100) * Math.max(0, p.cooling_water_temp - 20),
      ]);
      const y = processed.map((p) => p.energy_consumption);

      const regressor = new RidgeRegressor();
      regressor.fit(X, y);
      this.models.set(eqId, regressor);

      const expectedVals = regressor.predict(X);

      // Compute Baseline Residual Statistics
      const residuals = processed.map((p, idx) => Math.abs(p.energy_consumption - expectedVals[idx]));
      const meanRes = residuals.reduce((a, b) => a + b, 0) / residuals.length;
      const stdRes =
        Math.sqrt(residuals.reduce((a, b) => a + Math.pow(b - meanRes, 2), 0) / Math.max(1, residuals.length - 1)) ||
        1.0;

      const kwRts = processed.map((p) => p.specific_power_kw_rt);
      const meanKwRt = kwRts.reduce((a, b) => a + b, 0) / kwRts.length;
      const stdKwRt =
        Math.sqrt(kwRts.reduce((a, b) => a + Math.pow(b - meanKwRt, 2), 0) / Math.max(1, kwRts.length - 1)) || 0.05;

      this.stats.set(eqId, { meanResidual: meanRes, stdResidual: stdRes, meanKwRt, stdKwRt });

      // Anomaly Scoring & Evidence Generation
      processed.forEach((p, idx) => {
        const expected = expectedVals[idx];
        const actual = p.energy_consumption;
        const diff = Math.round((actual - expected) * 100) / 100;
        const pctDev = expected > 0 ? Math.round((diff / Math.max(10, expected)) * 1000) / 10 : 0;

        const resZ = (Math.abs(diff) - meanRes) / Math.max(0.01, stdRes);
        const kwRtZ = (p.specific_power_kw_rt - meanKwRt) / Math.max(0.01, stdKwRt);
        const approachPenalty = Math.max(0, p.cooling_approach_c - 7.5) * 4.0;
        const lowDeltaTPenalty = Math.max(0, p.flow_per_rt - 0.65) * 50.0;

        const rawScore =
          Math.max(0, resZ) * 22.0 +
          Math.max(0, kwRtZ) * 20.0 +
          approachPenalty +
          lowDeltaTPenalty;

        const anomalyScore = Math.min(100.0, Math.round(rawScore * 10) / 10);

        let severity: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'NORMAL';
        if (anomalyScore >= 80.0) severity = 'CRITICAL';
        else if (anomalyScore >= 65.0) severity = 'HIGH';
        else if (anomalyScore >= 45.0) severity = 'MEDIUM';
        else if (anomalyScore >= 30.0) severity = 'LOW';

        const isAnomaly = anomalyScore >= this.sensitivityThreshold;

        const evidence: string[] = [];
        let recommendation = 'Operating within normal thermodynamic envelope. Routine schedule maintained.';

        if (isAnomaly) {
          if (diff > 12 && pctDev > 20) {
            evidence.push(
              `Excessive energy consumption: +${diff} kWh (+${pctDev}%) over expected baseline conditioned on ${p.building_load} RT building load and ${p.outside_temp}°F outdoor temperature.`
            );
          }
          if (p.cooling_approach_c > 8.0) {
            evidence.push(
              `Condenser heat rejection degradation: Cooling approach is ${p.cooling_approach_c}°C above ambient wet-bulb (${p.wet_bulb_temp_c}°C), signaling condenser scaling or cooling tower fan staging deficiency.`
            );
            recommendation =
              'Initiate tube brushing / descaling cycle on condenser barrel. Check cooling tower spray headers and basin temperature controls.';
          } else if (p.flow_per_rt > 0.65) {
            evidence.push(
              `Low Delta-T Syndrome: Chilled water flow is elevated at ${p.flow_per_rt} L/s per RT, causing hydraulic over-pumping without proportionate thermal extraction.`
            );
            recommendation =
              'Audit primary-secondary bypass decouple valves and check air handling unit 2-way modulating valve seating.';
          } else if (kwRtZ > 1.8) {
            evidence.push(
              `Specific power spike: Chiller operating at ${p.specific_power_kw_rt} kW/RT (fleet baseline: ${Math.round(meanKwRt * 100) / 100} kW/RT), reducing COP to ${p.cop}.`
            );
            recommendation =
              'Inspect compressor inlet guide vane position, refrigerant charge level, and motor winding resistance.';
          } else {
            evidence.push(
              `Contextual residual excursion: Multi-feature anomaly residual exceeds 2.5 standard deviations from baseline envelope.`
            );
            recommendation =
              'Verify sensor calibration across chilled water supply/return thermistors and check supervisory BMS setpoint schedule.';
          }
        }

        p.expected_energy_kwh = expected;
        p.energy_residual_kwh = diff;
        p.percent_deviation = pctDev;
        p.anomaly_score = anomalyScore;
        p.severity = severity;
        p.is_anomaly = isAnomaly;
        p.evidence_reasons = evidence;
        p.recommendation = recommendation;
      });

      this.dataStore.set(eqId, processed);
      totalProcessed += processed.length;
    }

    return {
      success: true,
      message: `Processed ${totalProcessed} records across ${grouped.size} equipment units.`,
      chillers: Array.from(grouped.keys()),
      recordCount: totalProcessed,
    };
  }

  public getEquipmentList(): EquipmentSummary[] {
    const list: EquipmentSummary[] = [];

    for (const [eqId, records] of this.dataStore.entries()) {
      const flagged = records.filter((r) => r.is_anomaly);
      const criticalCount = flagged.filter((r) => r.severity === 'CRITICAL').length;
      const highCount = flagged.filter((r) => r.severity === 'HIGH').length;
      const mediumCount = flagged.filter((r) => r.severity === 'MEDIUM').length;
      const lowCount = flagged.filter((r) => r.severity === 'LOW').length;

      const totalEnergy = records.reduce((acc, r) => acc + r.energy_consumption, 0);
      const avgPower = records.reduce((acc, r) => acc + r.power_kw, 0) / (records.length || 1);
      const avgKwRt = records.reduce((acc, r) => acc + r.specific_power_kw_rt, 0) / (records.length || 1);
      const avgCop = records.reduce((acc, r) => acc + r.cop, 0) / (records.length || 1);

      // Energy wasted due to positive residuals during anomaly periods
      const potentialSavings = flagged.reduce((acc, r) => acc + Math.max(0, r.energy_residual_kwh), 0);

      // Health Score (0 - 100)
      const anomalyRatio = flagged.length / (records.length || 1);
      const health = Math.max(
        30,
        Math.min(100, Math.round(100 - anomalyRatio * 75 - criticalCount * 0.4 - highCount * 0.2))
      );

      list.push({
        equipment_id: eqId,
        record_count: records.length,
        anomaly_count: flagged.length,
        critical_count: criticalCount,
        high_count: highCount,
        medium_count: mediumCount,
        low_count: lowCount,
        total_energy_kwh: Math.round(totalEnergy * 10) / 10,
        avg_power_kw: Math.round(avgPower * 10) / 10,
        avg_specific_power_kw_rt: Math.round(avgKwRt * 1000) / 1000,
        avg_cop: Math.round(avgCop * 100) / 100,
        health_score: health,
        potential_savings_kwh: Math.round(potentialSavings * 10) / 10,
        start_time: records[0]?.timestamp || '',
        end_time: records[records.length - 1]?.timestamp || '',
      });
    }

    return list.sort((a, b) => a.equipment_id.localeCompare(b.equipment_id));
  }

  public getData(
    equipmentId: string,
    startTime?: string,
    endTime?: string,
    limit: number = 1000
  ): { equipment_id: string; total_available: number; data: ProcessedRecord[] } {
    let records = this.dataStore.get(equipmentId) || [];
    if (startTime) {
      records = records.filter((r) => r.timestamp >= startTime);
    }
    if (endTime) {
      records = records.filter((r) => r.timestamp <= endTime);
    }

    return {
      equipment_id: equipmentId,
      total_available: records.length,
      data: records.slice(0, limit),
    };
  }

  public getAnomalies(
    equipmentId: string,
    severityFilter?: string,
    limit: number = 300
  ): { equipment_id: string; total_anomalies: number; anomalies: ProcessedRecord[] } {
    const records = this.dataStore.get(equipmentId) || [];
    let flagged = records.filter((r) => r.is_anomaly);

    if (severityFilter && severityFilter !== 'ALL') {
      flagged = flagged.filter((r) => r.severity.toUpperCase() === severityFilter.toUpperCase());
    }

    return {
      equipment_id: equipmentId,
      total_anomalies: flagged.length,
      anomalies: flagged.slice(0, limit),
    };
  }

  public updateSensitivity(newSensitivity: number) {
    this.sensitivityThreshold = Math.max(10, Math.min(90, newSensitivity));
    // Re-evaluate anomalies with new threshold
    for (const [eqId, records] of this.dataStore.entries()) {
      records.forEach((p) => {
        p.is_anomaly = p.anomaly_score >= this.sensitivityThreshold;
      });
    }
  }

  public getSystemSummary(): {
    fleet_health_score: number;
    total_equipment: number;
    total_records: number;
    total_anomalies: number;
    total_energy_kwh: number;
    potential_savings_kwh: number;
    estimated_cost_savings_usd: number;
    sensitivity_threshold: number;
  } {
    const list = this.getEquipmentList();
    if (list.length === 0) {
      return {
        fleet_health_score: 100,
        total_equipment: 0,
        total_records: 0,
        total_anomalies: 0,
        total_energy_kwh: 0,
        potential_savings_kwh: 0,
        estimated_cost_savings_usd: 0,
        sensitivity_threshold: this.sensitivityThreshold,
      };
    }

    const avgHealth = Math.round(list.reduce((a, b) => a + b.health_score, 0) / list.length);
    const totalRecords = list.reduce((a, b) => a + b.record_count, 0);
    const totalAnomalies = list.reduce((a, b) => a + b.anomaly_count, 0);
    const totalEnergy = list.reduce((a, b) => a + b.total_energy_kwh, 0);
    const totalSavings = list.reduce((a, b) => a + b.potential_savings_kwh, 0);
    // Industrial commercial electricity tariff ~$0.12 / kWh
    const costSavingsUsd = Math.round(totalSavings * 0.12);

    return {
      fleet_health_score: avgHealth,
      total_equipment: list.length,
      total_records: totalRecords,
      total_anomalies: totalAnomalies,
      total_energy_kwh: Math.round(totalEnergy),
      potential_savings_kwh: Math.round(totalSavings),
      estimated_cost_savings_usd: costSavingsUsd,
      sensitivity_threshold: this.sensitivityThreshold,
    };
  }
}

export const globalEngine = new ChillerEngine(50.0);
