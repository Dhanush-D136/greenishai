import React, { useState, useEffect } from 'react';
import {
  AlertCircle, AlertTriangle, Info, CheckCircle2,
  RefreshCw, ShieldAlert, Cpu, Droplets, Wifi, Check
} from 'lucide-react';
import { api } from '../services/api';
import type { AIAnomalyResponse } from '../types';

interface AIAnomalyListProps {
  zoneId?: string;
  limit?: number;
}

export const AIAnomalyList: React.FC<AIAnomalyListProps> = ({ zoneId, limit = 20 }) => {
  const [anomalies, setAnomalies] = useState<AIAnomalyResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'SENSOR' | 'IRRIGATION' | 'COMMUNICATION'>('ALL');
  const [error, setError] = useState<string | null>(null);

  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAIAnomalies({
        zone_id: zoneId,
        limit: limit
      });
      setAnomalies(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch anomalies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [zoneId, limit]);

  const handleScan = async () => {
    try {
      setScanning(true);
      await api.triggerAIAnomalyScan();
      await fetchAnomalies();
    } catch (err: any) {
      setError(err.message || 'Anomaly scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleAcknowledge = async (eventId: string) => {
    try {
      const updated = await api.acknowledgeAIAnomaly(eventId);
      setAnomalies((prev) => prev.map((a) => (a.event_id === eventId ? updated : a)));
    } catch (err: any) {
      alert(`Could not acknowledge: ${err.message}`);
    }
  };

  const handleResolve = async (eventId: string) => {
    try {
      const updated = await api.resolveAIAnomaly(eventId);
      setAnomalies((prev) => prev.map((a) => (a.event_id === eventId ? updated : a)));
    } catch (err: any) {
      alert(`Could not resolve: ${err.message}`);
    }
  };

  const filteredList = anomalies.filter((item) => {
    if (filter === 'ACTIVE') return item.status === 'ACTIVE';
    if (filter === 'SENSOR') return item.category === 'SENSOR';
    if (filter === 'IRRIGATION') return item.category === 'IRRIGATION';
    if (filter === 'COMMUNICATION') return item.category === 'COMMUNICATION';
    return true;
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" /> CRITICAL
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> ERROR
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> WARNING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Info className="w-3.5 h-3.5 text-blue-600" /> INFO
          </span>
        );
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'SENSOR':
        return <Cpu className="w-4 h-4 text-emerald-600" />;
      case 'IRRIGATION':
        return <Droplets className="w-4 h-4 text-blue-600" />;
      case 'COMMUNICATION':
        return <Wifi className="w-4 h-4 text-purple-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-stone-600" />;
    }
  };

  const activeCount = anomalies.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-inner">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-stone-800">Fault & Anomaly Detection</h3>
              {activeCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  {activeCount} Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> All Nominal
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Layered deterministic telemetry rules & statistical out-of-bounds guards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScan}
            disabled={scanning || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Scan all telemetry and pump states now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-rose-600' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Scan Now'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4 text-xs font-medium">
        {(['ALL', 'ACTIVE', 'SENSOR', 'IRRIGATION', 'COMMUNICATION'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              filter === tab
                ? 'bg-stone-800 text-white font-semibold'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Anomaly Cards List */}
      {loading && anomalies.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-stone-400 text-xs">
          Scanning system logs and sensor streams...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-stone-400 gap-2 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          <p className="text-sm font-semibold text-stone-700">No anomalies detected</p>
          <p className="text-xs text-stone-500 max-w-sm text-center">
            Capacitive soil sensors, pump response loops, and MQTT keep-alives are within normal thresholds.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((anom) => (
            <div
              key={anom.event_id}
              className={`p-4 rounded-xl border transition-all ${
                anom.status === 'ACTIVE'
                  ? 'bg-rose-50/30 border-rose-200/80 shadow-xs'
                  : 'bg-stone-50/60 border-stone-200 opacity-80'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(anom.category)}
                  <span className="text-sm font-bold text-stone-800">{anom.anomaly_type.replace(/_/g, ' ')}</span>
                  {getSeverityBadge(anom.severity)}
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                    anom.status === 'ACTIVE'
                      ? 'bg-rose-100 text-rose-800'
                      : anom.status === 'ACKNOWLEDGED'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}>
                    {anom.status}
                  </span>
                  <span className="text-stone-400">
                    {new Date(anom.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Evidence */}
              <div className="mt-2.5 text-xs text-stone-700 bg-white/80 p-2.5 rounded-lg border border-stone-100 font-mono">
                <span className="font-semibold text-stone-500">Observed Evidence: </span>
                {anom.observed_evidence}
              </div>

              {/* Explanation & Action */}
              <p className="text-xs text-stone-600 mt-2">
                {anom.explanation}
              </p>

              {anom.suggested_action && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-stone-800 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60">
                  <span className="font-semibold text-amber-800">Suggested Action: </span>
                  <span>{anom.suggested_action}</span>
                </div>
              )}

              {/* Actions Footer */}
              {anom.status !== 'RESOLVED' && (
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-stone-100 pt-2.5">
                  {anom.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleAcknowledge(anom.event_id)}
                      className="px-2.5 py-1 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-md transition-colors cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleResolve(anom.event_id)}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-md transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark Resolved
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

