import React, { useState, useEffect } from "react";
import { User, Post, Comment } from "../types";
import { 
  Heart, MessageSquare, CornerDownRight, Plus, ShieldCheck, 
  Sparkles, Compass, AlertCircle, RefreshCw, Key, Lock, ArrowRight,
  ArrowLeft, CheckCircle2, Search, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BoardViewProps {
  userId: string;
  onGoHome: () => void;
  onOwnerUnlocked: (user: User) => void;
}

export default function BoardView({ userId, onGoHome, onOwnerUnlocked }: BoardViewProps) {
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  
  // Search query state
  const [searchQuery, setSearchQuery] = useState("");
  
  // States for comment drawers
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  
  // Tracking likes in localStorage to prevent spamming
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  
  // States for entering lock PIN
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState("");
  
  // Loading & error statuses
  const [loading, setLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [addingCommentMap, setAddingCommentMap] = useState<Record<string, boolean>>({});

  // Sync profile & post data
  const loadBoardData = async () => {
    setLoading(true);
    setBoardError(null);
    try {
      // 1. Fetch Profile info
      const profileRes = await fetch(`/api/users/${userId}`);
      if (!profileRes.ok) {
        if (profileRes.status === 404) {
          throw new Error("This anonymous board does not exist or was deleted.");
        }
        throw new Error("Error fetching anonymous board profile.");
      }
      const profileData = await profileRes.json();
      setProfile(profileData);

      // 2. Fetch Board posts
      const postsRes = await fetch(`/api/users/${userId}/posts`);
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        const loadedPosts: Post[] = postsData.posts || [];
        setPosts(loadedPosts);

        // Preload comments for robust text/username search filtering
        const commentsPromises = loadedPosts.map(async (pos) => {
          try {
            const res = await fetch(`/api/posts/${pos.id}/comments`);
            if (res.ok) {
              const data = await res.json();
              return { postId: pos.id, comments: data };
            }
          } catch (err) {
            console.error(err);
          }
          return { postId: pos.id, comments: [] };
        });

        const results = await Promise.all(commentsPromises);
        const map: Record<string, Comment[]> = {};
        results.forEach(res => {
          map[res.postId] = res.comments;
        });
        setCommentsMap(map);
      }
    } catch (err: any) {
      setBoardError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoardData();
    // Load liked posts from localStorage
    try {
      const saved = localStorage.getItem("anon_liked_posts");
      if (saved) {
        setLikedPosts(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, [userId]);

  const loadComments = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setCommentsMap(prev => ({ ...prev, [postId]: data }));
      }
    } catch (err) {
      console.error("Error loading comments", err);
    }
  };

  const handleToggleComments = (postId: string) => {
    if (expandedCommentsPostId === postId) {
      setExpandedCommentsPostId(null);
    } else {
      setExpandedCommentsPostId(postId);
      loadComments(postId);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (likedPosts.includes(postId)) return; // already liked

    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        
        // Update posts local state
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likesCount: data.likesCount } : p));
        
        // Track liked state in local storage
        const updatedLiked = [...likedPosts, postId];
        setLikedPosts(updatedLiked);
        localStorage.setItem("anon_liked_posts", JSON.stringify(updatedLiked));
      }
    } catch (err) {
      console.error("Error liking post", err);
    }
  };

  const handleAddComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    setAddingCommentMap(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) throw new Error("Failed to post comment.");

      // Clear input
      setCommentInputs(prev => ({ ...prev, [postId]: "" }));
      
      // Reload comments to show the newly added comment
      await loadComments(postId);
    } catch (err) {
      console.error(err);
      alert("Error submitting comment. Please try again.");
    } finally {
      setAddingCommentMap(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleUnlockDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError("");

    if (unlockPin.length !== 4 || isNaN(Number(unlockPin))) {
      setUnlockError("PIN must be exactly 4 digits.");
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: unlockPin }),
      });

      if (!res.ok) {
        throw new Error("Invalid owner PIN. Lock remains active.");
      }

      const data = await res.json();
      onOwnerUnlocked({ ...data.user, isOwner: true });
      setShowUnlockModal(false);
    } catch (err: any) {
      setUnlockError(err.message || "Verification failed.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <RefreshCw className="w-10 h-10 text-brand-600 animate-spin mx-auto mb-4" />
        <h3 className="font-display font-semibold text-slate-800">Entering safe board space...</h3>
        <p className="text-slate-400 text-xs mt-1">Downloading content securely from anonymous vaults.</p>
      </div>
    );
  }

  if (boardError || !profile) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex p-3 bg-rose-50 text-rose-600 rounded-full mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="font-display font-semibold text-slate-800 text-xl mb-2">
          Board Not Accessible
        </h3>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          {boardError || "This anonymous board ID is invalid or has been permanently deleted by its moderator."}
        </p>
        <button
          onClick={onGoHome}
          className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-5 rounded-xl text-sm transition-all cursor-pointer"
        >
          Go to Landing Home
        </button>
      </div>
    );
  }

  // Filter posts based on searchQuery (matching username/nickname and keywords)
  const filteredPosts = posts.filter(post => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    // Filter by post content
    if (post.content.toLowerCase().includes(q)) return true;

    // Filter by comment nicknames or content
    const comments = commentsMap[post.id] || [];
    return comments.some(comment => 
      comment.nickname.toLowerCase().includes(q) ||
      comment.content.toLowerCase().includes(q)
    );
  });

  return (
    <div id="board-root" className="max-w-2xl mx-auto px-4 py-8 relative">
      
      {/* Return Home Nav */}
      <button
        onClick={onGoHome}
        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-semibold mb-6 transition-all group cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>Exit and Create App Board</span>
      </button>

      {/* Board Welcome Banner for Visitors */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm text-center mb-8">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono tracking-widest uppercase font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          Secure Anonymous Connection
        </span>
        
        {/* Profile Name & Toggle status */}
        <h2 className="text-3xl font-display font-bold text-slate-900 mb-1">
          {profile.isNicknamePrivate ? "Anonymous Board" : `${profile.nickname}`}
        </h2>
        
        <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto leading-relaxed">
          {profile.isNicknamePrivate 
            ? "This creator keeps their profile alias strictly hidden. Leave feedback, likes, and comments securely."
            : "Browse this creator's public board, drop sweet feedback, or comments anonymously."}
        </p>

        <div className="border-t border-slate-50 pt-4 flex justify-center">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-100">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Comments are assigned <strong>anonymous creature names</strong> automatically!</span>
          </div>
        </div>
      </div>

      {/* Want Your Own Board prompt */}
      <div className="bg-brand-50 border border-brand-100/50 p-4 rounded-xl mb-8 flex items-center justify-between gap-3 text-xs">
        <div className="text-slate-600">
          <strong>Enjoying this?</strong> Open your own anonymous portal instantly in 1 second.
        </div>
        <button
          onClick={onGoHome}
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-1.5 px-3 rounded-lg transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
        >
          Start Board
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Primary Posts Board Feed */}
      <div className="space-y-6">
        <h3 className="font-display font-bold text-slate-800 text-lg">
          Board Posts ({posts.length})
        </h3>

        {posts.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-2xl p-10 text-center bg-white">
            <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-600 font-semibold text-sm">No active posts on this board</p>
            <p className="text-slate-400 text-xs mt-1">
              Ask this creator to publish a new message or question here!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Elegant Search Input Bar */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-2.5">
              <label htmlFor="board-search" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block px-1">
                Filter Board Contents & Comments
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  id="board-search"
                  type="text"
                  placeholder="Search keywords, comment text, or usernames (e.g. 'thoughtful', 'Golden Wolf')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-slate-400 focus:outline-none rounded-xl pl-10 pr-9 py-2.5 text-xs text-slate-700 placeholder-slate-400 transition-all font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between px-1">
                  <span>Found {filteredPosts.length} matching posts out of {posts.length} total</span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-slate-500 hover:text-slate-800 underline uppercase font-bold cursor-pointer"
                  >
                    Reset Filter
                  </button>
                </div>
              )}
            </div>

            {filteredPosts.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-2xl p-10 text-center bg-white">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-650 font-semibold text-sm">No matching content found</p>
                <p className="text-slate-400 text-xs mt-1">
                  No post content, comment username, or comment text matches your query "{searchQuery}".
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear Search Filter
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => {
                  const hasLiked = likedPosts.includes(post.id);
                  const isExpanded = expandedCommentsPostId === post.id;
                  const comments = commentsMap[post.id] || [];
                  const textVal = commentInputs[post.id] || "";

                  return (
                    <div
                      key={post.id}
                      className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm"
                    >
                      {/* Metadata header */}
                      <div className="text-slate-400 font-mono text-[9px] uppercase tracking-wider mb-2">
                        Published {new Date(post.createdAt).toLocaleDateString()} @ {new Date(post.createdAt).toLocaleTimeString()}
                      </div>

                      {/* Post Content */}
                      <p className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed select-text mb-4">
                        {post.content}
                      </p>

                      {/* Likings & Comment expansion */}
                      <div className="flex items-center gap-4 pt-3 border-t border-slate-50 text-xs font-semibold">
                        
                        <button
                          onClick={() => handleLikePost(post.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                            hasLiked 
                              ? "text-rose-600 bg-rose-50" 
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${hasLiked ? "fill-rose-500 text-rose-500 font-bold" : ""}`} />
                          <span>{post.likesCount} {hasLiked ? "Liked!" : "Like"}</span>
                        </button>

                        <button
                          onClick={() => handleToggleComments(post.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                            isExpanded 
                              ? "bg-brand-50 text-brand-700" 
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                          }`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Comments {comments.length > 0 ? `(${comments.length})` : ""}</span>
                        </button>
                      </div>

                      {/* Comments Panel */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mt-4 pt-4 border-t border-slate-100 space-y-4"
                          >
                            {/* Submitting a Comment Form */}
                            <form onSubmit={(e) => handleAddComment(post.id, e)} className="space-y-2">
                              <textarea
                                placeholder="Add a friendly comment... Anything you write stays completely anonymous!"
                                required
                                maxLength={300}
                                value={textVal}
                                onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white focus:outline-none rounded-xl px-3 py-2 text-xs min-h-[60px] max-h-[120px] transition-all"
                              />
                              <div className="flex justify-between items-center text-[10px] text-slate-400">
                                <span>{textVal.length}/300 characters</span>
                                <button
                                  type="submit"
                                  disabled={!textVal.trim() || addingCommentMap[post.id]}
                                  className="bg-slate-900 border border-slate-900 text-white font-semibold py-1.5 px-3.5 rounded-lg transition-all hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                                >
                                  {addingCommentMap[post.id] ? "Submitting..." : "Post Comment"}
                                </button>
                              </div>
                            </form>

                            {/* List of comments */}
                            <div className="space-y-2 pt-2">
                              <h5 className="font-display font-semibold text-xs text-slate-700">
                                Comments Timeline
                              </h5>
                              
                              {comments.length === 0 ? (
                                <p className="text-slate-400 text-xs italic py-1 pl-1">
                                  No comments yet. Be the first to add an anonymous comment!
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {comments.map((comment) => (
                                    <div 
                                      key={comment.id}
                                      className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-start gap-2.5 text-xs"
                                    >
                                      <CornerDownRight className="w-3.5 h-3.5 text-slate-400 mt-1 shrink-0" />
                                      <div className="space-y-0.5 break-all w-full">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono text-[9px] font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                                            {comment.nickname}
                                          </span>
                                          <span className="text-[8px] font-mono text-slate-400">
                                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap select-text pr-1 pt-0.5">
                                          {comment.content}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer block containing Private Owner Access Portal Unlock */}
      <div className="mt-16 border-t border-slate-100 pt-8 text-center pb-12">
        <button
          onClick={() => setShowUnlockModal(true)}
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-semibold py-1 px-3.5 bg-slate-50 border border-slate-100 rounded-xl transition-all hover:bg-slate-100 cursor-pointer focus:outline-none"
        >
          <Key className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
          Manage Board (Owner PIN Access)
        </button>
      </div>

      {/* Unlock Owner Modal Dialog */}
      <AnimatePresence>
        {showUnlockModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 max-w-sm w-full shadow-xl relative"
            >
              <h4 className="text-xl font-display font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                Unlock Moderator Board
              </h4>
              <p className="text-slate-400 text-xs mb-6">
                Enter the secret 4-digit PIN associated with this unique board to open your creator dashboard.
              </p>

              <form onSubmit={handleUnlockDashboard} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-2">
                    Enter Owner PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="••••"
                    autoFocus
                    value={unlockPin}
                    onChange={(e) => setUnlockPin(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-40 bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white focus:outline-none rounded-xl py-2 px-3 text-2xl font-mono tracking-widest text-center mx-auto block transition-all"
                  />
                </div>

                {unlockError && (
                  <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 p-2.5 rounded-lg text-center font-medium">
                    ⚠️ {unlockError}
                  </p>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnlockModal(false);
                      setUnlockPin("");
                      setUnlockError("");
                    }}
                    className="w-1/2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  >
                    Access Portal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
