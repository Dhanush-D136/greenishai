import React, { useState, useEffect } from 'react';
import {
  TrendingDown, TrendingUp, Minus, Sparkles, RefreshCw,
  AlertTriangle, ShieldCheck, Clock, Activity
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid
} from 'recharts';
import { api } from '../services/api';
import type { AIForecastResponse } from '../types';

interface AIForecastCardProps {
  zoneId: string;
  zoneName?: string;
  targetMoisture?: number;
  dryThreshold?: number;
}

export const AIForecastCard: React.FC<AIForecastCardProps> = ({
  zoneId,
  zoneName = 'Zone A',
  targetMoisture = 70,
  dryThreshold = 35
}) => {
  const [data, setData] = useState<AIForecastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAIForecast(zoneId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AI moisture forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (zoneId) {
      fetchForecast();
    }
  }, [zoneId]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'DRYING':
        return <TrendingDown className="w-5 h-5 text-amber-600" />;
      case 'RISING':
        return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      default:
        return <Minus className="w-5 h-5 text-blue-600" />;
    }
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'DRYING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Drying Trend</span>;
      case 'RISING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Moisture Rising</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Stable Equilibrium</span>;
    }
  };

  // Format chart curve points
  const chartPoints = (data?.forecast_curve || []).map((pt) => {
    const timeStr = pt.timestamp.includes('T') ? pt.timestamp.split('T')[1].slice(0, 5) : pt.timestamp;
    return {
      time: timeStr,
      measured: !pt.is_forecast ? pt.moisture_percent : null,
      forecast: pt.is_forecast ? pt.moisture_percent : null,
      range: pt.is_forecast && pt.confidence_min !== undefined && pt.confidence_max !== undefined
        ? [pt.confidence_min, pt.confidence_max]
        : null
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shadow-inner">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-stone-800">Soil Moisture Predictive Forecast</h3>
              <span className="text-xs px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium">
                {zoneName}
              </span>
            </div>
            <p className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
              <span>Model: {data?.model_type || 'Decay Forecast'}</span>
              <span>•</span>
              <span>v{data?.model_version || '1.2'}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                Data Quality: {data?.data_quality || 'OPTIMAL'}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={fetchForecast}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh predictive forecast"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-12 text-stone-400 gap-2">
          <Activity className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm">Calculating soil physics and moisture projection...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3 my-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to load forecast</p>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100">
              <span className="text-xs text-stone-500 font-medium block">Current Reading</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-stone-800">{data.current_moisture.toFixed(1)}</span>
                <span className="text-xs text-stone-500 font-medium">%</span>
              </div>
              <div className="mt-1">
                {getTrendBadge(data.trend_direction)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100/80">
              <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> +30 min Forecast
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-emerald-900">
                  {data.forecast_30m !== null && data.forecast_30m !== undefined ? data.forecast_30m.toFixed(1) : '--'}
                </span>
                <span className="text-xs text-emerald-700 font-medium">%</span>
              </div>
              <span className="text-[11px] text-emerald-700/80 mt-1 block">
                {data.confidence_interval_30m ? `CI: [${data.confidence_interval_30m[0]}% – ${data.confidence_interval_30m[1]}%]` : '±2.5% uncertainty'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100/80">
              <span className="text-xs text-blue-700 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> +60 min Forecast
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-blue-900">
                  {data.forecast_60m !== null && data.forecast_60m !== undefined ? data.forecast_60m.toFixed(1) : '--'}
                </span>
                <span className="text-xs text-blue-700 font-medium">%</span>
              </div>
              <span className="text-[11px] text-blue-700/80 mt-1 block">
                {data.confidence_interval_60m ? `CI: [${data.confidence_interval_60m[0]}% – ${data.confidence_interval_60m[1]}%]` : '±4.0% uncertainty'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 flex flex-col justify-between">
              <span className="text-xs text-stone-500 font-medium">Zone Thresholds</span>
              <div className="text-xs text-stone-700 space-y-1 mt-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Target:</span>
                  <span className="font-semibold text-emerald-700">{targetMoisture}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Dry Limit:</span>
                  <span className="font-semibold text-amber-700">{dryThreshold}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast Visualization Chart */}
          <div className="bg-stone-50/50 p-4 rounded-xl border border-stone-100">
            <div className="flex items-center justify-between text-xs text-stone-600 mb-2 font-medium">
              <span>Telemetry History & Predictive Curve</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-600 inline-block"></span>
                  Measured
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-blue-600 inline-block"></span>
                  AI Forecast
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B7280' }} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                    formatter={(val: any, name?: any) => [
                      `${Number(val).toFixed(1)}%`,
                      name === 'measured' ? 'Measured Sensor' : 'AI Predicted'
                    ]}
                  />
                  <ReferenceLine y={targetMoisture} stroke="#10B981" strokeDasharray="4 4" label={{ value: 'Target', position: 'insideTopRight', fill: '#059669', fontSize: 10 }} />
                  <ReferenceLine y={dryThreshold} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Dry Trigger', position: 'insideBottomRight', fill: '#D97706', fontSize: 10 }} />
                  
                  <Line
                    type="monotone"
                    dataKey="measured"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#2563EB"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: '#2563EB' }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Agronomic Insight Note */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-900">
            <Sparkles className="w-4 h-4 flex-shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <span className="font-semibold">Agricultural Prediction Insight: </span>
              {data.trend_direction === 'DRYING' && (
                <span>
                  Moisture is declining at approx. {Math.abs(data.current_moisture - (data.forecast_60m || data.current_moisture)).toFixed(1)}% per hour under ambient transpiration. Soil will reach the dry trigger ({dryThreshold}%) in approximately {Math.max(15, Math.round(((data.current_moisture - dryThreshold) / Math.max(0.1, (data.current_moisture - (data.forecast_60m || data.current_moisture))))) * 60)} minutes without irrigation.
                </span>
              )}
              {data.trend_direction === 'RISING' && (
                <span>
                  Soil moisture is absorbing applied water or rain. No immediate irrigation recommended; capillary saturation active.
                </span>
              )}
              {data.trend_direction === 'STABLE' && (
                <span>
                  Soil moisture is in equilibrium with canopy humidity. Transpiration losses are minimal at current ambient light levels.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
