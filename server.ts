/**
 * YUKTHI 2026: Intelligent Energy & Equipment Monitoring
 * Production Express Server Entry Point
 */

import express from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { globalEngine } from './server/chillerEngine.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // --- API Routes ---

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      app: 'Yukthi Chiller Intelligence',
      hackathon: 'YUKTHI 2026 National-Level Hackathon',
      chillers: globalEngine.getEquipmentList().map((e) => e.equipment_id),
      timestamp: new Date().toISOString(),
    });
  });

  // 1. List equipment units with health and summary statistics
  app.get('/api/equipment', (req, res) => {
    try {
      const list = globalEngine.getEquipmentList();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch equipment list' });
    }
  });

  // 2. Fetch historical time-series data for an equipment unit
  app.get('/api/data/:equipmentId', (req, res) => {
    try {
      const { equipmentId } = req.params;
      const { startTime, endTime, limit } = req.query;
      const maxLimit = limit ? parseInt(limit as string, 10) : 2000;

      const result = globalEngine.getData(
        equipmentId,
        startTime as string | undefined,
        endTime as string | undefined,
        maxLimit
      );

      if (result.total_available === 0) {
        return res.status(404).json({ error: `Equipment ${equipmentId} not found in dataset` });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to retrieve equipment data' });
    }
  });

  // 3. Fetch detected anomalies for an equipment unit
  app.get('/api/anomalies/:equipmentId', (req, res) => {
    try {
      const { equipmentId } = req.params;
      const { severity, limit } = req.query;
      const maxLimit = limit ? parseInt(limit as string, 10) : 500;

      const result = globalEngine.getAnomalies(
        equipmentId,
        severity as string | undefined,
        maxLimit
      );

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to retrieve anomalies' });
    }
  });

  // 4. System-level summary and fleet health
  app.get('/api/summary', (req, res) => {
    try {
      const summary = globalEngine.getSystemSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Update ML sensitivity threshold (10 - 90)
  app.post('/api/sensitivity', (req, res) => {
    try {
      const { threshold } = req.body;
      const num = parseFloat(threshold);
      if (isNaN(num) || num < 10 || num > 90) {
        return res.status(400).json({ error: 'Sensitivity threshold must be a number between 10 and 90' });
      }
      globalEngine.updateSensitivity(num);
      res.json({
        success: true,
        sensitivity_threshold: globalEngine.sensitivityThreshold,
        summary: globalEngine.getSystemSummary(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Upload new CSV dataset conforming to 11-field schema
  app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
      let csvContent = '';
      if (req.file) {
        csvContent = req.file.buffer.toString('utf-8');
      } else if (req.body.csvText) {
        csvContent = req.body.csvText;
      } else {
        return res.status(400).json({ error: 'No CSV file or csvText provided in request' });
      }

      const result = globalEngine.ingestCsv(csvContent);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error processing uploaded dataset' });
    }
  });

  // 7. Reset to default benchmark dataset
  app.post('/api/reset', (req, res) => {
    try {
      globalEngine.loadDefaultDataset();
      res.json({
        success: true,
        message: 'Reset to default benchmark dataset',
        equipment: globalEngine.getEquipmentList(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Export enriched dataset with contextual anomaly scores as CSV
  app.get('/api/export/:equipmentId', (req, res) => {
    try {
      const { equipmentId } = req.params;
      const data = globalEngine.getData(equipmentId, undefined, undefined, 10000);
      if (data.total_available === 0) {
        return res.status(404).send('Equipment not found');
      }

      const headers = [
        'timestamp',
        'equipment_id',
        'Chilled Water Rate (L/sec)',
        'Cooling Water Temperature (C)',
        'Building Load (RT)',
        'Chiller Energy Consumption (kWh)',
        'Expected Energy (kWh)',
        'Residual Energy (kWh)',
        'Specific Power (kW/RT)',
        'COP',
        'Cooling Approach (C)',
        'Outside Temperature (F)',
        'Dew Point (F)',
        'Humidity (%)',
        'Anomaly Score',
        'Severity',
        'Is Anomaly',
        'Evidence',
      ];

      const csvRows = [headers.join(',')];
      data.data.forEach((r) => {
        const evidenceStr = `"${r.evidence_reasons.join('; ').replace(/"/g, '""')}"`;
        csvRows.push(
          [
            r.timestamp,
            r.equipment_id,
            r.chilled_water_rate,
            r.cooling_water_temp,
            r.building_load,
            r.energy_consumption,
            r.expected_energy_kwh,
            r.energy_residual_kwh,
            r.specific_power_kw_rt,
            r.cop,
            r.cooling_approach_c,
            r.outside_temp,
            r.dew_point,
            r.humidity,
            r.anomaly_score,
            r.severity,
            r.is_anomaly ? 'TRUE' : 'FALSE',
            evidenceStr,
          ].join(',')
        );
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${equipmentId}_contextual_anomalies.csv"`
      );
      res.send(csvRows.join('\n'));
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  // --- Vite Middleware & Production Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Yukthi Chiller Intelligence server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
