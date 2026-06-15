import React, { useState, useEffect } from "react";
import { User } from "./types";
import LandingView from "./components/LandingView";
import DashboardView from "./components/DashboardView";
import BoardView from "./components/BoardView";
import { Lock, ShieldCheck, Key, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewedBoardId, setViewedBoardId] = useState<string | null>(null);
  const [appMounted, setAppMounted] = useState(false);

  // Initialize state from URL params and localStorage on Mount
  useEffect(() => {
    // 1. Check for ?user=usr_xxx in query string
    const params = new URLSearchParams(window.location.search);
    const urlUser = params.get("user");

    // 2. Check for saved credentials in local storage
    let savedUser: User | null = null;
    try {
      const saved = localStorage.getItem("anon_current_user");
      if (saved) {
        savedUser = JSON.parse(saved);
      }
    } catch (err) {
      console.error("Error reading saved user session", err);
    }

    if (urlUser) {
      setViewedBoardId(urlUser);
      // If the URL user is the exact same as our logged-in local storage session,
      // load the owner dashboard automatically for premium seamless operations!
      if (savedUser && savedUser.id === urlUser) {
        setCurrentUser(savedUser);
      }
    } else if (savedUser) {
      setCurrentUser(savedUser);
    }

    setAppMounted(true);
  }, []);

  const handleCreateAccount = (user: User) => {
    // Store in state & local storage
    setCurrentUser(user);
    try {
      localStorage.setItem("anon_current_user", JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }

    // Direct the owner to their brand new sharing link URL
    const url = new URL(window.location.href);
    url.searchParams.set("user", user.id);
    window.history.pushState({}, "", url.toString());
  };

  const handleAccessAccount = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("anon_current_user", JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }

    // Direct to board URL
    const url = new URL(window.location.href);
    url.searchParams.set("user", user.id);
    window.history.pushState({}, "", url.toString());
    setViewedBoardId(user.id);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setViewedBoardId(null);
    try {
      localStorage.removeItem("anon_current_user");
    } catch (e) {
      console.error(e);
    }

    // Clear URL query parameters
    const url = new URL(window.location.href);
    url.searchParams.delete("user");
    window.history.pushState({}, "", url.toString());
  };

  const handleOwnerUnlockedFromBoard = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("anon_current_user", JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
  };

  const handleGoHome = () => {
    setViewedBoardId(null);
    // Keep user logged in if they have credentials, but clear active board viewing
    const url = new URL(window.location.href);
    url.searchParams.delete("user");
    window.history.pushState({}, "", url.toString());
  };

  // Prevent flicker during initial query search parsing
  if (!appMounted) {
    return (
      <div className="min-h-screen bg-[#fafafb] flex items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-mono">Securing gate tunnels...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="app-root" className="min-h-screen flex flex-col justify-between bg-white">
      
      {/* Dynamic Header: Clean Minimalism */}
      <header className="border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            onClick={handleGoHome}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
            <span className="text-xs font-bold tracking-widest uppercase text-slate-500 font-sans transition-colors group-hover:text-slate-800">
              IncogBoard v2.0
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 py-1 px-3 bg-slate-50 rounded text-xs text-slate-500 border border-slate-100">
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
              <span className="font-sans font-medium text-[11px]">End-to-End Anonymous</span>
            </div>

            {currentUser ? (
              <button
                onClick={handleLogout}
                className="text-xs font-bold tracking-wider text-slate-400 hover:text-slate-900 uppercase transition-colors"
                title="Wipe Session & Lock Portal"
              >
                WIPE SESSION
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 font-mono tracking-widest uppercase bg-slate-50 border border-slate-100 px-2.5 py-1 rounded">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                <span>ONLINE</span>
              </span>
            )}

            {/* Quick action back to dashboard if logged-in but viewing home */}
            {currentUser && !viewedBoardId && (
              <button
                onClick={() => setViewedBoardId(currentUser.id)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-1.5 px-3 rounded-full transition-all"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewedBoardId ? `board-${viewedBoardId}-${currentUser ? "owner" : "guest"}` : "landing"}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25 }}
          >
            {viewedBoardId ? (
              currentUser && currentUser.id === viewedBoardId ? (
                // Owner is view-bound to their own URL
                <DashboardView 
                  user={currentUser} 
                  onLogout={handleLogout}
                  onUpdateUser={(updated) => {
                    setCurrentUser(updated);
                    localStorage.setItem("anon_current_user", JSON.stringify(updated));
                  }}
                />
              ) : (
                // Guest viewing a shared link
                <BoardView 
                  userId={viewedBoardId} 
                  onGoHome={handleGoHome}
                  onOwnerUnlocked={handleOwnerUnlockedFromBoard}
                />
              )
            ) : (
              // General Landing page when no custom user param exists
              <LandingView 
                onAccountCreated={handleCreateAccount}
                onAccountAccessed={handleAccessAccount}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400 font-normal">
        <div className="max-w-4xl mx-auto px-4 flex flex-col d-row items-center justify-between gap-2.5 md:flex-row">
          <span>
            © {new Date().getFullYear()} Anonymous Post Portal. Cryptographically isolated zero-knowledge sharing boards.
          </span>
          <div className="flex gap-4">
            <span className="text-slate-300">|</span>
            <span className="hover:text-slate-600 transition-all">Fully Encrypted</span>
            <span className="text-slate-300">|</span>
            <span className="hover:text-slate-600 transition-all">Zero Cookies Shared</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
