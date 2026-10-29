import React, { useState, useEffect, useRef } from 'react';
import {
  MousePointer, Droplets, Droplet, Plus, Trash2, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize2, ShieldCheck, AlertTriangle, CheckCircle2,
  Save, Play, RefreshCw, X, Sliders, Info, Zap, Sparkles, Check,
  Layers, ArrowRight, Gauge, CornerDownRight, Power
} from 'lucide-react';
import { api } from '../services/api';
import type {
  GardenComponent, GardenPipe, GardenNetworkPayload,
  NetworkValidationResponse, GardenIrrigationPlanResponse,
  GardenComponentType, PipeType
} from '../types';

interface GardenPipeDesignerProps {
  zoneId: string;
  zoneName: string;
  systemMode?: 'SIMULATION' | 'HARDWARE';
  isPumpRunning?: boolean;
  onZoneSettingsApplied?: (targetMoisture: number, dryThreshold: number) => void;
}

type ToolMode = 
  | 'SELECT'
  | 'DRAW_MAIN'
  | 'DRAW_BRANCH'
  | 'ADD_WATER_SOURCE'
  | 'ADD_PUMP'
  | 'ADD_JUNCTION'
  | 'ADD_VALVE'
  | 'ADD_DRIP_OUTLET'
  | 'ADD_PLANT'
  | 'DELETE';

const GRID_SNAP = 24;

function snap(val: number): number {
  return Math.round(val / GRID_SNAP) * GRID_SNAP;
}

export const GardenPipeDesigner: React.FC<GardenPipeDesignerProps> = ({
  zoneId,
  zoneName,
  systemMode = 'SIMULATION',
  isPumpRunning = false,
  onZoneSettingsApplied
}) => {
  const [components, setComponents] = useState<GardenComponent[]>([]);
  const [pipes, setPipes] = useState<GardenPipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolMode>('SELECT');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [validation, setValidation] = useState<NetworkValidationResponse | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Irrigation plan modal state
  const [planModalOpen, setPlanModalOpen] = useState<boolean>(false);
  const [irrigationPlan, setIrrigationPlan] = useState<GardenIrrigationPlanResponse | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState<boolean>(false);

  // Undo / Redo History
  const [history, setHistory] = useState<Array<{ components: GardenComponent[]; pipes: GardenPipe[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Drawing state
  const [drawingStart, setDrawingStart] = useState<{ nodeId: string; port: string; x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas interaction
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const recordState = (newComps: GardenComponent[], newPipes: GardenPipe[]) => {
    const nextState = { components: JSON.parse(JSON.stringify(newComps)), pipes: JSON.parse(JSON.stringify(newPipes)) };
    const newHist = history.slice(0, historyIndex + 1);
    newHist.push(nextState);
    if (newHist.length > 25) newHist.shift();
    setHistory(newHist);
    setHistoryIndex(newHist.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setComponents(JSON.parse(JSON.stringify(prev.components)));
      setPipes(JSON.parse(JSON.stringify(prev.pipes)));
      setHistoryIndex(historyIndex - 1);
      triggerValidate(prev.components, prev.pipes);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setComponents(JSON.parse(JSON.stringify(next.components)));
      setPipes(JSON.parse(JSON.stringify(next.pipes)));
      setHistoryIndex(historyIndex + 1);
      triggerValidate(next.components, next.pipes);
    }
  };

  const loadNetwork = async () => {
    try {
      setLoading(true);
      const res = await api.getGardenNetwork(zoneId);
      const comps = res.network.components || [];
      const pps = res.network.pipes || [];
      setComponents(comps);
      setPipes(pps);
      setValidation(res.validation);
      setHistory([{ components: JSON.parse(JSON.stringify(comps)), pipes: JSON.parse(JSON.stringify(pps)) }]);
      setHistoryIndex(0);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to load garden pipe network' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (zoneId) {
      loadNetwork();
    }
  }, [zoneId]);

  const triggerValidate = async (currentComps = components, currentPipes = pipes) => {
    try {
      const payload: GardenNetworkPayload = {
        components: currentComps,
        pipes: currentPipes
      };
      const res = await api.validateGardenNetwork(zoneId, payload);
      setValidation(res);
    } catch (err) {
      console.warn('Network validation error:', err);
    }
  };

  const handleSaveNetwork = async () => {
    try {
      setSaving(true);
      const payload: GardenNetworkPayload = {
        components,
        pipes,
        metadata: {
          updated_at: new Date().toISOString(),
          zone_id: zoneId
        }
      };
      const res = await api.saveGardenNetwork(zoneId, payload);
      setValidation(res.validation);
      setNotification({ type: 'success', text: 'Garden pipe network saved and validated!' });
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to save network' });
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePlan = async () => {
    try {
      setGeneratingPlan(true);
      const payload: GardenNetworkPayload = { components, pipes };
      const res = await api.generateGardenIrrigationPlan(zoneId, payload);
      setIrrigationPlan(res);
      setPlanModalOpen(true);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to compute irrigation plan' });
    } finally {
      setGeneratingPlan(false);
    }
  };

  // Canvas Coordinates Helper
  const getCanvasCoords = (e: React.PointerEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    return { x: Math.max(0, Math.min(880, x)), y: Math.max(0, Math.min(520, y)) };
  };

  // Node Port Positions
  const getNodePortPos = (comp: GardenComponent, portName: string): { x: number; y: number } => {
    switch (comp.type) {
      case 'WATER_SOURCE':
        return { x: comp.x + 90, y: comp.y + 40 };
      case 'MOTOR_PUMP':
        return portName === 'inlet' ? { x: comp.x, y: comp.y + 40 } : { x: comp.x + 100, y: comp.y + 40 };
      case 'JUNCTION':
        if (portName === 'port_a') return { x: comp.x, y: comp.y + 20 };
        if (portName === 'port_b') return { x: comp.x + 40, y: comp.y + 20 };
        if (portName === 'port_c') return { x: comp.x + 20, y: comp.y + 40 };
        return { x: comp.x + 20, y: comp.y };
      case 'VALVE':
        return portName === 'inlet' ? { x: comp.x, y: comp.y + 20 } : { x: comp.x + 50, y: comp.y + 20 };
      case 'PLANT_ZONE':
        return { x: comp.x + 60, y: comp.y };
      case 'DRIP_OUTLET':
        return { x: comp.x + 18, y: comp.y };
      default:
        return { x: comp.x + 40, y: comp.y + 30 };
    }
  };

  // Pointer Canvas Handlers
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target !== canvasRef.current && (e.target as HTMLElement).tagName !== 'svg') {
      return;
    }

    const { x, y } = getCanvasCoords(e);
    const snX = snap(x);
    const snY = snap(y);

    if (activeTool === 'ADD_WATER_SOURCE') {
      const newWs: GardenComponent = {
        id: `ws-${Date.now()}`,
        type: 'WATER_SOURCE',
        name: 'Rainwater Tank (500L)',
        x: snX,
        y: snY,
        status: 'ACTIVE',
        properties: { water_level_liters: 450 }
      };
      const updated = [...components, newWs];
      setComponents(updated);
      recordState(updated, pipes);
      triggerValidate(updated, pipes);
      setActiveTool('SELECT');
    } else if (activeTool === 'ADD_PUMP') {
      const newPump: GardenComponent = {
        id: `pump-${Date.now()}`,
        type: 'MOTOR_PUMP',
        name: 'Submersible 12V Pump',
        x: snX,
        y: snY,
        status: isPumpRunning ? 'RUNNING' : 'OFF',
        properties: { flow_rate_lpm: 1.5, voltage: '12V' }
      };
      const updated = [...components, newPump];
      setComponents(updated);
      recordState(updated, pipes);
      triggerValidate(updated, pipes);
      setActiveTool('SELECT');
    } else if (activeTool === 'ADD_JUNCTION') {
      const newJn: GardenComponent = {
        id: `jn-${Date.now()}`,
        type: 'JUNCTION',
        name: 'T-Junction Splitter',
        x: snX,
        y: snY,
        status: 'ACTIVE',
        properties: { ports: 4 }
      };
      const updated = [...components, newJn];
      setComponents(updated);
      recordState(updated, pipes);
      triggerValidate(updated, pipes);
      setActiveTool('SELECT');
    } else if (activeTool === 'ADD_VALVE') {
      const newValv: GardenComponent = {
        id: `valve-${Date.now()}`,
        type: 'VALVE',
        name: 'Solenoid Valve',
        x: snX,
        y: snY,
        status: 'OPEN',
        properties: { valve_state: 'OPEN' }
      };
      const updated = [...components, newValv];
      setComponents(updated);
      recordState(updated, pipes);
      triggerValidate(updated, pipes);
      setActiveTool('SELECT');
    } else if (activeTool === 'ADD_DRIP_OUTLET') {
      const newOutlet: GardenComponent = {
        id: `outlet-${Date.now()}`,
        type: 'DRIP_OUTLET',
        name: 'Micro-Drip Nozzle',
        x: snX,
        y: snY,
        status: 'ACTIVE',
        properties: { emitter_flow: '2L/h' }
      };
      const updated = [...components, newOutlet];
      setComponents(updated);
      recordState(updated, pipes);
      triggerValidate(updated, pipes);
      setActiveTool('SELECT');
    } else if (activeTool === 'ADD_PLANT') {
      const newPlant: GardenComponent = {
        id: `plant-${Date.now()}`,
        type: 'PLANT_ZONE',
        name: 'New Plant Bed',
        x: snX,
        y: snY,
        status: 'ACTIVE',
        properties: { category: 'MEDIUM', target_moisture: 65, min_moisture: 50, max_moisture: 75 }
      };
      const updated = [...components, newPlant];
      setComponents(updated);
      recordState(updated, pipes);
      triggerValidate(updated, pipes);
      setActiveTool('SELECT');
    } else {
      setSelectedId(null);
      setSelectedPipeId(null);
      setDrawingStart(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const coords = getCanvasCoords(e);
    setCursorPos(coords);

    if (draggingCompId) {
      const snX = snap(coords.x - dragOffset.x);
      const snY = snap(coords.y - dragOffset.y);

      setComponents((prev) =>
        prev.map((c) => (c.id === draggingCompId ? { ...c, x: Math.max(0, snX), y: Math.max(0, snY) } : c))
      );
    }
  };

  const handlePointerUp = () => {
    if (draggingCompId) {
      setDraggingCompId(null);
      recordState(components, pipes);
      triggerValidate(components, pipes);
    }
  };

  const handleStartDrag = (e: React.PointerEvent, comp: GardenComponent) => {
    if (activeTool === 'DELETE') {
      handleDeleteComponent(comp.id);
      return;
    }

    if (activeTool === 'DRAW_MAIN' || activeTool === 'DRAW_BRANCH') {
      return;
    }

    e.stopPropagation();
    setSelectedId(comp.id);
    setSelectedPipeId(null);
    setDraggingCompId(comp.id);
    const coords = getCanvasCoords(e);
    setDragOffset({ x: coords.x - comp.x, y: coords.y - comp.y });
  };

  // Port Click Handlers for Pipe Drawing
  const handlePortClick = (e: React.MouseEvent, comp: GardenComponent, portName: string) => {
    e.stopPropagation();

    if (activeTool === 'DRAW_MAIN' || activeTool === 'DRAW_BRANCH') {
      const pos = getNodePortPos(comp, portName);

      if (!drawingStart) {
        // Start pipe
        setDrawingStart({ nodeId: comp.id, port: portName, x: pos.x, y: pos.y });
      } else {
        // Complete pipe
        if (drawingStart.nodeId === comp.id) {
          // Cannot connect component to itself
          return;
        }

        const pipeType: PipeType = activeTool === 'DRAW_MAIN' ? 'MAIN' : 'BRANCH';
        const newPipe: GardenPipe = {
          id: `pipe-${Date.now()}`,
          type: pipeType,
          from_node_id: drawingStart.nodeId,
          from_port: drawingStart.port,
          to_node_id: comp.id,
          to_port: portName,
          points: [
            { x: drawingStart.x, y: drawingStart.y },
            { x: pos.x, y: pos.y }
          ],
          status: 'CONNECTED'
        };

        const updatedPipes = [...pipes, newPipe];
        setPipes(updatedPipes);
        recordState(components, updatedPipes);
        triggerValidate(components, updatedPipes);
        setDrawingStart(null);
      }
    }
  };

  const handleDeleteComponent = (id: string) => {
    const updatedComps = components.filter((c) => c.id !== id);
    const updatedPipes = pipes.filter((p) => p.from_node_id !== id && p.to_node_id !== id);
    setComponents(updatedComps);
    setPipes(updatedPipes);
    recordState(updatedComps, updatedPipes);
    triggerValidate(updatedComps, updatedPipes);
    setSelectedId(null);
  };

  const handleDeletePipe = (pipeId: string) => {
    const updatedPipes = pipes.filter((p) => p.id !== pipeId);
    setPipes(updatedPipes);
    recordState(components, updatedPipes);
    triggerValidate(components, updatedPipes);
    setSelectedPipeId(null);
  };

  const handleToggleValve = (valveId: string) => {
    const updatedComps = components.map((c) => {
      if (c.id === valveId) {
        const curr = c.properties?.valve_state || c.status;
        const next = curr === 'OPEN' ? 'CLOSED' : 'OPEN';
        return {
          ...c,
          status: next,
          properties: { ...c.properties, valve_state: next }
        };
      }
      return c;
    });
    setComponents(updatedComps);
    recordState(updatedComps, pipes);
    triggerValidate(updatedComps, pipes);
  };

  // Node Reachability Map
  const reachableSet = new Set(validation?.connected_plant_ids || []);
  const unreachableSet = new Set(validation?.unreachable_plant_ids || []);

  const compMap = new Map(components.map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      {/* Design Notification Toast */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 rounded-md hover:bg-black/5 text-stone-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* COMPACT DESIGNER TOOLBAR */}
      <div className="p-2 sm:p-2.5 rounded-2xl bg-white border border-[#A9BBA0]/40 shadow-xs flex flex-wrap items-center justify-between gap-2">
        {/* Drawing & Component Tools */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => { setActiveTool('SELECT'); setDrawingStart(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTool === 'SELECT'
                ? 'bg-[#244B36] text-white shadow-xs'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
            title="Select & Move elements"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Select / Move</span>
          </button>

          <div className="h-5 w-px bg-stone-200 mx-1 hidden sm:block" />

          <button
            onClick={() => { setActiveTool('DRAW_MAIN'); setDrawingStart(null); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTool === 'DRAW_MAIN'
                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
            title="Draw heavy Main Supply Pipe (connects water tank and pump to junctions)"
          >
            <span className="w-3 h-1 bg-blue-600 rounded-full inline-block" />
            <span>Main Pipe</span>
          </button>

          <button
            onClick={() => { setActiveTool('DRAW_BRANCH'); setDrawingStart(null); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTool === 'DRAW_BRANCH'
                ? 'bg-sky-500 text-white shadow-xs ring-2 ring-sky-200'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
            title="Draw Branch Pipe (connects junctions to individual plant beds)"
          >
            <span className="w-2.5 h-0.5 bg-sky-400 border-t border-dashed rounded-full inline-block" />
            <span>Branch Pipe</span>
          </button>

          <div className="h-5 w-px bg-stone-200 mx-1 hidden sm:block" />

          {/* Component Buttons */}
          <button
            onClick={() => setActiveTool('ADD_WATER_SOURCE')}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'ADD_WATER_SOURCE' ? 'bg-cyan-600 text-white shadow-xs' : 'text-stone-700 hover:bg-stone-100'
            }`}
            title="Add Water Reservoir / Rainwater Tank"
          >
            <Droplets className="w-3.5 h-3.5 text-cyan-600" />
            <span className="hidden md:inline">Water Source</span>
          </button>

          <button
            onClick={() => setActiveTool('ADD_PUMP')}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'ADD_PUMP' ? 'bg-indigo-600 text-white shadow-xs' : 'text-stone-700 hover:bg-stone-100'
            }`}
            title="Add Submersible / Centrifugal Motor Pump"
          >
            <Power className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden md:inline">Motor Pump</span>
          </button>

          <button
            onClick={() => setActiveTool('ADD_JUNCTION')}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'ADD_JUNCTION' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-700 hover:bg-stone-100'
            }`}
            title="Add 4-Way / T Pipe Junction Splitter"
          >
            <Plus className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden lg:inline">Junction</span>
          </button>

          <button
            onClick={() => setActiveTool('ADD_VALVE')}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'ADD_VALVE' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-700 hover:bg-stone-100'
            }`}
            title="Add In-line Solenoid Valve (supports open/closed toggling)"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden lg:inline">Valve</span>
          </button>

          <button
            onClick={() => setActiveTool('ADD_DRIP_OUTLET')}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'ADD_DRIP_OUTLET' ? 'bg-blue-600 text-white shadow-xs' : 'text-stone-700 hover:bg-stone-100'
            }`}
            title="Add Drip Irrigation Outlet / Emitter"
          >
            <Droplet className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden xl:inline">Drip Outlet</span>
          </button>

          <button
            onClick={() => setActiveTool('DELETE')}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              activeTool === 'DELETE' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-600 hover:bg-rose-50'
            }`}
            title="Click an element or pipe to remove it"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>

        {/* Undo/Redo & Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-stone-200 mx-1" />

          <button
            onClick={() => setZoomLevel((prev) => Math.max(0.6, prev - 0.1))}
            className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono font-bold w-10 text-center text-stone-600">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomLevel((prev) => Math.min(1.4, prev + 0.1))}
            className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 cursor-pointer"
            title="Fit to Screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tool Instructions Pill */}
      <div className="px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-stone-500" />
          {activeTool === 'SELECT' && 'Click and drag any component to reposition. Click valves to toggle Open/Closed.'}
          {activeTool === 'DRAW_MAIN' && (drawingStart ? 'Click target port to complete Main Pipe connection.' : 'Click any component port (e.g. Tank outlet or Pump inlet) to start drawing Main Pipe.')}
          {activeTool === 'DRAW_BRANCH' && (drawingStart ? 'Click plant zone inlet or drip outlet to connect Branch Pipe.' : 'Click junction or valve outlet to start Branch Pipe.')}
          {activeTool.startsWith('ADD_') && 'Click anywhere on the dotted garden grid to place the component.'}
          {activeTool === 'DELETE' && 'Click any pipe or component to remove it from the network.'}
        </span>
        {drawingStart && (
          <button
            onClick={() => setDrawingStart(null)}
            className="text-[11px] font-bold text-rose-600 hover:underline"
          >
            Cancel Drawing
          </button>
        )}
      </div>

      {/* MAIN INTERACTIVE GROWING AREA GRID CANVAS */}
      <div
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative w-full h-[540px] rounded-3xl bg-[#FAF8F1] border-2 border-[#A9BBA0]/50 shadow-inner overflow-auto select-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(85, 122, 82, 0.18) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
          cursor: activeTool.startsWith('ADD_') ? 'crosshair' : activeTool === 'DELETE' ? 'not-allowed' : activeTool.startsWith('DRAW_') ? 'crosshair' : 'default'
        }}
      >
        <div
          className="relative w-[920px] h-[540px] origin-top-left transition-transform duration-75"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {/* SVG PIPES OVERLAY */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <linearGradient id="mainPipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0284C7" />
                <stop offset="100%" stopColor="#0369A1" />
              </linearGradient>
              <linearGradient id="branchPipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0EA5E9" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
            </defs>

            {/* Render Saved Pipes */}
            {pipes.map((pipe) => {
              const fromComp = compMap.get(pipe.from_node_id);
              const toComp = compMap.get(pipe.to_node_id);
              if (!fromComp || !toComp) return null;

              const startPos = getNodePortPos(fromComp, pipe.from_port);
              const endPos = getNodePortPos(toComp, pipe.to_port);

              const isMain = pipe.type === 'MAIN';
              const isSelected = selectedPipeId === pipe.id;

              // Orthogonal / S-curve routing
              const midX = (startPos.x + endPos.x) / 2;
              const pathD = `M ${startPos.x} ${startPos.y} C ${midX} ${startPos.y}, ${midX} ${endPos.y}, ${endPos.x} ${endPos.y}`;

              const isFlowing = isPumpRunning;

              return (
                <g key={pipe.id} className="pointer-events-auto cursor-pointer" onClick={() => {
                  if (activeTool === 'DELETE') {
                    handleDeletePipe(pipe.id);
                  } else {
                    setSelectedPipeId(pipe.id);
                    setSelectedId(null);
                  }
                }}>
                  {/* Outer casing / selection halo */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isSelected ? '#F59E0B' : '#FFFFFF'}
                    strokeWidth={isMain ? 11 : 7}
                    strokeLinecap="round"
                    opacity={isSelected ? 0.9 : 0.6}
                  />

                  {/* Main Pipe Body */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isMain ? '#0284C7' : '#0EA5E9'}
                    strokeWidth={isMain ? 7 : 4}
                    strokeLinecap="round"
                  />

                  {/* Flow Animation when pump is active */}
                  {isFlowing && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#E0F2FE"
                      strokeWidth={isMain ? 3 : 2}
                      strokeDasharray="6 8"
                      className="animate-pulse"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Terminal dots */}
                  <circle cx={startPos.x} cy={startPos.y} r={isMain ? 4 : 3} fill="#0369A1" />
                  <circle cx={endPos.x} cy={endPos.y} r={isMain ? 4 : 3} fill="#0369A1" />
                </g>
              );
            })}

            {/* Live Drawing Preview Line */}
            {drawingStart && (
              <line
                x1={drawingStart.x}
                y1={drawingStart.y}
                x2={cursorPos.x}
                y2={cursorPos.y}
                stroke="#F59E0B"
                strokeWidth={activeTool === 'DRAW_MAIN' ? 6 : 3.5}
                strokeDasharray="5 5"
                strokeLinecap="round"
              />
            )}
          </svg>

          {/* RENDER GARDEN COMPONENTS */}
          {components.map((comp) => {
            const isSelected = selectedId === comp.id;

            // 1. WATER SOURCE COMPONENT
            if (comp.type === 'WATER_SOURCE') {
              return (
                <div
                  key={comp.id}
                  onPointerDown={(e) => handleStartDrag(e, comp)}
                  style={{ left: comp.x, top: comp.y }}
                  className={`absolute z-20 w-36 rounded-2xl p-3 bg-white border-2 shadow-md transition-shadow select-none ${
                    isSelected ? 'border-amber-500 ring-2 ring-amber-300' : 'border-cyan-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                      <Droplets className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-stone-800 block leading-tight">Water Source</span>
                      <span className="text-[10px] text-cyan-700 font-bold">450L Tank</span>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-stone-500 flex justify-between">
                    <span>Supply Outlet</span>
                    <span className="text-emerald-700 font-semibold">Available</span>
                  </div>

                  {/* Outlet Port */}
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'outlet')}
                    className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cyan-600 border-2 border-white shadow-xs hover:scale-125 transition-transform cursor-pointer"
                    title="Outlet: Connect main pipe to pump inlet"
                  />
                </div>
              );
            }

            // 2. MOTOR PUMP COMPONENT
            if (comp.type === 'MOTOR_PUMP') {
              const pumpState = isPumpRunning ? 'RUNNING' : comp.status || 'OFF';
              return (
                <div
                  key={comp.id}
                  onPointerDown={(e) => handleStartDrag(e, comp)}
                  style={{ left: comp.x, top: comp.y }}
                  className={`absolute z-20 w-40 rounded-2xl p-3 bg-white border-2 shadow-md transition-shadow select-none ${
                    isSelected ? 'border-amber-500 ring-2 ring-amber-300' : 'border-indigo-300'
                  }`}
                >
                  {/* Inlet Port (Left) */}
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'inlet')}
                    className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white shadow-xs hover:scale-125 transition-transform cursor-pointer"
                    title="Inlet: Connect pipe from water tank"
                  />

                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                      pumpState === 'RUNNING' ? 'bg-emerald-100 text-emerald-800 animate-spin' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      <Power className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-stone-800 block leading-tight">12V DC Pump</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                        pumpState === 'RUNNING' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {pumpState}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-stone-500 flex justify-between">
                    <span>1.5 L/min</span>
                    <span>{systemMode === 'SIMULATION' ? 'Simulated' : 'Hardware'}</span>
                  </div>

                  {/* Outlet Port (Right) */}
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'outlet')}
                    className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white shadow-xs hover:scale-125 transition-transform cursor-pointer"
                    title="Outlet: Connect pipe to main distribution line"
                  />
                </div>
              );
            }

            // 3. JUNCTION COMPONENT
            if (comp.type === 'JUNCTION') {
              return (
                <div
                  key={comp.id}
                  onPointerDown={(e) => handleStartDrag(e, comp)}
                  style={{ left: comp.x, top: comp.y }}
                  className={`absolute z-20 w-10 h-10 rounded-xl bg-amber-500 border-2 border-white shadow-md flex items-center justify-center text-white cursor-grab active:cursor-grabbing ${
                    isSelected ? 'ring-2 ring-amber-400 scale-110' : ''
                  }`}
                  title="Pipe Junction Splitter"
                >
                  <Plus className="w-5 h-5" />

                  {/* 4 Ports */}
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'port_a')}
                    className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border border-amber-600 cursor-pointer"
                  />
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'port_b')}
                    className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border border-amber-600 cursor-pointer"
                  />
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'port_c')}
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 rounded-full bg-white border border-amber-600 cursor-pointer"
                  />
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'port_d')}
                    className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rounded-full bg-white border border-amber-600 cursor-pointer"
                  />
                </div>
              );
            }

            // 4. VALVE COMPONENT
            if (comp.type === 'VALVE') {
              const isOpen = (comp.properties?.valve_state || comp.status) === 'OPEN';
              return (
                <div
                  key={comp.id}
                  onPointerDown={(e) => handleStartDrag(e, comp)}
                  style={{ left: comp.x, top: comp.y }}
                  className={`absolute z-20 rounded-xl px-2.5 py-1.5 bg-white border-2 shadow-md flex items-center gap-2 select-none ${
                    isOpen ? 'border-emerald-400' : 'border-amber-400'
                  } ${isSelected ? 'ring-2 ring-amber-300' : ''}`}
                >
                  {/* Inlet */}
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'inlet')}
                    className="w-3 h-3 rounded-full bg-stone-700 border border-white cursor-pointer"
                    title="Valve Inlet"
                  />

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleValve(comp.id);
                    }}
                    className="cursor-pointer"
                    title="Click to toggle Open / Closed"
                  >
                    <span className="text-[10px] font-bold text-stone-700 block leading-none">Valve</span>
                    <span className={`text-[9px] font-extrabold ${isOpen ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {isOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                  </div>

                  {/* Outlet */}
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'outlet')}
                    className="w-3 h-3 rounded-full bg-stone-700 border border-white cursor-pointer"
                    title="Valve Outlet"
                  />
                </div>
              );
            }

            // 5. DRIP OUTLET COMPONENT
            if (comp.type === 'DRIP_OUTLET') {
              return (
                <div
                  key={comp.id}
                  onPointerDown={(e) => handleStartDrag(e, comp)}
                  style={{ left: comp.x, top: comp.y }}
                  className={`absolute z-20 w-9 h-9 rounded-full bg-blue-100 border-2 border-blue-400 shadow-md flex items-center justify-center text-blue-700 cursor-grab active:cursor-grabbing ${
                    isSelected ? 'ring-2 ring-amber-400' : ''
                  }`}
                  title="Drip Emitter Outlet"
                >
                  <Droplet className="w-4 h-4 fill-current" />
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'inlet')}
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-600 border border-white cursor-pointer"
                  />
                </div>
              );
            }

            // 6. PLANT ZONE COMPONENT
            if (comp.type === 'PLANT_ZONE') {
              const isReachable = reachableSet.has(comp.id);
              const pCat = comp.properties?.category || 'MEDIUM';
              const pTarget = comp.properties?.target_moisture || 65;

              return (
                <div
                  key={comp.id}
                  onPointerDown={(e) => handleStartDrag(e, comp)}
                  style={{ left: comp.x, top: comp.y }}
                  className={`absolute z-20 w-44 rounded-2xl p-3 bg-white border-2 shadow-md transition-shadow select-none ${
                    isReachable ? 'border-emerald-500' : 'border-rose-400'
                  } ${isSelected ? 'ring-2 ring-amber-300' : ''}`}
                >
                  {/* Inlet Port (Top Center) */}
                  <button
                    onClick={(e) => handlePortClick(e, comp, 'inlet')}
                    className={`absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-xs hover:scale-125 transition-transform cursor-pointer ${
                      isReachable ? 'bg-emerald-600' : 'bg-rose-500'
                    }`}
                    title="Connect branch pipe from valve or junction to this plant"
                  />

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-stone-800 truncate">{comp.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      pCat === 'HIGH' ? 'bg-blue-100 text-blue-800' : pCat === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-700'
                    }`}>
                      {pCat}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-stone-500">
                    <span>Target: {pTarget}%</span>
                    <span className={`font-bold flex items-center gap-1 ${isReachable ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {isReachable ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Connected
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3" /> Disconnected
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* COLOR & FLOW LEGEND */}
      <div className="p-3 rounded-2xl bg-white border border-[#A9BBA0]/30 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-stone-800">
          <Info className="w-4 h-4 text-[#244B36]" />
          <span>Hydraulic Network Legend:</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-blue-600" />
            <span className="font-semibold text-stone-700">Main Supply Pipe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1 rounded-full bg-sky-400" />
            <span className="font-semibold text-stone-700">Branch Feeder Tube</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-emerald-800">Supplied & Reachable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="font-semibold text-rose-700">Disconnected / Unreachable</span>
          </div>
          {isPumpRunning && (
            <div className="flex items-center gap-1.5 text-blue-700 font-bold animate-pulse">
              <Zap className="w-3.5 h-3.5" />
              <span>Simulated Water Flowing</span>
            </div>
          )}
        </div>
      </div>

      {/* NETWORK TOPOLOGY SUMMARY & ACTION CONTROLS BAR */}
      <div className="rounded-3xl bg-white border border-[#A9BBA0]/40 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-stone-800 font-['Outfit']">Garden Irrigation Topology Audit</h3>
            <p className="text-xs text-stone-500">
              {validation?.summary || 'Validating component connectivity and supply routes...'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => triggerValidate()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              title="Revalidate graph topology"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Validate Network</span>
            </button>

            <button
              onClick={handleSaveNetwork}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#244B36] hover:bg-[#1a3828] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Garden Design'}</span>
            </button>

            <button
              onClick={handleGeneratePlan}
              disabled={generatingPlan || !validation?.is_valid}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-40"
              title="Generate intelligent sequential watering plan for reachable plant beds"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{generatingPlan ? 'Calculating...' : 'Generate Irrigation Plan'}</span>
            </button>
          </div>
        </div>

        {/* Validation Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <span className="text-[10px] text-stone-500 uppercase block font-semibold">Total Plant Beds</span>
            <span className="text-xl font-black text-stone-800 mt-1 block">
              {validation?.total_zones_count ?? components.filter((c) => c.type === 'PLANT_ZONE').length}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] text-emerald-800 uppercase block font-semibold">Reachable Zones</span>
            <span className="text-xl font-black text-emerald-900 mt-1 block">
              {validation?.reachable_zones_count ?? 0}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <span className="text-[10px] text-stone-500 uppercase block font-semibold">Motor & Water Source</span>
            <div className="mt-1 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${validation?.has_motor_pump ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="font-bold text-stone-700">
                {validation?.has_motor_pump && validation?.has_water_source ? 'Linked & Primed' : 'Missing Pump/Tank'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <span className="text-[10px] text-stone-500 uppercase block font-semibold">Pipe Segments</span>
            <span className="text-xl font-black text-stone-800 mt-1 block">
              {pipes.length} segments
            </span>
          </div>
        </div>

        {/* Actionable Topology Warnings */}
        {validation?.issues && validation.issues.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Network Topology Diagnostics:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900/90 pl-1">
              {validation.issues.map((iss, i) => (
                <li key={i}>{iss.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* SEQUENTIAL IRRIGATION SCHEDULE MODAL */}
      {planModalOpen && irrigationPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FAF8F1] w-full max-w-2xl rounded-3xl shadow-2xl border border-[#A9BBA0]/40 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#A9BBA0]/30 flex items-center justify-between bg-[#E7EFE4]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#244B36] text-white flex items-center justify-center">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#27342C]">Topology-Aware Smart Irrigation Plan</h3>
                  <p className="text-[11px] text-[#778078]">Sequential watering tasks prioritized by crop deficit and supply path</p>
                </div>
              </div>
              <button
                onClick={() => setPlanModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-white border border-[#A9BBA0]/30">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase block font-bold">Total Tasks</span>
                  <span className="text-lg font-black text-[#244B36]">{irrigationPlan.total_tasks} steps</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 uppercase block font-bold">Estimated Water</span>
                  <span className="text-lg font-black text-blue-700">{irrigationPlan.total_water_liters_estimate} Liters</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 uppercase block font-bold">Pump Flow Rate</span>
                  <span className="text-lg font-black text-stone-800">{irrigationPlan.flow_rate_lpm} L/min</span>
                </div>
              </div>

              {/* Sequential Task List */}
              <div className="space-y-2.5">
                <span className="font-bold text-stone-800 uppercase tracking-wider text-[11px] block">
                  Sequential Execution Queue (Single Shared Pump Safe)
                </span>

                {irrigationPlan.tasks.map((task) => (
                  <div key={task.step} className="p-3.5 rounded-2xl bg-white border border-[#A9BBA0]/30 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#244B36] text-white flex items-center justify-center font-bold text-xs">
                          {task.step}
                        </span>
                        <span className="font-extrabold text-stone-800 text-sm">{task.target_name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          task.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {task.priority} Priority
                        </span>
                      </div>
                      <span className="font-mono font-bold text-blue-700 text-xs">
                        {Math.round(task.duration_seconds / 60)}m ({task.duration_seconds}s)
                      </span>
                    </div>

                    <p className="text-xs text-stone-600">{task.explanation}</p>

                    <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-500 flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-stone-700">Route: </span>
                      <span>{task.supply_path.join(' ➔ ')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Unreachable Zones Warning */}
              {irrigationPlan.unreachable_warnings.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Excluded Unreachable Beds:
                  </span>
                  <ul className="list-disc list-inside text-[11px] pl-1">
                    {irrigationPlan.unreachable_warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#A9BBA0]/30 bg-white flex items-center justify-between">
              <span className="text-[11px] text-stone-500">
                Single pump hardware safety interlocks active.
              </span>
              <button
                onClick={() => {
                  setPlanModalOpen(false);
                  setNotification({ type: 'success', text: 'Sequential irrigation schedule prepared and staged for authorized actuation.' });
                }}
                className="px-5 py-2 rounded-xl bg-[#244B36] hover:bg-[#1a3828] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Accept Schedule & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
