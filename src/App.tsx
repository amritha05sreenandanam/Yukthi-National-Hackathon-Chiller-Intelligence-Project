/**
 * YUKTHI 2026: Intelligent Energy & Equipment Monitoring
 * Main Application Dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { OverviewCards } from './components/OverviewCards';
import { TimeSeriesChart } from './components/TimeSeriesChart';
import { AnomalyTable } from './components/AnomalyTable';
import { RecommendationsPanel } from './components/RecommendationsPanel';
import { EvidenceModal } from './components/EvidenceModal';
import { UploadModal } from './components/UploadModal';
import { ModelArchitectureModal } from './components/ModelArchitectureModal';
import { ChillerRecord, EquipmentSummary, SystemSummary } from './types';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  const [equipments, setEquipments] = useState<EquipmentSummary[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string>('CHILLER-01');
  const [timeSeriesData, setTimeSeriesData] = useState<ChillerRecord[]>([]);
  const [anomalies, setAnomalies] = useState<ChillerRecord[]>([]);
  const [systemSummary, setSystemSummary] = useState<SystemSummary | undefined>();
  const [sensitivity, setSensitivity] = useState<number>(50);

  // Modals & Active Investigation
  const [investigatingRecord, setInvestigatingRecord] = useState<ChillerRecord | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isModelInfoOpen, setIsModelInfoOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Fleet Overview & System Summary
  const fetchEquipmentList = useCallback(async () => {
    try {
      const [eqRes, sumRes] = await Promise.all([
        fetch('/api/equipment'),
        fetch('/api/summary'),
      ]);

      if (!eqRes.ok) throw new Error('Failed to fetch equipment list');
      const eqData: EquipmentSummary[] = await eqRes.json();
      setEquipments(eqData);

      if (sumRes.ok) {
        const sumData: SystemSummary = await sumRes.json();
        setSystemSummary(sumData);
        if (sumData.sensitivity_threshold) {
          setSensitivity(sumData.sensitivity_threshold);
        }
      }

      if (eqData.length > 0 && !eqData.some((e) => e.equipment_id === selectedEquipment)) {
        setSelectedEquipment(eqData[0].equipment_id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error communicating with backend API');
    }
  }, [selectedEquipment]);

  // 2. Fetch Time-Series Data & Anomalies for Selected Chiller
  const fetchEquipmentData = useCallback(async (eqId: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [dataRes, anomRes] = await Promise.all([
        fetch(`/api/data/${eqId}?limit=1500`),
        fetch(`/api/anomalies/${eqId}?limit=500`),
      ]);

      if (!dataRes.ok) throw new Error(`Failed to load data for ${eqId}`);
      const dataJson = await dataRes.json();
      setTimeSeriesData(dataJson.data || []);

      if (anomRes.ok) {
        const anomJson = await anomRes.json();
        setAnomalies(anomJson.anomalies || []);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to fetch equipment timeline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial mount
  useEffect(() => {
    fetchEquipmentList();
  }, [fetchEquipmentList]);

  // When selected equipment changes
  useEffect(() => {
    if (selectedEquipment) {
      fetchEquipmentData(selectedEquipment);
    }
  }, [selectedEquipment, fetchEquipmentData]);

  // Handle sensitivity changes
  const handleSensitivityChange = async (newVal: number) => {
    setSensitivity(newVal);
    try {
      const res = await fetch('/api/sensitivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: newVal }),
      });
      if (res.ok) {
        fetchEquipmentList();
        fetchEquipmentData(selectedEquipment);
      }
    } catch (err) {
      console.error('Failed to update sensitivity', err);
    }
  };

  // Reset to default benchmark dataset
  const handleResetData = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        await fetchEquipmentList();
        await fetchEquipmentData(selectedEquipment);
      }
    } catch (err) {
      console.error('Reset failed', err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleUploadSuccess = (chillers: string[]) => {
    fetchEquipmentList();
    if (chillers.length > 0) {
      setSelectedEquipment(chillers[0]);
    }
  };

  const currentUnit = equipments.find((e) => e.equipment_id === selectedEquipment);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <Header
        equipments={equipments}
        selectedEquipment={selectedEquipment}
        onSelectEquipment={(id) => setSelectedEquipment(id)}
        sensitivity={sensitivity}
        onSensitivityChange={handleSensitivityChange}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenModelInfo={() => setIsModelInfoOpen(true)}
        onResetData={handleResetData}
        isResetting={isResetting}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Global Error Banner if any */}
        {errorMsg && (
          <div className="p-4 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="flex-1">{errorMsg}</div>
            <button
              onClick={() => fetchEquipmentList()}
              className="px-3 py-1 bg-rose-900 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Overview KPI Cards */}
        <OverviewCards
          currentEquipment={currentUnit}
          systemSummary={systemSummary}
        />

        {/* Interactive Time-Series & Anomaly Visualization */}
        {isLoading ? (
          <div className="h-80 flex flex-col items-center justify-center bg-slate-900/60 border border-slate-800 rounded-2xl">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
            <span className="text-xs text-slate-400">
              Running contextual regression baseline and evaluating residuals...
            </span>
          </div>
        ) : (
          <TimeSeriesChart
            data={timeSeriesData}
            onSelectAnomaly={(record) => setInvestigatingRecord(record)}
            selectedRecord={investigatingRecord}
          />
        )}

        {/* Operational Recommendations Matrix */}
        <RecommendationsPanel currentEquipment={currentUnit} />

        {/* Detected Anomalies & Evidence Table */}
        <AnomalyTable
          anomalies={anomalies}
          onSelectAnomaly={(record) => setInvestigatingRecord(record)}
          selectedRecord={investigatingRecord}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 text-slate-500 py-6 text-xs text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong>Yukthi Chiller Intelligence</strong> — Intelligent Energy &amp; Equipment Monitoring (YUKTHI 2026 Hackathon)
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Unsupervised Anomaly Pipeline</span>
            <span>•</span>
            <span>11-Field Schema</span>
            <span>•</span>
            <span>ASHRAE 90.1 Compliant</span>
          </div>
        </div>
      </footer>

      {/* Root-Cause Evidence Drill-down Modal */}
      <EvidenceModal
        record={investigatingRecord}
        onClose={() => setInvestigatingRecord(null)}
      />

      {/* Dataset Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Model Architecture & Pipeline Specification Modal */}
      <ModelArchitectureModal
        isOpen={isModelInfoOpen}
        onClose={() => setIsModelInfoOpen(false)}
      />
    </div>
  );
}
