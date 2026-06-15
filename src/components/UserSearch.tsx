import React, { useState, useEffect } from "react";
import { User } from "../types";
import { Search, ArrowRight, User as UserIcon, Calendar, Compass, RefreshCw } from "lucide-react";
import { apiSearchUsers } from "../lib/api";

interface UserSearchProps {
  onSelectBoard: (userId: string) => void;
  currentUserId?: string;
  compact?: boolean;
}

export default function UserSearch({ onSelectBoard, currentUserId, compact = false }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = async (searchVal: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiSearchUsers(searchVal);
      // Filter out current user if viewing from dashboard
      const filtered = currentUserId 
        ? data.filter(u => u.id !== currentUserId) 
        : data;
      setResults(filtered);
    } catch (err: any) {
      setError("Failed to load boards. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load of latest active public boards
  useEffect(() => {
    performSearch("");
  }, [currentUserId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  return (
    <div className={`bg-white border border-slate-100 rounded-2xl p-5 md:p-6 shadow-sm ${compact ? "max-w-md mx-auto" : "w-full"}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-brand-50 p-2 rounded-lg text-brand-600">
          <Compass className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            {query.trim() ? "Search Results" : "Explore Public Boards"}
          </h3>
          <p className="text-[11px] text-slate-400">
            {query.trim() ? `Search results for "${query}"` : "Discover and browse other public anonymous portals"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="relative mb-5 flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by nickname (e.g. 'Panda' or 'Calm') or Account ID..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Trigger search automatically when input is cleared
              if (!e.target.value.trim()) {
                performSearch("");
              }
            }}
            className="w-full bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white focus:outline-none rounded-xl pl-10 pr-4 py-2 text-xs transition-all"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
        <button
          type="submit"
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1 shrink-0"
        >
          <span>Search</span>
        </button>
      </form>

      {error && (
        <p className="text-[11px] font-medium text-rose-500 bg-rose-50 border border-rose-100 p-2 rounded-lg mb-4">
          ⚠️ {error}
        </p>
      )}

      {loading ? (
        <div className="py-8 text-center">
          <RefreshCw className="w-5 h-5 animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-[11px] font-mono text-slate-400">Searching signal logs...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="py-8 bg-slate-50/50 border border-dashed border-slate-100 rounded-xl text-center">
          <p className="text-xs text-slate-500 font-semibold mb-1">No matching boards found</p>
          <p className="text-[11px] text-slate-400 px-4">
            Try looking for simple names like "Panda", "Fox", "Silent", or ensure the ID format is correct.
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {results.map((u) => (
            <div
              key={u.id}
              onClick={() => onSelectBoard(u.id)}
              className="bg-slate-50 hover:bg-brand-50/30 border border-slate-100 hover:border-brand-200 p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="p-1 bg-white border border-slate-100 rounded-lg text-slate-500 shrink-0">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 truncate block group-hover:text-brand-900">
                      {u.nickname}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded shrink-0">
                    {u.id.substring(4, 10)}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-3">
                  <Calendar className="w-3 h-3" />
                  <span>Created {new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-brand-600 pt-1 border-t border-slate-100 group-hover:text-brand-700">
                <span>Browse Board</span>
                <ArrowRight className="w-3.5 h-3.5 -translate-x-1 group-hover:translate-x-0 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
