import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Brush,
  ReferenceArea,
} from 'recharts';
import {
  Zap,
  Activity,
  Thermometer,
  CloudSun,
  Maximize2,
  Calendar,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { ChillerRecord } from '../types';

interface TimeSeriesChartProps {
  data: ChillerRecord[];
  onSelectAnomaly: (record: ChillerRecord) => void;
  selectedRecord?: ChillerRecord | null;
}

type ChartViewMode = 'energy' | 'load_flow' | 'thermodynamics' | 'weather';
type TimeRangePreset = 'all' | '14d' | '7d' | '48h';

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  onSelectAnomaly,
  selectedRecord,
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('energy');
  const [timePreset, setTimePreset] = useState<TimeRangePreset>('all');

  // Filter based on time preset
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (timePreset === 'all') return data;

    const lastDate = new Date(data[data.length - 1].timestamp).getTime();
    let durationMs = 0;
    if (timePreset === '48h') durationMs = 48 * 3600 * 1000;
    else if (timePreset === '7d') durationMs = 7 * 24 * 3600 * 1000;
    else if (timePreset === '14d') durationMs = 14 * 24 * 3600 * 1000;

    const cutoff = lastDate - durationMs;
    return data.filter((d) => new Date(d.timestamp).getTime() >= cutoff);
  }, [data, timePreset]);

  // Format short timestamp for axis
  const formatXAxis = (tick: string) => {
    if (!tick) return '';
    const parts = tick.split(' ');
    if (parts.length === 2) {
      const d = parts[0].substring(5); // MM-DD
      const t = parts[1].substring(0, 5); // HH:MM
      return `${d} ${t}`;
    }
    return tick.substring(5, 16);
  };

  // Custom rich tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item: ChillerRecord = payload[0]?.payload;
    if (!item) return null;

    const isFlagged = item.is_anomaly;

    return (
      <div className="bg-slate-950/95 border border-slate-700 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs max-w-sm z-50">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="font-mono text-slate-300 font-semibold">{item.timestamp}</div>
          {isFlagged && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                item.severity === 'CRITICAL'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : item.severity === 'HIGH'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-yellow-950 text-yellow-300 border border-yellow-800'
              }`}
            >
              {item.severity} ANOMALY ({item.anomaly_score})
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
          <div>
            <span className="text-slate-500">Actual Energy:</span>{' '}
            <strong className="text-cyan-400 font-mono">{item.energy_consumption} kWh</strong>
          </div>
          <div>
            <span className="text-slate-500">Expected:</span>{' '}
            <strong className="text-slate-300 font-mono">{item.expected_energy_kwh} kWh</strong>
          </div>
          <div>
            <span className="text-slate-500">Residual:</span>{' '}
            <strong
              className={`font-mono ${
                item.energy_residual_kwh > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {item.energy_residual_kwh > 0 ? `+${item.energy_residual_kwh}` : item.energy_residual_kwh} kWh
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Specific Power:</span>{' '}
            <strong className="text-slate-200 font-mono">{item.specific_power_kw_rt} kW/RT</strong>
          </div>
          <div>
            <span className="text-slate-500">Building Load:</span>{' '}
            <strong className="text-blue-400 font-mono">{item.building_load} RT</strong>
          </div>
          <div>
            <span className="text-slate-500">Chilled Flow:</span>{' '}
            <strong className="text-blue-300 font-mono">{item.chilled_water_rate} L/s</strong>
          </div>
          <div>
            <span className="text-slate-500">Cooling Water:</span>{' '}
            <strong className="text-amber-400 font-mono">{item.cooling_water_temp} °C</strong>
          </div>
          <div>
            <span className="text-slate-500">Outside Temp:</span>{' '}
            <strong className="text-orange-300 font-mono">{item.outside_temp} °F</strong>
          </div>
        </div>

        {isFlagged && item.evidence_reasons && item.evidence_reasons.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] text-rose-300 bg-rose-950/30 p-2 rounded border border-rose-900/50">
            <div className="font-semibold flex items-center gap-1 mb-0.5 text-rose-400">
              <AlertCircle className="w-3 h-3" /> Anomaly Evidence:
            </div>
            {item.evidence_reasons[0]}
          </div>
        )}

        <div className="mt-2 text-center">
          <button
            onClick={() => onSelectAnomaly(item)}
            className="w-full py-1 px-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-1.5 transition text-[11px]"
          >
            <Eye className="w-3 h-3" /> Click to Investigate Root Cause
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="timeseries-chart-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">
              Operational Time-Series &amp; Contextual Anomaly Detection
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
              {filteredData.length} Intervals (30-min)
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Visualizing nominal operations vs expected baseline regression with contextual anomaly pinpoints
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle Buttons */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              id="btn-mode-energy"
              onClick={() => setViewMode('energy')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition ${
                viewMode === 'energy'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Energy &amp; Baseline</span>
            </button>
            <button
              id="btn-mode-load-flow"
              onClick={() => setViewMode('load_flow')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition ${
                viewMode === 'load_flow'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Load &amp; Flow</span>
            </button>
            <button
              id="btn-mode-thermodynamics"
              onClick={() => setViewMode('thermodynamics')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition ${
                viewMode === 'thermodynamics'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5" />
              <span>Lift &amp; Approach</span>
            </button>
            <button
              id="btn-mode-weather"
              onClick={() => setViewMode('weather')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition ${
                viewMode === 'weather'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CloudSun className="w-3.5 h-3.5" />
              <span>Weather</span>
            </button>
          </div>

          {/* Time Preset Zoom */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              id="btn-time-48h"
              onClick={() => setTimePreset('48h')}
              className={`px-2 py-1 rounded-lg font-medium ${
                timePreset === '48h' ? 'bg-slate-700 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              48h
            </button>
            <button
              id="btn-time-7d"
              onClick={() => setTimePreset('7d')}
              className={`px-2 py-1 rounded-lg font-medium ${
                timePreset === '7d' ? 'bg-slate-700 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7d
            </button>
            <button
              id="btn-time-14d"
              onClick={() => setTimePreset('14d')}
              className={`px-2 py-1 rounded-lg font-medium ${
                timePreset === '14d' ? 'bg-slate-700 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              14d
            </button>
            <button
              id="btn-time-all"
              onClick={() => setTimePreset('all')}
              className={`px-2 py-1 rounded-lg font-medium ${
                timePreset === 'all' ? 'bg-slate-700 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="h-[360px] sm:h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={filteredData}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload[0]) {
                const record = e.activePayload[0].payload as ChillerRecord;
                if (record && record.is_anomaly) {
                  onSelectAnomaly(record);
                }
              }
            }}
          >
            <defs>
              <linearGradient id="actualEnergyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={45}
            />

            {/* Dynamic Y Axis and Lines according to viewMode */}
            {viewMode === 'energy' && (
              <>
                <YAxis
                  yAxisId="energy"
                  stroke="#94a3b8"
                  fontSize={11}
                  domain={['auto', 'auto']}
                  unit=" kWh"
                />
                <YAxis
                  yAxisId="score"
                  orientation="right"
                  stroke="#f43f5e"
                  fontSize={11}
                  domain={[0, 100]}
                  unit=" pts"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                {/* Expected Energy Baseline Regression Curve */}
                <Line
                  yAxisId="energy"
                  type="monotone"
                  dataKey="expected_energy_kwh"
                  name="Expected Energy Baseline (kWh)"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />

                {/* Actual Energy Consumption Area */}
                <Area
                  yAxisId="energy"
                  type="monotone"
                  dataKey="energy_consumption"
                  name="Actual Energy (kWh)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#actualEnergyGrad)"
                  isAnimationActive={false}
                  activeDot={{ r: 6, fill: '#06b6d4' }}
                />

                {/* Anomaly Score overlay */}
                <Line
                  yAxisId="score"
                  type="monotone"
                  dataKey="anomaly_score"
                  name="Contextual Anomaly Score (0-100)"
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload && payload.is_anomaly) {
                      const isCritical = payload.severity === 'CRITICAL';
                      return (
                        <circle
                          key={`dot-${payload.timestamp}`}
                          cx={cx}
                          cy={cy}
                          r={isCritical ? 5.5 : 4}
                          fill={isCritical ? '#ef4444' : '#f59e0b'}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          className="cursor-pointer hover:scale-150 transition-transform"
                          onClick={() => onSelectAnomaly(payload)}
                        />
                      );
                    }
                    return null;
                  }}
                  isAnimationActive={false}
                />
              </>
            )}

            {viewMode === 'load_flow' && (
              <>
                <YAxis
                  yAxisId="load"
                  stroke="#3b82f6"
                  fontSize={11}
                  domain={['auto', 'auto']}
                  unit=" RT"
                />
                <YAxis
                  yAxisId="flow"
                  orientation="right"
                  stroke="#10b981"
                  fontSize={11}
                  domain={['auto', 'auto']}
                  unit=" L/s"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                <Area
                  yAxisId="load"
                  type="monotone"
                  dataKey="building_load"
                  name="Building Load (RT)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#loadGrad)"
                  isAnimationActive={false}
                />

                <Line
                  yAxisId="flow"
                  type="monotone"
                  dataKey="chilled_water_rate"
                  name="Chilled Water Rate (L/sec)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            )}

            {viewMode === 'thermodynamics' && (
              <>
                <YAxis
                  yAxisId="temp"
                  stroke="#f59e0b"
                  fontSize={11}
                  domain={['auto', 'auto']}
                  unit=" °C"
                />
                <YAxis
                  yAxisId="cop"
                  orientation="right"
                  stroke="#38bdf8"
                  fontSize={11}
                  domain={[0, 8]}
                  unit=" COP"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="cooling_water_temp"
                  name="Cooling Water Temp (°C)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="wet_bulb_temp_c"
                  name="Ambient Wet-Bulb (°C)"
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="cooling_approach_c"
                  name="Cooling Tower Approach (°C)"
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="cop"
                  type="monotone"
                  dataKey="cop"
                  name="COP (Thermal Efficiency)"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            )}

            {viewMode === 'weather' && (
              <>
                <YAxis
                  yAxisId="temp"
                  stroke="#f97316"
                  fontSize={11}
                  domain={['auto', 'auto']}
                  unit=" °F"
                />
                <YAxis
                  yAxisId="rh"
                  orientation="right"
                  stroke="#06b6d4"
                  fontSize={11}
                  domain={[0, 100]}
                  unit=" %"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="outside_temp"
                  name="Outside Temp (°F)"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="dew_point"
                  name="Dew Point (°F)"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="rh"
                  type="monotone"
                  dataKey="humidity"
                  name="Relative Humidity (%)"
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            )}

            {/* Brush for smooth scrubbing & timeline navigation */}
            <Brush
              dataKey="timestamp"
              height={26}
              stroke="#475569"
              fill="#0f172a"
              tickFormatter={formatXAxis}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>Critical Anomaly Pinpoint</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>High/Medium Deviation</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-purple-400 inline-block" />
            <span>Expected Regression Baseline</span>
          </span>
        </div>
        <span className="text-slate-500 italic">
          Tip: Click any anomaly dot on the chart or scrub the timeline below
        </span>
      </div>
    </div>
  );
};
