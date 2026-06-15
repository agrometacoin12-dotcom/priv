import React, { useState } from "react";
import { User } from "../types";
import { Key, Plus, LogIn, Lock, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import { motion } from "motion/react";

interface LandingViewProps {
  onAccountCreated: (user: User) => void;
  onAccountAccessed: (user: User) => void;
}

export default function LandingView({ onAccountCreated, onAccountAccessed }: LandingViewProps) {
  const [pinInput, setPinInput] = useState("");
  const [boardIdInput, setBoardIdInput] = useState("");
  const [errorSubmit, setErrorSubmit] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    setErrorSubmit("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to create user account.");
      const data = await res.json();
      onAccountCreated(data);
    } catch (err: any) {
      setErrorSubmit(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorSubmit("");

    // Simple parser for board link if they paste the full URL
    let cleanId = boardIdInput.trim();
    if (cleanId.includes("user=")) {
      const match = cleanId.match(/user=([^&]+)/);
      if (match) cleanId = match[1];
    } else if (cleanId.includes("/")) {
      const parts = cleanId.split("/");
      const last = parts[parts.length - 1];
      if (last.startsWith("usr_")) cleanId = last;
    }

    if (!cleanId.startsWith("usr_")) {
      setErrorSubmit("Please enter a valid Account ID or copy your full profile link.");
      return;
    }

    if (pinInput.length !== 4 || isNaN(Number(pinInput))) {
      setErrorSubmit("PIN must be exactly 4 digits.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${cleanId}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to access portal. Check credentials.");
      }

      const data = await res.json();
      onAccountAccessed({ ...data.user, isOwner: true });
    } catch (err: any) {
      setErrorSubmit(err.message || "Credentials verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="landing-root" className="max-w-4xl mx-auto px-4 py-8 md:py-16">
      {/* Header Visual and Title */}
      <div className="text-center mb-12">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center justify-center p-3.5 bg-brand-50 border border-brand-100 rounded-2xl mb-5"
        >
          <Lock className="w-10 h-10 text-brand-600 animate-pulse" />
        </motion.div>
        
        <motion.h1 
          className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 mb-4"
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          Anonymous Post Portal
        </motion.h1>
        
        <motion.p 
          className="text-lg text-slate-500 max-w-xl mx-auto font-normal leading-relaxed"
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Create your own secure board, share your link with anyone, and get completely anonymous posts, likes, and comments. No tracking, no emails, no sign-ups.
        </motion.p>
      </div>

      {/* Main Column Grid */}
      <div className="grid md:grid-cols-2 gap-8 items-start">
        
        {/* Create Card */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-md transition-all h-full flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono tracking-wider font-semibold text-brand-700 uppercase bg-brand-50 px-2.5 py-1 rounded-full">
                Anonymous Quick Start
              </span>
              <Plus className="w-5 h-5 text-slate-400" />
            </div>
            <h2 className="text-2xl font-display font-semibold text-slate-800 mb-2">
              Generate New Portal
            </h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              We will generate a fully unique, secure board for you instantly. To guarantee total absolute anonymity, you will be assigned a random animal nickname and a 4-digit PIN lock. 
            </p>
            
            <div className="space-y-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Zero Signups Required:</span> No email or phone is stored. Your identity stays completely locked away.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Protected Moderation:</span> Your 4-digit PIN is the ONLY way to verify ownership and delete posts/comments.
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-xl inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? "Generating Safe Portal..." : "Create My Portal"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Access Existing Portal Form */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-md transition-all h-full"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono tracking-wider font-semibold text-teal-700 uppercase bg-teal-50 px-2.5 py-1 rounded-full">
              Already Have a Board?
            </span>
            <LogIn className="w-5 h-5 text-slate-400" />
          </div>
          <h2 className="text-2xl font-display font-semibold text-slate-800 mb-2">
            Access My Portal
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            Enter your board account link or Account ID alongside your 4-digit numeric PIN to manage your board.
          </p>

          <form onSubmit={handleAccess} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Account ID or Direct Link
              </label>
              <input
                type="text"
                placeholder="e.g. usr_a1b2c3d4 or paste direct URL"
                value={boardIdInput}
                onChange={(e) => setBoardIdInput(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Your 4-Digit Owner PIN
              </label>
              <input
                type="password"
                maxLength={4}
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder="••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white focus:outline-none rounded-xl px-4 py-2.5 text-sm font-mono tracking-wider text-center text-lg transition-all"
              />
            </div>

            {errorSubmit && (
              <p className="text-xs font-medium text-rose-500 bg-rose-50 border border-rose-100 p-3 rounded-lg">
                ⚠️ {errorSubmit}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 px-6 rounded-xl inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? "Verifying Keys..." : "Unlock Portal Dashboard"}
              <Lock className="w-4 h-4" />
            </button>
          </form>
        </motion.div>

      </div>

      {/* Mini FAQ Section */}
      <div className="mt-14 border-t border-slate-100 pt-10 text-center">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm font-medium transition-all focus:outline-none cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
          {showGuide ? "Hide How It Works" : "How does this remain fully anonymous?"}
        </button>

        {showGuide && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-left bg-slate-50 border border-slate-100 rounded-2xl p-6 text-slate-600 space-y-4 max-w-2xl mx-auto"
          >
            <div>
              <h4 className="font-semibold text-slate-800 text-sm mb-1">How is my identity private?</h4>
              <p className="text-xs leading-relaxed">
                Nothing about your device details, real names, or emails is requested. When you generate a board, the server assigns a random alias (e.g. "Silent Koala"). The portal URL has a completely random secret path.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm mb-1">What can visitors do?</h4>
              <p className="text-xs leading-relaxed">
                Anyone visiting your shared link can view posts, press like, and add comments. You receive them inside your dashboard immediately. They will also be completely anonymous—when commenting, visitors are issued a fun, temporary pseudonym like "Inquisitive Wanderer".
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm mb-1">What is the PIN for?</h4>
              <p className="text-xs leading-relaxed">
                The 4-digit PIN serves as your cryptographic authority. This allows you—and ONLY you—to add posts, delete any unauthorized comment or post, and toggle whether your random nickname is displayed to visitors or fully hidden.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
