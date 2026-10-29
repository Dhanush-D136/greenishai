import React, { useState, useEffect } from 'react';
import {
  Droplets, Award, AlertCircle, BarChart3,
  Calendar, CheckCircle, TrendingUp, Lightbulb
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { api } from '../services/api';
import type { WaterEfficiencyResponse } from '../types';

interface WaterEfficiencyCardProps {
  zoneId: string;
  zoneName?: string;
}

export const WaterEfficiencyCard: React.FC<WaterEfficiencyCardProps> = ({
  zoneId,
  zoneName = 'Zone A'
}) => {
  const [data, setData] = useState<WaterEfficiencyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [days, setDays] = useState<number>(7);
  const [error, setError] = useState<string | null>(null);

  const fetchEfficiency = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getWaterEfficiency(zoneId, days);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch water efficiency analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (zoneId) {
      fetchEfficiency();
    }
  }, [zoneId, days]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center border border-cyan-100 shadow-inner">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-stone-800">Water-Use Optimization & Pumping Efficiency</h3>
              <span className="text-xs px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium">
                {zoneName}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Hydraulic volume estimation, absorption response delta, and waste cycle auditing
            </p>
          </div>
        </div>

        {/* Days Filter */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-semibold">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                days === d
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {d} Days
            </button>
          ))}
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-10 text-stone-400 text-xs">
          Computing hydraulic metrics and absorption deltas...
        </div>
      )}

      {error && (
        <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Key Metric Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Efficiency Score */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${getScoreColor(data.efficiency_score)}`}>
              <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4" /> Efficiency Score
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">{data.efficiency_score.toFixed(0)}</span>
                <span className="text-xs font-bold">/ 100</span>
              </div>
              <span className="text-[11px] opacity-80 mt-1 block">
                {data.efficiency_score >= 80 ? 'Optimal Water Stewardship' : 'Opportunity to optimize runtime'}
              </span>
            </div>

            {/* Estimated Consumption */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
              <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
                Volume Consumed
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-stone-800">
                  {data.water_consumed_liters_estimate !== null && data.water_consumed_liters_estimate !== undefined
                    ? data.water_consumed_liters_estimate.toFixed(1)
                    : '--'}
                </span>
                <span className="text-xs text-stone-500 font-medium">Liters</span>
              </div>
              <span className="text-[11px] text-stone-500 mt-1 block">
                {data.cycle_count} cycles ({Math.round(data.total_runtime_seconds / 60)}m runtime)
              </span>
            </div>

            {/* Average Moisture Gain */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
              <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
                Avg Moisture Gain
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-emerald-800">
                  +{data.avg_moisture_gain.toFixed(1)}
                </span>
                <span className="text-xs text-stone-500 font-medium">% Δ</span>
              </div>
              <span className="text-[11px] text-stone-500 mt-1 block">
                Per successful pump cycle
              </span>
            </div>

            {/* Inefficient Cycles */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
              <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
                Flagged Cycles
              </span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-amber-700">
                  {data.inefficient_cycles_count}
                </span>
                <span className="text-xs text-stone-500 font-medium">cycles</span>
              </div>
              <span className="text-[11px] text-stone-500 mt-1 block">
                {data.rain_watering_cycles_count > 0 ? `${data.rain_watering_cycles_count} during rain` : '0 during rainfall'}
              </span>
            </div>
          </div>

          {/* Daily Consumption Chart */}
          <div className="bg-stone-50/50 p-4 rounded-xl border border-stone-100">
            <div className="flex items-center justify-between text-xs text-stone-600 mb-2 font-medium">
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-600" />
                Daily Water Volume (Liters)
              </span>
              <span className="text-stone-400">Pump rate: {data.flow_rate_lpm} L/min</span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily_runtimes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} unit="L" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                    formatter={(val: any) => [`${Number(val).toFixed(1)} L`, 'Water Consumed']}
                  />
                  <Bar dataKey="volume_liters" fill="#0284C7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Actionable Agricultural Recommendations */}
          {data.recommendations && data.recommendations.length > 0 && (
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                <Lightbulb className="w-4 h-4 text-emerald-700" /> Actionable Agronomic Optimizations
              </span>
              <ul className="space-y-1.5 text-xs text-emerald-950">
                {data.recommendations.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

