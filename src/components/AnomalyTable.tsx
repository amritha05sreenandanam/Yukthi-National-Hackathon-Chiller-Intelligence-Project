import React, { useState } from 'react';
import {
  AlertTriangle,
  Search,
  Filter,
  Eye,
  ArrowUpDown,
  ChevronRight,
  Flame,
  Droplet,
  Zap,
} from 'lucide-react';
import { ChillerRecord } from '../types';

interface AnomalyTableProps {
  anomalies: ChillerRecord[];
  onSelectAnomaly: (record: ChillerRecord) => void;
  selectedRecord?: ChillerRecord | null;
}

export const AnomalyTable: React.FC<AnomalyTableProps> = ({
  anomalies,
  onSelectAnomaly,
  selectedRecord,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'timestamp' | 'anomaly_score' | 'energy_residual_kwh'>('anomaly_score');
  const [sortAsc, setSortAsc] = useState(false);

  // Filter & Search
  const filtered = anomalies.filter((item) => {
    const matchesSeverity =
      severityFilter === 'ALL' || item.severity.toUpperCase() === severityFilter.toUpperCase();
    const matchesSearch =
      searchTerm === '' ||
      item.timestamp.includes(searchTerm) ||
      (item.evidence_reasons &&
        item.evidence_reasons.some((r) => r.toLowerCase().includes(searchTerm.toLowerCase())));
    return matchesSeverity && matchesSearch;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortField === 'timestamp') {
      diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    } else if (sortField === 'anomaly_score') {
      diff = a.anomaly_score - b.anomaly_score;
    } else if (sortField === 'energy_residual_kwh') {
      diff = a.energy_residual_kwh - b.energy_residual_kwh;
    }
    return sortAsc ? diff : -diff;
  });

  const handleSort = (field: 'timestamp' | 'anomaly_score' | 'energy_residual_kwh') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div id="anomaly-table-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">
              Detected Operational Anomalies &amp; Evidence Log
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80">
              {sorted.length} Flagged
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Unsupervised multi-dimensional residual outliers ranked by severity and thermodynamic drift
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-anomalies"
              type="text"
              placeholder="Search timestamp or fault..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-800 text-slate-200 pl-8 pr-3 py-1.5 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-cyan-500 w-44 sm:w-52"
            />
          </div>

          {/* Severity Filter Pills */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((sev) => (
              <button
                key={sev}
                id={`filter-severity-${sev.toLowerCase()}`}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  severityFilter === sev
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-700/80">
            <tr>
              <th
                onClick={() => handleSort('timestamp')}
                className="py-3 px-3.5 cursor-pointer hover:text-slate-200 whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Timestamp</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                onClick={() => handleSort('anomaly_score')}
                className="py-3 px-3.5 cursor-pointer hover:text-slate-200 whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Score / Severity</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3 px-3.5 whitespace-nowrap">Actual vs Expected</th>
              <th
                onClick={() => handleSort('energy_residual_kwh')}
                className="py-3 px-3.5 cursor-pointer hover:text-slate-200 whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Residual Deviation</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3 px-3.5 whitespace-nowrap">kW/RT (COP)</th>
              <th className="py-3 px-3.5">Dominant Subsystem Evidence</th>
              <th className="py-3 px-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No anomalies match the current filter criteria or sensitivity threshold.
                </td>
              </tr>
            ) : (
              sorted.slice(0, 30).map((record) => {
                const isSelected = selectedRecord?.timestamp === record.timestamp;
                const isCritical = record.severity === 'CRITICAL';
                const isHigh = record.severity === 'HIGH';

                return (
                  <tr
                    key={record.timestamp}
                    onClick={() => onSelectAnomaly(record)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-950/40 border-l-2 border-blue-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                      {record.timestamp}
                    </td>

                    {/* Score / Severity Badge */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            isCritical
                              ? 'bg-rose-950/90 text-rose-300 border-rose-800'
                              : isHigh
                              ? 'bg-amber-950/90 text-amber-300 border-amber-800'
                              : 'bg-yellow-950/80 text-yellow-300 border-yellow-800'
                          }`}
                        >
                          {record.severity} ({record.anomaly_score})
                        </span>
                      </div>
                    </td>

                    {/* Actual vs Expected */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                      <span className="text-cyan-300 font-semibold">{record.energy_consumption}</span>
                      <span className="text-slate-500"> / {record.expected_energy_kwh} kWh</span>
                    </td>

                    {/* Residual Deviation */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                      <span
                        className={`font-semibold ${
                          record.energy_residual_kwh > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        +{record.energy_residual_kwh} kWh (+{record.percent_deviation}%)
                      </span>
                    </td>

                    {/* Specific Power & COP */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-300">
                      <span>{record.specific_power_kw_rt}</span>
                      <span className="text-slate-500 text-[11px]"> ({record.cop} COP)</span>
                    </td>

                    {/* Dominant Evidence */}
                    <td className="py-3 px-3.5 text-slate-400 text-xs max-w-xs truncate" title={record.evidence_reasons[0] || 'Statistical outlier'}>
                      {record.evidence_reasons[0] || 'Multivariate contextual regression residual excursion'}
                    </td>

                    {/* Investigate Button */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAnomaly(record);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white font-medium text-xs transition"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > 30 && (
        <div className="mt-3 text-center text-xs text-slate-500">
          Showing top 30 of {sorted.length} flagged anomalies. Export full CSV for complete offline analysis.
        </div>
      )}
    </div>
  );
};
