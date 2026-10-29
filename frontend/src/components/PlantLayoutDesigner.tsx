import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Edit3, 
  Save, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  AlertTriangle, 
  CheckCircle2, 
  Droplet, 
  Droplets, 
  HelpCircle, 
  Move, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Info,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { ZonePlant, WaterCategory, ZonePlanCalculation } from '../types';

interface PlantLayoutDesignerProps {
  zoneId: string;
  zoneName: string;
  onZoneSettingsApplied?: (targetMoisture: number, dryThreshold: number) => void;
}

const PLANT_PRESETS: Array<{ name: string; category: WaterCategory; min: number; max: number; target: number; notes: string }> = [
  { name: 'Tomato', category: 'MEDIUM', min: 50, max: 75, target: 65, notes: 'Requires consistent moisture during fruit set' },
  { name: 'Lettuce', category: 'HIGH', min: 65, max: 85, target: 80, notes: 'Shallow root system; sensitive to soil drying' },
  { name: 'Spinach', category: 'HIGH', min: 60, max: 85, target: 75, notes: 'Moisture lover; prefers cool damp soil' },
  { name: 'Bell Pepper', category: 'MEDIUM', min: 45, max: 70, target: 60, notes: 'Moderate water requirements; well-drained soil' },
  { name: 'Basil', category: 'MEDIUM', min: 45, max: 70, target: 60, notes: 'Warm season culinary herb' },
  { name: 'Rosemary', category: 'LOW', min: 25, max: 45, target: 35, notes: 'Drought-hardy woody perennial' },
  { name: 'Cactus', category: 'LOW', min: 15, max: 35, target: 25, notes: 'Arid succulent; root rot risk if overwatered' },
  { name: 'Lavender', category: 'LOW', min: 20, max: 40, target: 30, notes: 'Prefers dry to medium soil with fast drainage' },
  { name: 'Strawberry', category: 'HIGH', min: 60, max: 80, target: 72, notes: 'Needs regular moisture for sweet plump berries' }
];

export const PlantLayoutDesigner: React.FC<PlantLayoutDesignerProps> = ({
  zoneId,
  zoneName,
  onZoneSettingsApplied
}) => {
  const [plants, setPlants] = useState<ZonePlant[]>([]);
  const [initialPlants, setInitialPlants] = useState<ZonePlant[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [calculation, setCalculation] = useState<ZonePlanCalculation | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [editingPlant, setEditingPlant] = useState<Partial<ZonePlant>>({
    plant_name: '',
    water_category: 'MEDIUM',
    desired_moisture_min: 50,
    desired_moisture_max: 75,
    target_moisture: 65,
    notes: '',
    pos_x: 60,
    pos_y: 60
  });

  // Canvas interaction refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const loadPlantsAndPlan = async () => {
    try {
      setLoading(true);
      const [plantsData, planData] = await Promise.all([
        api.getZonePlants(zoneId),
        api.calculateZonePlan(zoneId)
      ]);
      setPlants(plantsData);
      setInitialPlants(JSON.parse(JSON.stringify(plantsData)));
      setCalculation(planData);
      setHasUnsavedChanges(false);
      if (plantsData.length > 0 && selectedPlantId === null) {
        setSelectedPlantId(plantsData[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load zone plant layout', err);
      setNotification({ type: 'error', text: 'Failed to load plant layout data from backend.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlantsAndPlan();
  }, [zoneId]);

  // Handle Save Layout
  const handleSaveLayout = async () => {
    setSaving(true);
    setNotification(null);
    try {
      await api.saveBulkLayout(zoneId, plants);
      const updatedPlan = await api.calculateZonePlan(zoneId);
      setCalculation(updatedPlan);
      setInitialPlants(JSON.parse(JSON.stringify(plants)));
      setHasUnsavedChanges(false);
      setNotification({ type: 'success', text: `Plant layout saved successfully for ${zoneName}.` });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to save layout.' });
    } finally {
      setSaving(false);
    }
  };

  // Undo Unsaved Changes
  const handleUndo = () => {
    setPlants(JSON.parse(JSON.stringify(initialPlants)));
    setHasUnsavedChanges(false);
    setNotification({ type: 'info', text: 'Unsaved canvas changes reverted.' });
  };

  // Apply Calculated Plan to Zone Irrigation Settings
  const handleApplyPlan = async () => {
    if (!calculation) return;
    try {
      const res = await api.applyZonePlan(
        zoneId,
        calculation.calculated_target_moisture,
        calculation.calculated_dry_threshold
      );
      setNotification({
        type: 'success',
        text: `Applied plan to ${zoneName}! Target: ${res.soil_moisture_target}%, Dry Trigger: ${res.soil_moisture_dry_threshold}%.`
      });
      onZoneSettingsApplied?.(res.soil_moisture_target, res.soil_moisture_dry_threshold);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to apply plan to zone settings.' });
    }
  };

  // Plant Movement (Desktop & Mobile Touch)
  const handleMove = (deltaX: number, deltaY: number) => {
    if (selectedPlantId === null) return;
    setPlants(prev => prev.map(p => {
      if (p.id === selectedPlantId) {
        const newX = Math.max(10, Math.min(600, p.pos_x + deltaX));
        const newY = Math.max(10, Math.min(420, p.pos_y + deltaY));
        return { ...p, pos_x: newX, pos_y: newY };
      }
      return p;
    }));
    setHasUnsavedChanges(true);
  };

  // Duplicate Selected Plant
  const handleDuplicate = () => {
    const target = plants.find(p => p.id === selectedPlantId);
    if (!target) return;
    const newPlant: ZonePlant = {
      ...target,
      id: Date.now(), // Temporary client ID until saved
      plant_name: `${target.plant_name} (Copy)`,
      pos_x: Math.min(550, target.pos_x + 30),
      pos_y: Math.min(380, target.pos_y + 30),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setPlants(prev => [...prev, newPlant]);
    setSelectedPlantId(newPlant.id);
    setHasUnsavedChanges(true);
  };

  // Delete Selected Plant
  const handleDeleteSelected = () => {
    if (selectedPlantId === null) return;
    const target = plants.find(p => p.id === selectedPlantId);
    if (!target) return;
    if (confirm(`Remove plant "${target.plant_name}" from layout?`)) {
      setPlants(prev => prev.filter(p => p.id !== selectedPlantId));
      setSelectedPlantId(null);
      setHasUnsavedChanges(true);
    }
  };

  // Mouse / Touch Dragging
  const handlePointerDown = (e: React.PointerEvent, plant: ZonePlant) => {
    e.stopPropagation();
    setSelectedPlantId(plant.id);
    setDraggingId(plant.id);
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      setDragOffset({
        x: (e.clientX - canvasRect.left) / zoomLevel - plant.pos_x,
        y: (e.clientY - canvasRect.top) / zoomLevel - plant.pos_y
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingId === null || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const rawX = (e.clientX - canvasRect.left) / zoomLevel - dragOffset.x;
    const rawY = (e.clientY - canvasRect.top) / zoomLevel - dragOffset.y;
    const boundedX = Math.max(10, Math.min(580, Math.round(rawX / 5) * 5));
    const boundedY = Math.max(10, Math.min(420, Math.round(rawY / 5) * 5));

    setPlants(prev => prev.map(p => (p.id === draggingId ? { ...p, pos_x: boundedX, pos_y: boundedY } : p)));
    setHasUnsavedChanges(true);
  };

  const handlePointerUp = () => {
    setDraggingId(null);
  };

  // Preset Selection in Modal
  const handleSelectPreset = (presetName: string) => {
    const found = PLANT_PRESETS.find(p => p.name === presetName);
    if (found) {
      setEditingPlant(prev => ({
        ...prev,
        plant_name: found.name,
        water_category: found.category,
        desired_moisture_min: found.min,
        desired_moisture_max: found.max,
        target_moisture: found.target,
        notes: found.notes
      }));
    }
  };

  // Modal Submit
  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlant.plant_name?.trim()) return;

    if (modalMode === 'ADD') {
      const newPlant: ZonePlant = {
        id: Date.now(),
        zone_id: zoneId,
        plant_name: editingPlant.plant_name.trim(),
        water_category: editingPlant.water_category || 'MEDIUM',
        desired_moisture_min: Number(editingPlant.desired_moisture_min) || 50,
        desired_moisture_max: Number(editingPlant.desired_moisture_max) || 75,
        target_moisture: Number(editingPlant.target_moisture) || 65,
        pos_x: editingPlant.pos_x || 60,
        pos_y: editingPlant.pos_y || 60,
        width: 140,
        height: 100,
        notes: editingPlant.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setPlants(prev => [...prev, newPlant]);
      setSelectedPlantId(newPlant.id);
    } else {
      setPlants(prev => prev.map(p => {
        if (p.id === selectedPlantId) {
          return {
            ...p,
            plant_name: editingPlant.plant_name?.trim() || p.plant_name,
            water_category: editingPlant.water_category || p.water_category,
            desired_moisture_min: Number(editingPlant.desired_moisture_min) || p.desired_moisture_min,
            desired_moisture_max: Number(editingPlant.desired_moisture_max) || p.desired_moisture_max,
            target_moisture: Number(editingPlant.target_moisture) || p.target_moisture,
            notes: editingPlant.notes || ''
          };
        }
        return p;
      }));
    }

    setHasUnsavedChanges(true);
    setIsEditModalOpen(false);
  };

  const openAddModal = () => {
    setModalMode('ADD');
    setEditingPlant({
      plant_name: 'Tomato',
      water_category: 'MEDIUM',
      desired_moisture_min: 50,
      desired_moisture_max: 75,
      target_moisture: 65,
      notes: 'Requires consistent moisture during fruit set',
      pos_x: Math.floor(Math.random() * 200) + 40,
      pos_y: Math.floor(Math.random() * 150) + 40
    });
    setIsEditModalOpen(true);
  };

  const openEditModal = () => {
    const target = plants.find(p => p.id === selectedPlantId);
    if (!target) return;
    setModalMode('EDIT');
    setEditingPlant({ ...target });
    setIsEditModalOpen(true);
  };

  // Colorblind-accessible styling helpers
  const getCategoryTheme = (category: WaterCategory) => {
    switch (category) {
      case 'HIGH':
        return {
          bg: 'bg-emerald-50',
          border: 'border-2 border-emerald-600',
          badge: 'bg-emerald-700 text-white',
          icon: <Droplets className="w-3.5 h-3.5 text-emerald-800" />,
          label: 'High Water',
          symbol: '💧💧💧'
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-50',
          border: 'border-2 border-dashed border-amber-600',
          badge: 'bg-amber-700 text-white',
          icon: <Droplet className="w-3.5 h-3.5 text-amber-800" />,
          label: 'Medium Water',
          symbol: '💧💧'
        };
      case 'LOW':
      default:
        return {
          bg: 'bg-stone-50',
          border: 'border-2 border-dotted border-stone-600',
          badge: 'bg-stone-700 text-white',
          icon: <Droplet className="w-3.5 h-3.5 text-stone-600" />,
          label: 'Low Water',
          symbol: '💧'
        };
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-[#778078] flex items-center justify-center gap-2">
        <RotateCcw className="w-4 h-4 animate-spin text-[#244B36]" />
        <span>Loading Interactive Growing Area & Plant Layout...</span>
      </div>
    );
  }

  const selectedPlant = plants.find(p => p.id === selectedPlantId);

  return (
    <div className="space-y-6">
      
      {/* Header & Section Title */}
      <div className="p-5 rounded-3xl bg-white border border-[#A9BBA0]/40 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-extrabold text-[#27342C] font-['Outfit']">
              Plant Layout & Water Planning — {zoneName}
            </h2>
          </div>
          <p className="text-xs text-[#778078] mt-1">
            Visually arrange crops, specify watering profiles, and calculate zone-wide soil moisture targets.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#244B36] text-white text-xs font-bold hover:bg-[#1a3828] transition-colors shadow-xs cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Plant</span>
          </button>
          
          <button
            onClick={handleSaveLayout}
            disabled={saving || !hasUnsavedChanges}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs min-h-[44px] ${
              hasUnsavedChanges
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer animate-pulse'
                : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Layout'}</span>
          </button>

          {hasUnsavedChanges && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#A9BBA0]/40 text-[#778078] hover:text-[#244B36] text-xs font-semibold hover:bg-[#FAF8F1] transition-colors shadow-xs min-h-[44px]"
              title="Undo unsaved changes"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}
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

      {/* Incompatible Water Requirement Alert Banner */}
      {calculation?.has_conflict && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
            <span>Water Requirement Conflict Detected</span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed">
            {calculation.conflict_warning}
          </p>
          <div className="p-2.5 rounded-xl bg-white/70 border border-amber-200 text-[11px] text-amber-800">
            <strong>Physical Hardware Notice:</strong> SmartIrrigate controls a single shared pump and soil probe for this zone. It cannot water thirsty crops (e.g. Lettuce) without also wetting drought-sensitive plants (e.g. Cactus).
          </div>
        </div>
      )}

      {/* Colorblind-Accessible Legend */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#A9BBA0]/30 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-[#27342C]">
          <Info className="w-4 h-4 text-[#557A52]" />
          <span>Water Requirement Legend:</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-600 border border-emerald-700" />
            <span className="font-semibold text-emerald-900">💧💧💧 High (65-85%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400 border border-dashed border-amber-600" />
            <span className="font-semibold text-amber-900">💧💧 Medium (45-70%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-stone-400 border border-dotted border-stone-600" />
            <span className="font-semibold text-stone-800">💧 Low (15-40%)</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="relative rounded-3xl bg-[#FAF8F1] border-2 border-[#A9BBA0]/50 shadow-inner overflow-hidden">
        
        {/* Canvas Toolbar Header */}
        <div className="p-3 bg-white/90 backdrop-blur-xs border-b border-[#A9BBA0]/30 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#244B36] uppercase tracking-wider text-[11px]">Growing Area Grid</span>
            <span className="text-[#778078]">({plants.length} plant elements)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.1))}
              className="p-1.5 rounded-lg bg-[#FAF8F1] border border-[#A9BBA0]/40 text-[#27342C] hover:bg-[#E7EFE4]"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono font-bold w-12 text-center text-[#27342C]">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
              className="p-1.5 rounded-lg bg-[#FAF8F1] border border-[#A9BBA0]/40 text-[#27342C] hover:bg-[#E7EFE4]"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 rounded-lg bg-[#FAF8F1] border border-[#A9BBA0]/40 text-[#27342C] hover:bg-[#E7EFE4]"
              title="Reset Zoom / Fit Screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Visual Growing Canvas */}
        <div
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-full h-[480px] sm:h-[520px] overflow-auto select-none p-4"
          style={{
            backgroundImage: `
              radial-gradient(circle, rgba(85, 122, 82, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px'
          }}
        >
          <div 
            className="relative w-[750px] h-[480px] origin-top-left transition-transform duration-75"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {plants.map((plant) => {
              const theme = getCategoryTheme(plant.water_category);
              const isSelected = plant.id === selectedPlantId;

              return (
                <div
                  key={plant.id}
                  onPointerDown={(e) => handlePointerDown(e, plant)}
                  className={`absolute rounded-2xl p-3 shadow-md cursor-grab active:cursor-grabbing transition-shadow transition-border ${theme.bg} ${theme.border} ${
                    isSelected ? 'ring-3 ring-[#244B36] ring-offset-2 z-20 shadow-xl' : 'z-10'
                  }`}
                  style={{
                    left: `${plant.pos_x}px`,
                    top: `${plant.pos_y}px`,
                    width: `${plant.width || 140}px`,
                    minHeight: `${plant.height || 100}px`
                  }}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className="font-extrabold text-xs text-[#27342C] truncate">
                      {plant.plant_name}
                    </span>
                    <span className="text-xs shrink-0" title={theme.label}>{theme.symbol}</span>
                  </div>

                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#778078]">Water Demand:</span>
                      <span className="font-bold uppercase text-[#27342C]">{plant.water_category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#778078]">Target Moisture:</span>
                      <span className="font-extrabold text-[#244B36]">{plant.target_moisture}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#778078]">Safe Range:</span>
                      <span className="font-mono text-[#27342C]">{plant.desired_moisture_min}%-{plant.desired_moisture_max}%</span>
                    </div>
                  </div>

                  {plant.notes && (
                    <p className="mt-1.5 text-[9px] text-[#778078] line-clamp-1 italic">
                      {plant.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Plant Mobile Touch Pad & Action Bar */}
        {selectedPlant && (
          <div className="p-3 sm:p-4 bg-white border-t border-[#A9BBA0]/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#778078]">Selected Plant:</span>
              <strong className="text-sm font-bold text-[#244B36]">{selectedPlant.plant_name}</strong>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#E7EFE4] text-[#244B36] font-semibold">
                {selectedPlant.water_category} Demand
              </span>
            </div>

            {/* Mobile Touch Movement Controller */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#778078] hidden sm:inline">Position Touch Pad:</span>
              <div className="flex items-center gap-1 bg-[#FAF8F1] p-1 rounded-xl border border-[#A9BBA0]/40">
                <button
                  type="button"
                  onClick={() => handleMove(-20, 0)}
                  className="p-2 rounded-lg bg-white hover:bg-[#E7EFE4] text-[#244B36] shadow-xs min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  title="Move Left"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(0, -20)}
                  className="p-2 rounded-lg bg-white hover:bg-[#E7EFE4] text-[#244B36] shadow-xs min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  title="Move Up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(0, 20)}
                  className="p-2 rounded-lg bg-white hover:bg-[#E7EFE4] text-[#244B36] shadow-xs min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  title="Move Down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(20, 0)}
                  className="p-2 rounded-lg bg-white hover:bg-[#E7EFE4] text-[#244B36] shadow-xs min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  title="Move Right"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Edit / Duplicate / Delete Actions */}
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={openEditModal}
                  className="p-2 rounded-xl bg-white border border-[#A9BBA0]/40 text-[#244B36] hover:bg-[#E7EFE4] shadow-xs min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  title="Edit Plant Details"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDuplicate}
                  className="p-2 rounded-xl bg-white border border-[#A9BBA0]/40 text-[#244B36] hover:bg-[#E7EFE4] shadow-xs min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  title="Duplicate Plant"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="p-2 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 shadow-xs min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  title="Delete Plant"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Zone Water Requirement Analysis & Recommendation Panel */}
      {calculation && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#A9BBA0]/40 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#A9BBA0]/20">
            <div>
              <h3 className="font-extrabold text-base text-[#27342C]">Zone Irrigation Configuration Summary</h3>
              <p className="text-xs text-[#778078] mt-0.5">{calculation.explanation}</p>
            </div>
            <button
              onClick={handleApplyPlan}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#244B36] text-white text-xs font-bold hover:bg-[#1a3828] transition-colors shadow-xs cursor-pointer min-h-[44px]"
            >
              <Check className="w-4 h-4" />
              <span>Apply Plan to Zone Settings</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#FAF8F1] border border-[#A9BBA0]/30">
              <span className="text-[10px] text-[#778078] uppercase font-bold block mb-1">Recommended Target</span>
              <span className="text-xl font-extrabold text-[#244B36]">{calculation.calculated_target_moisture}%</span>
              <span className="text-[10px] text-[#778078] block mt-0.5">Stops watering pump</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F1] border border-[#A9BBA0]/30">
              <span className="text-[10px] text-[#778078] uppercase font-bold block mb-1">Recommended Dry Trigger</span>
              <span className="text-xl font-extrabold text-[#C58A32]">{calculation.calculated_dry_threshold}%</span>
              <span className="text-[10px] text-[#778078] block mt-0.5">Starts irrigation cycle</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F1] border border-[#A9BBA0]/30">
              <span className="text-[10px] text-[#778078] uppercase font-bold block mb-1">Crop Composition</span>
              <span className="text-sm font-bold text-[#27342C]">
                {calculation.high_count}H • {calculation.medium_count}M • {calculation.low_count}L
              </span>
              <span className="text-[10px] text-[#778078] block mt-0.5">{calculation.total_plants} total plants</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F1] border border-[#A9BBA0]/30">
              <span className="text-[10px] text-[#778078] uppercase font-bold block mb-1">Hardware Enforced</span>
              <span className="text-xs font-bold text-[#27342C]">1 Pump • 1 Sensor</span>
              <span className="text-[10px] text-emerald-800 block mt-0.5">Hysteresis safe</span>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Plant Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FAF8F1] w-full max-w-lg rounded-3xl shadow-2xl border border-[#A9BBA0]/40 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#A9BBA0]/30 flex items-center justify-between bg-[#E7EFE4]">
              <h3 className="font-extrabold text-base text-[#27342C]">
                {modalMode === 'ADD' ? 'Add Plant to Growing Area' : 'Edit Plant Details'}
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white text-[#778078] text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              
              {/* Presets dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Choose Preset or Custom</label>
                <select
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white text-[#27342C] focus:ring-2 focus:ring-[#244B36] focus:outline-none"
                >
                  <option value="">-- Select a validated plant preset --</option>
                  {PLANT_PRESETS.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.name} ({p.category} Demand - Target {p.target}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Plant Name</label>
                <input
                  type="text"
                  required
                  value={editingPlant.plant_name || ''}
                  onChange={(e) => setEditingPlant(prev => ({ ...prev, plant_name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white text-[#27342C] focus:ring-2 focus:ring-[#244B36] focus:outline-none"
                  placeholder="e.g. Tomato or Lettuce"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Water Requirement Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['HIGH', 'MEDIUM', 'LOW'] as WaterCategory[]).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditingPlant(prev => ({ ...prev, water_category: cat }))}
                      className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                        editingPlant.water_category === cat
                          ? 'bg-[#244B36] text-white border-[#244B36] shadow-xs'
                          : 'bg-white text-[#778078] border-[#A9BBA0]/40 hover:bg-[#FAF8F1]'
                      }`}
                    >
                      {cat === 'HIGH' ? '💧💧💧 High' : cat === 'MEDIUM' ? '💧💧 Medium' : '💧 Low'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Min Moisture (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="90"
                    value={editingPlant.desired_moisture_min || 40}
                    onChange={(e) => setEditingPlant(prev => ({ ...prev, desired_moisture_min: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Target Moisture (%)</label>
                  <input
                    type="number"
                    min="20"
                    max="95"
                    value={editingPlant.target_moisture || 65}
                    onChange={(e) => setEditingPlant(prev => ({ ...prev, target_moisture: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white font-mono font-bold text-[#244B36]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Max Moisture (%)</label>
                  <input
                    type="number"
                    min="30"
                    max="100"
                    value={editingPlant.desired_moisture_max || 80}
                    onChange={(e) => setEditingPlant(prev => ({ ...prev, desired_moisture_max: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Notes & Agronomic Details (Optional)</label>
                <textarea
                  rows={2}
                  value={editingPlant.notes || ''}
                  onChange={(e) => setEditingPlant(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white text-[#27342C] focus:ring-2 focus:ring-[#244B36] focus:outline-none"
                  placeholder="Root depth, watering sensitivity, growth phase notes..."
                />
              </div>

              <div className="pt-4 border-t border-[#A9BBA0]/20 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#A9BBA0]/40 text-xs font-semibold text-[#778078] hover:bg-white min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#244B36] text-white text-xs font-bold hover:bg-[#1a3828] shadow-xs min-h-[44px]"
                >
                  {modalMode === 'ADD' ? 'Add Plant to Layout' : 'Save Plant Details'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

