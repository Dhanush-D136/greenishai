import React, { useState, useEffect } from 'react';
import {
  Sparkles, CheckCircle2, XCircle, Clock, Droplets,
  ShieldAlert, AlertTriangle, ArrowRight, Play, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import type { AIRecommendationResponse } from '../types';

interface AIRecommendationsCardProps {
  zoneId?: string;
  zoneName?: string;
  onActionComplete?: () => void;
}

export const AIRecommendationsCard: React.FC<AIRecommendationsCardProps> = ({
  zoneId,
  zoneName = 'Zone A',
  onActionComplete
}) => {
  const [recommendations, setRecommendations] = useState<AIRecommendationResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAIRecommendations({
        zone_id: zoneId,
        limit: 10
      });
      setRecommendations(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AI recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [zoneId]);

  const handleEvaluate = async () => {
    if (!zoneId) return;
    try {
      setEvaluating(true);
      await api.evaluateAIRecommendation(zoneId);
      await fetchRecommendations();
    } catch (err: any) {
      setError(err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const handleApprove = async (recId: string) => {
    try {
      setProcessingId(recId);
      await api.approveAIRecommendation(recId);
      await fetchRecommendations();
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (recId: string) => {
    try {
      setProcessingId(recId);
      await api.rejectAIRecommendation(recId);
      await fetchRecommendations();
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'IRRIGATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Droplets className="w-3.5 h-3.5 text-blue-600" /> Recommend Watering
          </span>
        );
      case 'WAIT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sufficient Moisture
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Inspect Zone
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">Awaiting Approval</span>;
      case 'APPROVED':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800">Approved</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-100 text-rose-800">Rejected</span>;
      case 'EXPIRED':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-500">Expired</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-600">{status}</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-inner">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-stone-800">AI Irrigation Recommendations</h3>
              <span className="text-xs px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium">
                Approval Required
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Multi-factor agronomic advice combining sensor thresholds, decay forecast, and weather
            </p>
          </div>
        </div>

        {zoneId && (
          <button
            onClick={handleEvaluate}
            disabled={evaluating || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Evaluate live conditions for this zone"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
            <span>{evaluating ? 'Evaluating...' : 'Evaluate Zone'}</span>
          </button>
        )}
      </div>

      {/* Human-in-the-Loop Safety Assurance */}
      <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900">
        <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold">Human-in-the-Loop Safeguard: </span>
          AI evaluates plant profile requirements and decay trends, but will <strong>never</strong> actuate the physical pump automatically without explicit operator review and approval.
        </p>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Recommendations List */}
      {loading && recommendations.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-stone-400 text-xs">
          Loading recommendations...
        </div>
      ) : recommendations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-stone-400 gap-2 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          <p className="text-sm font-semibold text-stone-700">No active recommendations pending</p>
          <p className="text-xs text-stone-500">
            Click "Evaluate Zone" above to evaluate real-time sensor streams against crop requirements.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => {
            const isPending = rec.status === 'PENDING' && !rec.is_expired;
            return (
              <div
                key={rec.recommendation_id}
                className={`p-4 rounded-xl border transition-all ${
                  isPending
                    ? 'bg-blue-50/20 border-blue-200 shadow-xs'
                    : 'bg-stone-50/50 border-stone-200 opacity-80'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getActionBadge(rec.suggested_action)}
                    <span className="text-xs font-semibold text-stone-700">
                      Zone: {rec.zone_id}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(rec.is_expired && rec.status === 'PENDING' ? 'EXPIRED' : rec.status)}
                    <span className="text-[11px] text-stone-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(rec.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Main Reason / Logic */}
                <p className="text-sm text-stone-800 font-medium mt-2">
                  {rec.reason}
                </p>

                {/* Evidence Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                  <div className="p-2 rounded-lg bg-white border border-stone-100">
                    <span className="text-stone-400 text-[11px] block">Current Moisture</span>
                    <span className="font-bold text-stone-800">{rec.current_moisture.toFixed(1)}%</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-stone-100">
                    <span className="text-stone-400 text-[11px] block">Dry Threshold</span>
                    <span className="font-bold text-amber-700">{rec.dry_threshold.toFixed(1)}%</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-stone-100">
                    <span className="text-stone-400 text-[11px] block">Recommended Runtime</span>
                    <span className="font-bold text-blue-700">
                      {rec.suggested_action === 'IRRIGATE' ? `${Math.round(rec.proposed_duration_seconds / 60)} mins (${rec.proposed_duration_seconds}s)` : 'None'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-stone-100">
                    <span className="text-stone-400 text-[11px] block">Confidence</span>
                    <span className="font-bold text-emerald-700">{Math.round(rec.confidence * 100)}%</span>
                  </div>
                </div>

                {/* Approval Controls */}
                {isPending && rec.suggested_action === 'IRRIGATE' && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-3">
                    <span className="text-xs text-stone-500">
                      Expires at {new Date(rec.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReject(rec.recommendation_id)}
                        disabled={processingId === rec.recommendation_id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-stone-500" />
                        <span>Dismiss</span>
                      </button>
                      <button
                        onClick={() => handleApprove(rec.recommendation_id)}
                        disabled={processingId === rec.recommendation_id}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{processingId === rec.recommendation_id ? 'Authorizing...' : 'Review & Approve'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

