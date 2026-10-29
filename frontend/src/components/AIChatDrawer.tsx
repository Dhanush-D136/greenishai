import React, { useState, useEffect, useRef } from 'react';
import {
  X, Send, Sparkles, Bot, User as UserIcon, Play,
  CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Droplets
} from 'lucide-react';
import { api } from '../services/api';
import type { AIChatMessage } from '../types';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  zoneId?: string;
  onActionTriggered?: () => void;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  isOpen,
  onClose,
  zoneId,
  onActionTriggered
}) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: "Hello! I am your **SmartIrrigate AI Assistant**.\n\nI have direct read access to your live soil moisture telemetry, pump states, weather forecast, and zone configurations.\n\nHow can I help optimize your irrigation today?",
      created_at: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string>(() => `conv_${Date.now()}`);
  const [actionProcessing, setActionProcessing] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const quickPrompts = [
    "🌾 How is Zone A doing right now?",
    "📈 Forecast soil moisture for next 60m",
    "⚠️ Any active anomalies detected?",
    "💧 Water Zone A for 2 minutes",
    "📊 What is our pumping efficiency this week?"
  ];

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await api.sendAIChat(text, conversationId, zoneId);
      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }

      const botMsg: AIChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.content,
        supporting_records: res.supporting_records,
        proposed_action: res.proposed_action,
        created_at: res.created_at || new Date().toISOString()
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: AIChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Sorry, I encountered an error connecting to the AI service: ${err.message || 'Please check connection'}.`,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleActionDecision = async (actionId: number, decision: 'APPROVE' | 'REJECT') => {
    try {
      setActionProcessing(actionId);
      await api.decideProposedAction(actionId, decision);
      
      // Update message proposed_action status
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.proposed_action && msg.proposed_action.action_id === actionId) {
            return {
              ...msg,
              proposed_action: {
                ...msg.proposed_action,
                status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
              }
            };
          }
          return msg;
        })
      );

      if (onActionTriggered) onActionTriggered();
    } catch (err: any) {
      alert(`Action decision error: ${err.message}`);
    } finally {
      setActionProcessing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Drawer */}
      <div className="relative w-full max-w-lg bg-[#FAF8F1] h-full shadow-2xl flex flex-col z-10 border-l border-stone-200">
        {/* Drawer Header */}
        <div className="p-4 bg-[#244B36] text-white flex items-center justify-between border-b border-emerald-950">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-400/30">
              <Sparkles className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>SmartIrrigate AI</span>
                <span className="text-[10px] font-semibold bg-emerald-400/20 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Ground-Truth
                </span>
              </h2>
              <p className="text-xs text-emerald-200/80">Agronomic Context & Safety-Interlocked Assistant</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Interlock Banner */}
        <div className="bg-emerald-50/90 border-b border-emerald-100 px-4 py-2 text-[11px] text-emerald-900 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
          <span>Safety Interlock: AI creates approval proposals. Pump actuation requires human confirmation.</span>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-[#244B36] text-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm whitespace-pre-wrap leading-relaxed ${
                      isUser
                        ? 'bg-[#244B36] text-white rounded-tr-none'
                        : 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-none shadow-xs'
                    }`}
                  >
                    {msg.content}

                    {/* Proposed Action Card if generated */}
                    {msg.proposed_action && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-stone-900 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Droplets className="w-4 h-4 text-amber-700" />
                          <span>Proposed Irrigation Action #{msg.proposed_action.action_id}</span>
                        </div>
                        <p className="mt-1 text-stone-700">
                          {msg.proposed_action.description}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500">
                          <span>Target: {msg.proposed_action.target_zone}</span>
                          <span>Duration: {msg.proposed_action.duration_seconds}s</span>
                        </div>

                        {/* Approval buttons */}
                        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-amber-200/60">
                          {msg.proposed_action.status === 'PENDING' ? (
                            <>
                              <button
                                onClick={() => handleActionDecision(msg.proposed_action!.action_id, 'REJECT')}
                                disabled={actionProcessing === msg.proposed_action.action_id}
                                className="px-2.5 py-1 text-xs font-semibold text-stone-600 bg-white hover:bg-stone-100 border border-stone-300 rounded-md transition-colors cursor-pointer"
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => handleActionDecision(msg.proposed_action!.action_id, 'APPROVE')}
                                disabled={actionProcessing === msg.proposed_action.action_id}
                                className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>{actionProcessing === msg.proposed_action.action_id ? 'Authorizing...' : 'Approve & Irrigate'}</span>
                              </button>
                            </>
                          ) : (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                              msg.proposed_action.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              Status: {msg.proposed_action.status}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-stone-400 mt-1 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-stone-300 text-stone-700 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-stone-500">
              <div className="w-8 h-8 rounded-full bg-[#244B36] text-emerald-100 flex items-center justify-center flex-shrink-0 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-stone-200/80 flex items-center gap-2 shadow-xs">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Consulting live farm telemetry...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2 border-t border-stone-200/60 bg-stone-50/80 overflow-x-auto flex gap-1.5 scrollbar-none">
          {quickPrompts.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              disabled={loading}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-200 transition-colors cursor-pointer flex-shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-stone-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about soil, anomalies, water efficiency, or pump action..."
              className="flex-1 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="p-2.5 bg-[#244B36] hover:bg-[#1B3828] text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

