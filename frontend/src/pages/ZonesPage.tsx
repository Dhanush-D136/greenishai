import React, { useState, useEffect } from 'react';
import { 
  Sprout, 
  Plus, 
  Edit3, 
  Trash2, 
  Power, 
  Play, 
  Square, 
  Droplets, 
  Thermometer, 
  Sun, 
  CloudRain, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Cpu, 
  Sliders, 
  Clock, 
  ShieldCheck, 
  ArrowLeft,
  Calendar,
  Layers,
  MapPin,
  FileText,
  Activity,
  Sparkles,
  GitBranch
} from 'lucide-react';
import { api } from '../services/api';
import { IrrigationZone, ZoneDetail, SensorReading, IrrigationEvent, SystemMode } from '../types';
import { PlantLayoutDesigner } from '../components/PlantLayoutDesigner';
import { GardenPipeDesigner } from '../components/GardenPipeDesigner';
import { AIForecastCard } from '../components/AIForecastCard';
import { WaterEfficiencyCard } from '../components/WaterEfficiencyCard';
import { AIAnomalyList } from '../components/AIAnomalyList';
import { AIRecommendationsCard } from '../components/AIRecommendationsCard';

interface ZonesPageProps {
  systemMode?: SystemMode;
}

export const ZonesPage: React.FC<ZonesPageProps> = ({ systemMode = 'SIMULATION' }) => {
  const [zones, setZones] = useState<IrrigationZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [zoneDetail, setZoneDetail] = useState<ZoneDetail | null>(null);
  const [zoneEvents, setZoneEvents] = useState<IrrigationEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PLANNER' | 'PIPE_DESIGNER' | 'AI_INSIGHTS'>('OVERVIEW');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [zoneToDelete, setZoneToDelete] = useState<IrrigationZone | null>(null);

  // Form State
  const [formZoneId, setFormZoneId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formPlantCategories, setFormPlantCategories] = useState<string>('Vegetables');
  const [formTargetMoisture, setFormTargetMoisture] = useState<number>(70);
  const [formDryThreshold, setFormDryThreshold] = useState<number>(35);
  const [formMaxRuntime, setFormMaxRuntime] = useState<number>(300);
  const [formCooldown, setFormCooldown] = useState<number>(30);
  const [formAutonomy, setFormAutonomy] = useState<boolean>(true);
  const [formNotes, setFormNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const data = await api.getZones();
      setZones(data);
    } catch (err: any) {
      console.error('Failed to load zones', err);
      setNotification({ type: 'error', text: 'Failed to load zones list.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchZoneDetail = async (zoneId: string) => {
    try {
      setDetailLoading(true);
      const [detailData, eventsData] = await Promise.all([
        api.getZoneDetail(zoneId),
        api.getIrrigationEvents(10, systemMode)
      ]);
      setZoneDetail(detailData);
      setZoneEvents(eventsData);
    } catch (err: any) {
      console.error('Failed to load zone detail', err);
      setNotification({ type: 'error', text: 'Failed to load zone details.' });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  useEffect(() => {
    if (selectedZoneId) {
      fetchZoneDetail(selectedZoneId);
    } else {
      setZoneDetail(null);
    }
  }, [selectedZoneId, systemMode]);

  // Autonomy Toggle Per Zone
  const handleToggleAutonomy = async (e: React.MouseEvent, zone: IrrigationZone) => {
    e.stopPropagation();
    const newStatus = !zone.auto_irrigation_enabled;
    try {
      await api.toggleZoneAutonomy(zone.zone_id, newStatus);
      setZones(prev => prev.map(z => z.zone_id === zone.zone_id ? { ...z, auto_irrigation_enabled: newStatus } : z));
      if (zoneDetail?.zone_id === zone.zone_id) {
        setZoneDetail(prev => prev ? { ...prev, auto_irrigation_enabled: newStatus } : null);
      }
      setNotification({
        type: 'success',
        text: `Autonomy ${newStatus ? 'enabled' : 'disabled'} for ${zone.name}. Other zones remain unaffected.`
      });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to update zone autonomy.' });
    }
  };

  // Manual Zone Irrigation Actuation (with single-pump conflict prevention)
  const handleIrrigateZone = async (action: 'START' | 'STOP') => {
    if (!zoneDetail) return;
    try {
      const res = await api.irrigateZone(zoneDetail.zone_id, action, zoneDetail.max_runtime_seconds);
      setNotification({ type: 'success', text: res.message });
      await fetchZoneDetail(zoneDetail.zone_id);
      await fetchZones();
    } catch (err: any) {
      setNotification({
        type: 'error',
        text: err.message || 'Failed to actuate zone irrigation.'
      });
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    const nextIdx = zones.length + 1;
    setFormZoneId(`zone-0${nextIdx}`);
    setFormName(`Zone ${String.fromCharCode(64 + nextIdx)} — Growing Bed`);
    setFormDescription('Independent agricultural growing zone with dedicated plant requirements');
    setFormLocation('Field Sector');
    setFormPlantCategories('Vegetables, Herbs');
    setFormTargetMoisture(70);
    setFormDryThreshold(35);
    setFormMaxRuntime(300);
    setFormCooldown(30);
    setFormAutonomy(true);
    setFormNotes('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (e: React.MouseEvent, zone: IrrigationZone) => {
    e.stopPropagation();
    setFormZoneId(zone.zone_id);
    setFormName(zone.name);
    setFormDescription(zone.description || '');
    setFormLocation(zone.location || '');
    setFormPlantCategories(zone.plant_categories || 'Vegetables');
    setFormTargetMoisture(zone.soil_moisture_target);
    setFormDryThreshold(zone.soil_moisture_dry_threshold);
    setFormMaxRuntime(zone.max_runtime_seconds);
    setFormCooldown(zone.cooldown_minutes);
    setFormAutonomy(zone.auto_irrigation_enabled);
    setFormNotes(zone.notes || '');
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const openDeleteModal = (e: React.MouseEvent, zone: IrrigationZone) => {
    e.stopPropagation();
    setZoneToDelete(zone);
    setIsDeleteModalOpen(true);
  };

  // Submit Create Zone
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formDryThreshold >= formTargetMoisture) {
      setNotification({
        type: 'error',
        text: 'Target moisture must be strictly greater than dry threshold for safe hysteresis.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await api.createZone({
        zone_id: formZoneId.trim(),
        name: formName.trim(),
        description: formDescription.trim(),
        location: formLocation.trim(),
        plant_categories: formPlantCategories.trim(),
        soil_moisture_target: Number(formTargetMoisture),
        soil_moisture_dry_threshold: Number(formDryThreshold),
        max_runtime_seconds: Number(formMaxRuntime),
        cooldown_minutes: Number(formCooldown),
        auto_irrigation_enabled: formAutonomy,
        notes: formNotes.trim()
      });
      setNotification({ type: 'success', text: `Created new zone '${created.name}' successfully.` });
      setIsCreateModalOpen(false);
      await fetchZones();
      setSelectedZoneId(created.zone_id);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to create zone.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Update Zone
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formDryThreshold >= formTargetMoisture) {
      setNotification({
        type: 'error',
        text: 'Target moisture must be strictly greater than dry threshold.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await api.updateZone(formZoneId, {
        name: formName.trim(),
        description: formDescription.trim(),
        location: formLocation.trim(),
        plant_categories: formPlantCategories.trim(),
        soil_moisture_target: Number(formTargetMoisture),
        soil_moisture_dry_threshold: Number(formDryThreshold),
        max_runtime_seconds: Number(formMaxRuntime),
        cooldown_minutes: Number(formCooldown),
        auto_irrigation_enabled: formAutonomy,
        notes: formNotes.trim()
      });
      setNotification({ type: 'success', text: `Zone '${updated.name}' updated successfully.` });
      setIsEditModalOpen(false);
      await fetchZones();
      if (selectedZoneId === updated.zone_id) {
        await fetchZoneDetail(updated.zone_id);
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to update zone.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete Zone
  const handleDeleteConfirm = async () => {
    if (!zoneToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await api.deleteZone(zoneToDelete.zone_id);
      setNotification({ type: 'success', text: res.message });
      setIsDeleteModalOpen(false);
      setZoneToDelete(null);
      if (selectedZoneId === zoneToDelete.zone_id) {
        setSelectedZoneId(null);
      }
      await fetchZones();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to delete zone.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-10 max-w-6xl mx-auto">
      
      {/* Page Title & Add Zone Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27342C] font-['Outfit']">
              Zone-Wise Irrigation Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E7EFE4] text-[#244B36] border border-[#A9BBA0]/40">
              {zones.length} {zones.length === 1 ? 'Zone' : 'Zones'} Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#778078] mt-1">
            Independently manage target moisture, plant requirements, and automated watering schedules per zone.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedZoneId && (
            <button
              onClick={() => setSelectedZoneId(null)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#A9BBA0]/40 text-[#244B36] text-xs font-semibold hover:bg-[#FAF8F1] transition-colors shadow-xs min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Zones List</span>
            </button>
          )}

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#244B36] text-white text-xs font-bold hover:bg-[#1a3828] transition-colors shadow-xs cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Zone</span>
          </button>
        </div>
      </div>

      {/* Hardware Limitation Notice */}
      <div className="p-4 rounded-2xl bg-white border border-[#A9BBA0]/40 shadow-xs flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#557A52] shrink-0 mt-0.5" />
        <div className="text-xs text-[#27342C] space-y-1">
          <span className="font-bold text-[#244B36] block">Physical Hardware Safety & Multi-Zone Policy</span>
          <p className="text-[#778078] leading-relaxed">
            The farm hardware operates one submersible motor pump. Each software zone retains its own independent target thresholds and plant water profiles. If a zone is actively irrigating, other zones are automatically locked to prevent conflicting commands from operating the same pump.
          </p>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
          notification.type === 'success'
            ? 'bg-[#E7EFE4] border-[#557A52]/40 text-[#244B36]'
            : notification.type === 'error'
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* VIEW 1: ZONES LIST (CARDS) */}
      {!selectedZoneId ? (
        <div className="space-y-5">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#778078] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#244B36]" />
              <span>Loading Zone Profiles...</span>
            </div>
          ) : zones.length === 0 ? (
            <div className="p-12 rounded-3xl glass-panel text-center space-y-3">
              <Sprout className="w-10 h-10 text-[#557A52] mx-auto opacity-60" />
              <h3 className="font-bold text-sm text-[#27342C]">No Irrigation Zones Configured</h3>
              <p className="text-xs text-[#778078]">Click "Add Zone" above to create your first independent irrigation zone.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {zones.map((zone) => (
                <div
                  key={zone.zone_id}
                  onClick={() => setSelectedZoneId(zone.zone_id)}
                  className="rounded-3xl glass-panel p-5 sm:p-6 border border-[#A9BBA0]/40 shadow-sm hover:shadow-xl hover:bg-white transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-[#E7EFE4] flex items-center justify-center text-[#244B36] group-hover:scale-105 transition-transform">
                          <Sprout className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm sm:text-base text-[#27342C] group-hover:text-[#244B36] transition-colors">
                            {zone.name}
                          </h3>
                          <code className="text-[10px] text-[#778078] font-mono">{zone.zone_id}</code>
                        </div>
                      </div>
                      
                      {/* Active Pump State Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        zone.current_pump_state === 'RUNNING'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {zone.current_pump_state === 'RUNNING' ? 'WATERING' : 'IDLE'}
                      </span>
                    </div>

                    <p className="text-xs text-[#778078] line-clamp-2">
                      {zone.description || 'Configured irrigation sector with dedicated moisture goals.'}
                    </p>

                    {/* Zone Metrics Grid */}
                    <div className="p-3 rounded-2xl bg-[#FAF8F1] border border-[#A9BBA0]/30 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[#778078] uppercase block">Target Moisture</span>
                        <span className="font-extrabold text-[#244B36]">{zone.soil_moisture_target}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#778078] uppercase block">Dry Trigger</span>
                        <span className="font-extrabold text-[#C58A32]">{zone.soil_moisture_dry_threshold}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#778078] uppercase block">Plants In Layout</span>
                        <span className="font-semibold text-[#27342C]">{zone.plant_count} plants</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#778078] uppercase block">Controller</span>
                        <span className="font-mono text-[11px] text-[#27342C]">{zone.controller_device_id}</span>
                      </div>
                    </div>

                    {/* Autonomy Switch Per Zone */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#27342C]">Autonomous Mode:</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          zone.auto_irrigation_enabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {zone.auto_irrigation_enabled ? 'ENABLED' : 'MANUAL ONLY'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleToggleAutonomy(e, zone)}
                        className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                          zone.auto_irrigation_enabled ? 'bg-[#244B36] justify-end' : 'bg-zinc-300 justify-start'
                        }`}
                        title="Toggle autonomy for this zone"
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                      </button>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-[#A9BBA0]/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#244B36] hover:underline">
                      Open Designer & Detail →
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => openEditModal(e, zone)}
                        className="p-1.5 rounded-lg hover:bg-[#FAF8F1] text-[#778078] hover:text-[#244B36]"
                        title="Edit Zone Settings"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openDeleteModal(e, zone)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-[#778078] hover:text-rose-600"
                        title="Delete Zone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: ZONE DETAIL & VISUAL DESIGNER */
        <div className="space-y-6">
          {detailLoading || !zoneDetail ? (
            <div className="p-12 text-center text-xs text-[#778078] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#244B36]" />
              <span>Loading Zone Detail...</span>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Zone Overview Banner */}
              <div className="rounded-3xl glass-panel p-5 sm:p-6 shadow-sm border border-[#A9BBA0]/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl sm:text-2xl font-black text-[#27342C] font-['Outfit']">
                        {zoneDetail.name}
                      </h2>
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-[#FAF8F1] text-[#778078] border border-[#A9BBA0]/30">
                        {zoneDetail.zone_id}
                      </span>
                    </div>
                    <p className="text-xs text-[#778078] mt-1">{zoneDetail.description}</p>
                  </div>

                  {/* Sub-menu Tabs: Overview vs Plant Layout Designer vs Pipe Network vs AI Insights */}
                  <div className="flex flex-wrap rounded-2xl bg-white border border-[#A9BBA0]/40 p-1 shadow-xs gap-1">
                    <button
                      onClick={() => setActiveTab('OVERVIEW')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
                        activeTab === 'OVERVIEW' ? 'bg-[#244B36] text-white shadow-xs' : 'text-[#778078] hover:text-[#244B36]'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Zone Telemetry</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('PLANNER')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
                        activeTab === 'PLANNER' ? 'bg-[#244B36] text-white shadow-xs' : 'text-[#778078] hover:text-[#244B36]'
                      }`}
                    >
                      <Sprout className="w-3.5 h-3.5" />
                      <span>Plant Beds</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('PIPE_DESIGNER')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
                        activeTab === 'PIPE_DESIGNER' ? 'bg-[#244B36] text-white shadow-xs' : 'text-[#778078] hover:text-[#244B36]'
                      }`}
                    >
                      <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Pipe & Motor Network</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('AI_INSIGHTS')}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
                        activeTab === 'AI_INSIGHTS' ? 'bg-[#244B36] text-white shadow-xs' : 'text-[#778078] hover:text-[#244B36]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>AI Predictive</span>
                    </button>
                  </div>
                </div>

                {/* Zone Fast Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-[#A9BBA0]/20">
                  <div className="p-3 rounded-2xl bg-white border border-[#A9BBA0]/20">
                    <span className="text-[10px] text-[#778078] uppercase block">Target Moisture</span>
                    <span className="text-lg font-black text-[#244B36]">{zoneDetail.soil_moisture_target}%</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-[#A9BBA0]/20">
                    <span className="text-[10px] text-[#778078] uppercase block">Dry Trigger</span>
                    <span className="text-lg font-black text-[#C58A32]">{zoneDetail.soil_moisture_dry_threshold}%</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-[#A9BBA0]/20">
                    <span className="text-[10px] text-[#778078] uppercase block">Active Pump State</span>
                    <span className="text-lg font-black text-[#27342C]">{zoneDetail.current_pump_state}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-[#A9BBA0]/20">
                    <span className="text-[10px] text-[#778078] uppercase block">Autonomy Status</span>
                    <span className="text-xs font-extrabold text-emerald-800">
                      {zoneDetail.auto_irrigation_enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* TAB 1: TELEMETRY & ZONE PUMP ACTUATION */}
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-6">
                  
                  {/* Manual Zone Pump Control Bar */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#A9BBA0]/40 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-[#778078] uppercase tracking-wider block">Zone Irrigation Control</span>
                      <h3 className="font-extrabold text-base text-[#27342C]">Direct Zone Actuation</h3>
                      <p className="text-xs text-[#778078]">Safely triggers watering for {zoneDetail.name} respecting runtime safety limits.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {zoneDetail.current_pump_state === 'RUNNING' ? (
                        <button
                          onClick={() => handleIrrigateZone('STOP')}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 shadow-sm min-h-[44px]"
                        >
                          <Square className="w-4 h-4" />
                          <span>Stop Watering</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleIrrigateZone('START')}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#244B36] text-white font-bold text-xs hover:bg-[#1a3828] shadow-sm min-h-[44px]"
                        >
                          <Play className="w-4 h-4" />
                          <span>Start Zone Irrigation</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Telemetry Display */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="p-5 rounded-3xl bg-white border border-[#A9BBA0]/30 shadow-xs space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#244B36]">
                        <Droplets className="w-4 h-4 text-blue-600" />
                        <span>Soil Moisture Telemetry</span>
                      </div>
                      <div className="text-2xl font-black text-[#27342C]">
                        {zoneDetail.latest_reading?.soil_moisture_percent !== undefined
                          ? `${zoneDetail.latest_reading.soil_moisture_percent.toFixed(1)}%`
                          : 'No data'}
                      </div>
                      <span className="text-[10px] text-[#778078] block">
                        Calibrated ADC: {zoneDetail.latest_reading?.soil_moisture_raw || 2300} raw
                      </span>
                    </div>

                    <div className="p-5 rounded-3xl bg-white border border-[#A9BBA0]/30 shadow-xs space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#244B36]">
                        <Thermometer className="w-4 h-4 text-rose-600" />
                        <span>Atmospheric Readings</span>
                      </div>
                      <div className="text-2xl font-black text-[#27342C]">
                        {zoneDetail.latest_reading?.temperature_c !== undefined
                          ? `${zoneDetail.latest_reading.temperature_c.toFixed(1)}°C`
                          : '24.5°C'}
                      </div>
                      <span className="text-[10px] text-[#778078] block">
                        Humidity: {zoneDetail.latest_reading?.humidity_percent || 60}% RH
                      </span>
                    </div>

                    <div className="p-5 rounded-3xl bg-white border border-[#A9BBA0]/30 shadow-xs space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#244B36]">
                        <CloudRain className="w-4 h-4 text-cyan-600" />
                        <span>Weather & Rain Status</span>
                      </div>
                      <div className="text-2xl font-black text-[#27342C]">
                        {zoneDetail.latest_reading?.rain_detected ? 'Rain Detected' : 'Dry Surface'}
                      </div>
                      <span className="text-[10px] text-[#778078] block">
                        Precipitation safety pause: Active
                      </span>
                    </div>
                  </div>

                  {/* Recent Zone Events Table */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#A9BBA0]/40 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm sm:text-base text-[#27342C]">Recent Irrigation Cycles for {zoneDetail.name}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#A9BBA0]/30 text-[#778078] uppercase text-[10px]">
                            <th className="py-2.5 px-3">Start Time</th>
                            <th className="py-2.5 px-3">Trigger Type</th>
                            <th className="py-2.5 px-3">Action</th>
                            <th className="py-2.5 px-3">Duration</th>
                            <th className="py-2.5 px-3">Moisture Delta</th>
                            <th className="py-2.5 px-3">Decision Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#A9BBA0]/20">
                          {zoneEvents.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-[#778078]">No past irrigation events logged.</td>
                            </tr>
                          ) : (
                            zoneEvents.slice(0, 5).map(ev => (
                              <tr key={ev.id} className="hover:bg-[#FAF8F1]">
                                <td className="py-3 px-3 font-mono text-[11px] text-[#778078]">
                                  {new Date(ev.start_time).toLocaleTimeString()}
                                </td>
                                <td className="py-3 px-3 font-semibold">{ev.trigger_type}</td>
                                <td className="py-3 px-3">
                                  <span className="font-bold text-[#244B36]">{ev.action}</span>
                                </td>
                                <td className="py-3 px-3">{ev.duration_seconds ? `${ev.duration_seconds}s` : 'In progress'}</td>
                                <td className="py-3 px-3 font-mono text-[11px]">
                                  {ev.start_soil_moisture ? `${ev.start_soil_moisture}% → ${ev.end_soil_moisture || '--'}%` : '--'}
                                </td>
                                <td className="py-3 px-3 text-[#778078] truncate max-w-xs">{ev.reason || 'Manual trigger'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: VISUAL PLANT LAYOUT & WATER PLANNING */}
              {activeTab === 'PLANNER' && (
                <PlantLayoutDesigner
                  zoneId={zoneDetail.zone_id}
                  zoneName={zoneDetail.name}
                  onZoneSettingsApplied={(newTarget, newDry) => {
                    setZoneDetail(prev => prev ? { ...prev, soil_moisture_target: newTarget, soil_moisture_dry_threshold: newDry } : null);
                    fetchZones();
                  }}
                />
              )}

              {/* TAB 3: SMART GARDEN PIPE & MOTOR DESIGNER */}
              {activeTab === 'PIPE_DESIGNER' && (
                <GardenPipeDesigner
                  zoneId={zoneDetail.zone_id}
                  zoneName={zoneDetail.name}
                  systemMode={systemMode}
                  isPumpRunning={zoneDetail.current_pump_state === 'RUNNING'}
                  onZoneSettingsApplied={(newTarget, newDry) => {
                    setZoneDetail(prev => prev ? { ...prev, soil_moisture_target: newTarget, soil_moisture_dry_threshold: newDry } : null);
                    fetchZones();
                  }}
                />
              )}

              {/* TAB 4: AI PREDICTIVE INTELLIGENCE & WATER OPTIMIZATION */}
              {activeTab === 'AI_INSIGHTS' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AIForecastCard
                      zoneId={zoneDetail.zone_id}
                      zoneName={zoneDetail.name}
                      targetMoisture={zoneDetail.soil_moisture_target}
                      dryThreshold={zoneDetail.soil_moisture_dry_threshold}
                    />
                    <WaterEfficiencyCard
                      zoneId={zoneDetail.zone_id}
                      zoneName={zoneDetail.name}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AIRecommendationsCard
                      zoneId={zoneDetail.zone_id}
                      zoneName={zoneDetail.name}
                      onActionComplete={() => {
                        fetchZones();
                      }}
                    />
                    <AIAnomalyList zoneId={zoneDetail.zone_id} limit={10} />
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* CREATE ZONE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FAF8F1] w-full max-w-lg rounded-3xl shadow-2xl border border-[#A9BBA0]/40 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#A9BBA0]/30 flex items-center justify-between bg-[#E7EFE4]">
              <h3 className="font-extrabold text-base text-[#27342C]">Create New Irrigation Zone</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-white text-[#778078]">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Zone ID (Unique)</label>
                  <input
                    type="text"
                    required
                    value={formZoneId}
                    onChange={(e) => setFormZoneId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white font-mono"
                    placeholder="e.g. zone-02"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Zone Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white"
                    placeholder="e.g. Zone B — Herb Garden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Description & Location</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white mb-2"
                  placeholder="Zone description"
                />
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white"
                  placeholder="Location (e.g. East Field Plot 3)"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Plant Categories</label>
                <input
                  type="text"
                  value={formPlantCategories}
                  onChange={(e) => setFormPlantCategories(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white"
                  placeholder="e.g. Vegetables, Berries, Herbs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Dry Threshold (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="80"
                    value={formDryThreshold}
                    onChange={(e) => setFormDryThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white font-mono"
                  />
                  <span className="text-[10px] text-[#778078]">Watering begins below this</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Target Moisture (%)</label>
                  <input
                    type="number"
                    min="20"
                    max="95"
                    value={formTargetMoisture}
                    onChange={(e) => setFormTargetMoisture(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white font-mono font-bold text-[#244B36]"
                  />
                  <span className="text-[10px] text-[#778078]">Watering stops at this</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#A9BBA0]/30">
                <div>
                  <span className="font-bold text-xs text-[#27342C] block">Autonomous Irrigation</span>
                  <span className="text-[10px] text-[#778078]">Allow rule engine to irrigate this zone automatically</span>
                </div>
                <input
                  type="checkbox"
                  checked={formAutonomy}
                  onChange={(e) => setFormAutonomy(e.target.checked)}
                  className="w-5 h-5 text-[#244B36] rounded"
                />
              </div>

              <div className="pt-4 border-t border-[#A9BBA0]/20 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs font-semibold text-[#778078] min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-[#244B36] text-white text-xs font-bold hover:bg-[#1a3828] min-h-[44px]"
                >
                  {isSubmitting ? 'Creating...' : 'Create Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ZONE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FAF8F1] w-full max-w-lg rounded-3xl shadow-2xl border border-[#A9BBA0]/40 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#A9BBA0]/30 flex items-center justify-between bg-[#E7EFE4]">
              <h3 className="font-extrabold text-base text-[#27342C]">Edit Zone Configuration</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg hover:bg-white text-[#778078]">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Zone Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Plant Categories</label>
                <input
                  type="text"
                  value={formPlantCategories}
                  onChange={(e) => setFormPlantCategories(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Dry Threshold (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="80"
                    value={formDryThreshold}
                    onChange={(e) => setFormDryThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Target Moisture (%)</label>
                  <input
                    type="number"
                    min="20"
                    max="95"
                    value={formTargetMoisture}
                    onChange={(e) => setFormTargetMoisture(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white font-mono font-bold text-[#244B36]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#A9BBA0]/30">
                <div>
                  <span className="font-bold text-xs text-[#27342C] block">Autonomous Irrigation</span>
                  <span className="text-[10px] text-[#778078]">Enable or disable automated decision rules for this zone</span>
                </div>
                <input
                  type="checkbox"
                  checked={formAutonomy}
                  onChange={(e) => setFormAutonomy(e.target.checked)}
                  className="w-5 h-5 text-[#244B36] rounded cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-[#A9BBA0]/20 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs font-semibold text-[#778078] min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl bg-[#244B36] text-white text-xs font-bold hover:bg-[#1a3828] min-h-[44px]"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {isDeleteModalOpen && zoneToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FAF8F1] w-full max-w-md rounded-3xl shadow-2xl border border-rose-300 overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#27342C]">Delete Zone Confirmation</h3>
                <span className="text-xs text-[#778078]">This action cannot be undone.</span>
              </div>
            </div>

            <p className="text-xs text-[#27342C] leading-relaxed">
              Are you sure you want to delete <strong>{zoneToDelete.name}</strong> (<code className="font-mono text-[#778078]">{zoneToDelete.zone_id}</code>)?
              This will safely remove its plant layout and zone settings while preserving historical sensor logs.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#A9BBA0]/20">
              <button
                type="button"
                onClick={() => { setIsDeleteModalOpen(false); setZoneToDelete(null); }}
                className="px-4 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs font-semibold text-[#778078] min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 min-h-[44px]"
              >
                {isSubmitting ? 'Deleting...' : 'Yes, Delete Zone'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

