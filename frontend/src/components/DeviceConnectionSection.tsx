import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Cpu, 
  Server, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Save, 
  ShieldCheck, 
  ArrowRight,
  ExternalLink,
  Wifi,
  Network
} from 'lucide-react';
import { api } from '../services/api';
import { DeviceConnectionSettings, TestConnectionResult } from '../types';

interface DeviceConnectionSectionProps {
  onSettingsChanged?: () => void;
}

export const DeviceConnectionSection: React.FC<DeviceConnectionSectionProps> = ({ onSettingsChanged }) => {
  const [conn, setConn] = useState<DeviceConnectionSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testingMode, setTestingMode] = useState<'DIRECT' | 'GATEWAY' | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Form Fields
  const [selectedMode, setSelectedMode] = useState<'DIRECT_ESP32' | 'RPI_GATEWAY'>('DIRECT_ESP32');
  const [esp32Id, setEsp32Id] = useState<string>('esp32-zone-01');
  const [esp32Ip, setEsp32Ip] = useState<string>('192.168.1.105');
  const [esp32Protocol, setEsp32Protocol] = useState<string>('MQTT');
  const [rpiId, setRpiId] = useState<string>('rpi-edge-01');
  const [rpiIp, setRpiIp] = useState<string>('192.168.1.200');
  const [rpiMqttHost, setRpiMqttHost] = useState<string>('127.0.0.1');
  const [rpiMqttPort, setRpiMqttPort] = useState<number>(1883);

  const fetchConnection = async () => {
    try {
      const data = await api.getConnectionSettings();
      setConn(data);
      setSelectedMode(data.active_mode);
      setEsp32Id(data.direct_esp32_id);
      setEsp32Ip(data.direct_esp32_ip);
      setEsp32Protocol(data.direct_esp32_protocol || 'MQTT');
      setRpiId(data.rpi_device_id);
      setRpiIp(data.rpi_ip);
      setRpiMqttHost(data.rpi_mqtt_host);
      setRpiMqttPort(data.rpi_mqtt_port);
    } catch (err: any) {
      console.error('Failed to load device connection settings', err);
      setStatusMessage({ type: 'error', text: 'Failed to load connection settings from backend.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnection();
  }, []);

  const handleSave = async () => {
    // Validation
    if (selectedMode === 'DIRECT_ESP32') {
      if (!esp32Id.trim()) {
        setStatusMessage({ type: 'error', text: 'ESP32 Device ID is required.' });
        return;
      }
      if (!esp32Ip.trim()) {
        setStatusMessage({ type: 'error', text: 'ESP32 IP address or hostname is required.' });
        return;
      }
    } else {
      if (!rpiId.trim()) {
        setStatusMessage({ type: 'error', text: 'Raspberry Pi Device ID is required.' });
        return;
      }
      if (!rpiIp.trim()) {
        setStatusMessage({ type: 'error', text: 'Raspberry Pi IP address or hostname is required.' });
        return;
      }
      if (!rpiMqttHost.trim()) {
        setStatusMessage({ type: 'error', text: 'MQTT Broker host is required.' });
        return;
      }
      if (!rpiMqttPort || rpiMqttPort <= 0 || rpiMqttPort > 65535) {
        setStatusMessage({ type: 'error', text: 'MQTT Port must be between 1 and 65535.' });
        return;
      }
    }

    setSaving(true);
    setStatusMessage(null);
    try {
      const updated = await api.updateConnectionSettings({
        active_mode: selectedMode,
        direct_esp32_id: esp32Id.trim(),
        direct_esp32_ip: esp32Ip.trim(),
        direct_esp32_protocol: esp32Protocol,
        rpi_device_id: rpiId.trim(),
        rpi_ip: rpiIp.trim(),
        rpi_mqtt_host: rpiMqttHost.trim(),
        rpi_mqtt_port: Number(rpiMqttPort)
      });
      setConn(updated);
      setStatusMessage({
        type: 'success',
        text: `Device connection mode set to ${selectedMode === 'DIRECT_ESP32' ? 'Direct ESP32' : 'Raspberry Pi 4B Gateway'}. Configuration saved.`
      });
      onSettingsChanged?.();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save connection settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestDirect = async () => {
    setTestingMode('DIRECT');
    setTestResult(null);
    setStatusMessage(null);
    try {
      const res = await api.testDirectEsp32();
      setTestResult(res);
      await fetchConnection();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to test Direct ESP32 connection.' });
    } finally {
      setTestingMode(null);
    }
  };

  const handleTestGateway = async () => {
    setTestingMode('GATEWAY');
    setTestResult(null);
    setStatusMessage(null);
    try {
      const res = await api.testRpiGateway();
      setTestResult(res);
      await fetchConnection();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to test Raspberry Pi Gateway connection.' });
    } finally {
      setTestingMode(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-[#778078] flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-[#244B36]" />
        <span>Loading Device Connection Architecture...</span>
      </div>
    );
  }

  const getStatusBadge = (status: 'CONNECTED' | 'DISCONNECTED' | 'UNKNOWN') => {
    if (status === 'CONNECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Connected
        </span>
      );
    }
    if (status === 'DISCONNECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <XCircle className="w-3.5 h-3.5 text-rose-600" /> Disconnected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-300">
        <AlertTriangle className="w-3.5 h-3.5 text-zinc-500" /> Unknown / Unverified
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview & Security Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[#A9BBA0]/40 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-[#244B36]" />
          <h2 className="font-extrabold text-base sm:text-lg text-[#27342C] font-['Outfit']">
            Device Connection Architecture
          </h2>
        </div>
        <p className="text-xs text-[#778078] leading-relaxed">
          Configure how telemetry and pump commands route between your field controllers, the local edge gateway, and the backend application. Only one active connection path operates at a time to prevent duplicate commands and telemetry collisions.
        </p>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
          statusMessage.type === 'success'
            ? 'bg-[#E7EFE4] border-[#557A52]/40 text-[#244B36]'
            : statusMessage.type === 'error'
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Two Selectable Connection Modes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* OPTION A: DIRECT ESP32 CONNECTION */}
        <div 
          onClick={() => setSelectedMode('DIRECT_ESP32')}
          className={`rounded-3xl p-5 sm:p-6 border transition-all cursor-pointer relative flex flex-col justify-between ${
            selectedMode === 'DIRECT_ESP32'
              ? 'bg-white border-[#244B36] shadow-xl ring-2 ring-[#244B36]/20'
              : 'glass-panel opacity-85 hover:opacity-100 hover:bg-white/80'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  selectedMode === 'DIRECT_ESP32' ? 'bg-[#244B36] text-[#FAF8F1]' : 'bg-[#E7EFE4] text-[#244B36]'
                }`}>
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm sm:text-base text-[#27342C]">Option A — Direct ESP32</span>
                    {selectedMode === 'DIRECT_ESP32' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#244B36] text-white">ACTIVE</span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#778078] block">Direct telemetry & commands with backend</span>
                </div>
              </div>
              <input
                type="radio"
                name="connection_mode"
                checked={selectedMode === 'DIRECT_ESP32'}
                onChange={() => setSelectedMode('DIRECT_ESP32')}
                className="w-4 h-4 text-[#244B36] focus:ring-[#244B36] cursor-pointer mt-1"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F1] border border-[#A9BBA0]/30 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#778078]">Connection Status:</span>
                {getStatusBadge(conn?.direct_esp32_status || 'UNKNOWN')}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#778078]">Last Verified:</span>
                <span className="font-mono text-[11px] text-[#27342C]">
                  {conn?.direct_last_verified_at ? new Date(conn.direct_last_verified_at).toLocaleTimeString() : 'Never'}
                </span>
              </div>
              {conn?.direct_last_error && (
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                  <strong>Diagnostic Note:</strong> {conn.direct_last_error}
                </div>
              )}
            </div>

            {/* Editable Fields for Option A */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">ESP32 Device ID</label>
                <input
                  type="text"
                  value={esp32Id}
                  onChange={(e) => setEsp32Id(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white text-[#27342C] focus:ring-2 focus:ring-[#244B36] focus:outline-none"
                  placeholder="e.g. esp32-zone-01"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">IP Address / Hostname</label>
                  <input
                    type="text"
                    value={esp32Ip}
                    onChange={(e) => setEsp32Ip(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white text-[#27342C] focus:ring-2 focus:ring-[#244B36] focus:outline-none font-mono"
                    placeholder="192.168.1.105"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Protocol</label>
                  <select
                    value={esp32Protocol}
                    onChange={(e) => setEsp32Protocol(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white text-[#27342C] focus:ring-2 focus:ring-[#244B36] focus:outline-none"
                  >
                    <option value="MQTT">MQTT (Paho Broker)</option>
                    <option value="HTTP_REST">HTTP REST Polling</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#A9BBA0]/20 flex items-center justify-between">
            <span className="text-[10px] text-[#778078]">Direct field path</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleTestDirect(); }}
              disabled={testingMode === 'DIRECT'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#244B36] text-[#244B36] text-xs font-bold hover:bg-[#E7EFE4] transition-colors shadow-xs cursor-pointer min-h-[38px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingMode === 'DIRECT' ? 'animate-spin' : ''}`} />
              <span>{testingMode === 'DIRECT' ? 'Verifying...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>

        {/* OPTION B: RASPBERRY PI 4B GATEWAY */}
        <div 
          onClick={() => setSelectedMode('RPI_GATEWAY')}
          className={`rounded-3xl p-5 sm:p-6 border transition-all cursor-pointer relative flex flex-col justify-between ${
            selectedMode === 'RPI_GATEWAY'
              ? 'bg-white border-[#244B36] shadow-xl ring-2 ring-[#244B36]/20'
              : 'glass-panel opacity-85 hover:opacity-100 hover:bg-white/80'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  selectedMode === 'RPI_GATEWAY' ? 'bg-[#244B36] text-[#FAF8F1]' : 'bg-[#E7EFE4] text-[#244B36]'
                }`}>
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm sm:text-base text-[#27342C]">Option B — Raspberry Pi 4B</span>
                    {selectedMode === 'RPI_GATEWAY' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#244B36] text-white">ACTIVE</span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#778078] block">Edge gateway with local decision buffer</span>
                </div>
              </div>
              <input
                type="radio"
                name="connection_mode"
                checked={selectedMode === 'RPI_GATEWAY'}
                onChange={() => setSelectedMode('RPI_GATEWAY')}
                className="w-4 h-4 text-[#244B36] focus:ring-[#244B36] cursor-pointer mt-1"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F1] border border-[#A9BBA0]/30 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#778078]">Gateway Status:</span>
                {getStatusBadge(conn?.rpi_status || 'UNKNOWN')}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#778078]">ESP32 via Gateway:</span>
                {getStatusBadge(conn?.rpi_esp32_status || 'UNKNOWN')}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#778078]">Last Verified:</span>
                <span className="font-mono text-[11px] text-[#27342C]">
                  {conn?.rpi_last_verified_at ? new Date(conn.rpi_last_verified_at).toLocaleTimeString() : 'Never'}
                </span>
              </div>
              {conn?.rpi_last_error && (
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                  <strong>Diagnostic Note:</strong> {conn.rpi_last_error}
                </div>
              )}
            </div>

            {/* Editable Fields for Option B */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Raspberry Pi ID</label>
                  <input
                    type="text"
                    value={rpiId}
                    onChange={(e) => setRpiId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white text-[#27342C] focus:ring-2 focus:ring-[#244B36] focus:outline-none"
                    placeholder="rpi-edge-01"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Gateway Host / IP</label>
                  <input
                    type="text"
                    value={rpiIp}
                    onChange={(e) => setRpiIp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white text-[#27342C] focus:ring-2 focus:ring-[#244B36] focus:outline-none font-mono"
                    placeholder="192.168.1.200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">MQTT Broker Host</label>
                  <input
                    type="text"
                    value={rpiMqttHost}
                    onChange={(e) => setRpiMqttHost(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white text-[#27342C] focus:ring-2 focus:ring-[#244B36] focus:outline-none font-mono"
                    placeholder="127.0.0.1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#778078] uppercase mb-1">Port</label>
                  <input
                    type="number"
                    value={rpiMqttPort}
                    onChange={(e) => setRpiMqttPort(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#A9BBA0]/40 text-xs bg-white text-[#27342C] focus:ring-2 focus:ring-[#244B36] focus:outline-none font-mono"
                    placeholder="1883"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#A9BBA0]/20 flex items-center justify-between">
            <span className="text-[10px] text-[#778078]">Local edge buffered</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleTestGateway(); }}
              disabled={testingMode === 'GATEWAY'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#244B36] text-[#244B36] text-xs font-bold hover:bg-[#E7EFE4] transition-colors shadow-xs cursor-pointer min-h-[38px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingMode === 'GATEWAY' ? 'animate-spin' : ''}`} />
              <span>{testingMode === 'GATEWAY' ? 'Verifying...' : 'Test Gateway'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Live Verification Diagnostic Report */}
      {testResult && (
        <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
          testResult.status === 'CONNECTED'
            ? 'bg-[#E7EFE4]/80 border-[#557A52]/40 text-[#244B36]'
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              {testResult.status === 'CONNECTED' ? (
                <CheckCircle2 className="w-4 h-4 text-[#557A52]" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>Connection Test Result: {testResult.status}</span>
            </div>
            <span className="text-[11px] font-mono">{new Date(testResult.tested_at).toLocaleTimeString()}</span>
          </div>
          {testResult.error && (
            <p className="text-[11px] font-medium text-rose-800">
              <strong>Error Reason:</strong> {testResult.error}
            </p>
          )}
          {testResult.details && (
            <div className="text-[11px] opacity-90 font-mono bg-white/60 p-2.5 rounded-xl space-y-1">
              {Object.entries(testResult.details).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{k}:</span>
                  <span className="font-semibold">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Settings Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#A9BBA0]/30 shadow-xs">
        <div className="text-xs text-[#778078]">
          Active Mode Selected: <strong className="text-[#244B36]">{selectedMode === 'DIRECT_ESP32' ? 'Option A — Direct ESP32' : 'Option B — Raspberry Pi 4B Gateway'}</strong>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#244B36] text-white font-bold text-xs hover:bg-[#1a3828] transition-colors shadow-sm cursor-pointer min-h-[44px]"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Connection Mode</span>
        </button>
      </div>

    </div>
  );
};

