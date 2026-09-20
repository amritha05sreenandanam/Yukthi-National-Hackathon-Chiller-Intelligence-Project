import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Table,
} from 'lucide-react';
import Papa from 'papaparse';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (chillers: string[]) => void;
}

const REQUIRED_COLUMNS = [
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

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndParse = (selectedFile: File) => {
    setValidationError(null);
    setFile(selectedFile);

    Papa.parse(selectedFile, {
      header: true,
      preview: 5,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        const missing = REQUIRED_COLUMNS.filter((col) => !fields.includes(col));
        if (missing.length > 0) {
          setValidationError(
            `Data contract mismatch. Missing required fields: ${missing.join(', ')}`
          );
          setCsvPreview([]);
        } else {
          setCsvPreview(results.data);
        }
      },
      error: (err) => {
        setValidationError(`CSV reading error: ${err.message}`);
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndParse(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndParse(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!file || validationError) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onUploadSuccess(data.chillers || data.equipment_units || []);
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to upload dataset');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-5">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Upload Chiller Telemetry Dataset
            </h3>
            <p className="text-xs text-slate-400">
              Conforming to the 11-field YUKTHI 2026 Hackathon schema
            </p>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            dragActive
              ? 'border-cyan-400 bg-cyan-950/20'
              : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleChange}
            className="hidden"
          />
          <UploadCloud className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-200">
            {file ? file.name : 'Click to browse or drag and drop your CSV'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Supports CHILLER-01, CHILLER-02, CHILLER-03 or custom units at 30-min intervals
          </p>
        </div>

        {/* Validation Errors */}
        {validationError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Schema Checklist / Preview */}
        {csvPreview.length > 0 && !validationError && (
          <div className="mt-4 p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>11-Field Schema Validated Successfully</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Ready to impute missing values, engineer thermodynamic features, and run contextual residual anomaly detection.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleUploadSubmit}
            disabled={!file || Boolean(validationError) || isUploading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Pipeline...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Ingest &amp; Run Detection</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
