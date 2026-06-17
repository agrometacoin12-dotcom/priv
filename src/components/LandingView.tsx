import React, { useState } from "react";
import { User } from "../types";
import { Key, Lock, ArrowRight, ShieldCheck, HelpCircle, UserCheck } from "lucide-react";
import { motion } from "motion/react";
import { apiAuthByPin } from "../lib/api";
import UserSearch from "./UserSearch";

interface LandingViewProps {
  onAccountCreated: (user: User) => void;
  onAccountAccessed: (user: User) => void;
  onSelectBoard: (userId: string) => void;
}

export default function LandingView({ onAccountCreated, onAccountAccessed, onSelectBoard }: LandingViewProps) {
  const [pinInput, setPinInput] = useState("");
  const [errorSubmit, setErrorSubmit] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleSubmitPin = async (pinValue: string) => {
    if (pinValue.length !== 4 || isNaN(Number(pinValue))) {
      setErrorSubmit("PIN must be exactly 4 digits.");
      return;
    }

    setLoading(true);
    setErrorSubmit("");
    try {
      const data = await apiAuthByPin(pinValue);
      if (data.isNew) {
        onAccountCreated(data.user);
      } else {
        onAccountAccessed(data.user);
      }
    } catch (err: any) {
      setErrorSubmit(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length <= 4) {
      setPinInput(val);
      if (val.length === 4) {
        handleSubmitPin(val);
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmitPin(pinInput);
  };

  return (
    <div id="landing-root" className="max-w-4xl mx-auto px-4 py-8 md:py-16">
      {/* Header Visual and Title */}
      <div className="text-center mb-10">
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
          className="text-base md:text-lg text-slate-500 max-w-xl mx-auto font-normal leading-relaxed"
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Create your own secure board, share your link with anyone, and get completely anonymous posts, likes, and comments. No tracking, no emails, no sign-ups.
        </motion.p>
      </div>

      {/* Main Single Column/Bento Layout */}
      <div className="max-w-md mx-auto">
        <motion.div
          initial={{ y: 25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-md hover:shadow-lg transition-all"
        >
          <div className="text-center mb-6">
            <span className="text-[10px] font-mono tracking-wider font-bold text-brand-700 uppercase bg-brand-50 px-3 py-1 rounded-full">
              🔑 PIN-Only Instant Access
            </span>
            <h2 className="text-xl font-semibold text-slate-850 mt-3">
              Enter 4-Digit Owner PIN
            </h2>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">
              If the PIN exists, we'll open your dashboard. If brand new, we'll immediately initialize a secure new board with that PIN!
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder="• • • •"
                value={pinInput}
                onChange={handleTextChange}
                disabled={loading}
                autoFocus
                className="w-full tracking-[1.5em] text-center font-mono text-3xl font-bold bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white focus:outline-none rounded-2xl py-3.5 px-4 transition-all focus:ring-4 focus:ring-brand-100 select-all placeholder-slate-305"
              />
            </div>

            {errorSubmit && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-semibold text-rose-500 bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-start gap-1.5"
              >
                <span>⚠️ {errorSubmit}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || pinInput.length !== 4}
              className="w-full bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-6 rounded-xl inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs uppercase tracking-wider"
            >
              {loading ? "Authenticating & Initializing..." : "Unlock or Create Board"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Privacy Protection Banner inside Card */}
          <div className="mt-5 pt-5 border-t border-slate-100 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-500 leading-relaxed">
              <strong className="text-slate-700">Fully Private:</strong> Pins are salted and compared in server-side memory. Absolutely no email address, cookies, or names are ever tracked or recorded.
            </div>
          </div>
        </motion.div>

        {/* Search / Explore Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <UserSearch onSelectBoard={onSelectBoard} />
        </motion.div>

        {/* Helpful Guide Toggle */}
        <div className="mt-12 text-center">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs font-semibold transition-all focus:outline-none cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            {showGuide ? "Hide Security Guide" : "How does PIN-only authorization remain secure?"}
          </button>

          {showGuide && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-left bg-slate-50 border border-slate-100 rounded-2xl p-5 text-slate-600 space-y-4 shadow-inner"
            >
              <div>
                <h4 className="font-semibold text-slate-800 text-xs mb-1">🔑 Pin-Only Entry</h4>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  You no longer need to remember complex user tokens, usernames, or link hashes. Pick any clean 4-digit code. Keep it secret – it is your exclusive security credential.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 text-xs mb-1">🐾 Generated Board Persona</h4>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Once registered with your unique PIN, we map a completely random secure board prefix to you and assign a fun, random animal nickname (e.g. "Gentle Otter"). Your real location data is fully sanitized.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 text-xs mb-1">🗨️ Custom Followers Link</h4>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Sharing your "Secure Followers" link lets other users comment, like, and interact without seeing your administration widgets or requiring them to guess passwords.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
