import React, { useState, useEffect } from "react";
import { User, Post, Comment } from "../types";
import { 
  Lock, Share2, Copy, CheckCircle, Eye, EyeOff, Trash2, 
  Plus, MessageSquare, Heart, Shield, LogOut, Settings, 
  MapPin, UserCheck, AlertCircle, RefreshCw, Key, QrCode
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  apiGetPosts, apiGetComments, apiCreatePost, apiDeletePost, 
  apiDeleteComment, apiToggleNickname, apiChangePin 
} from "../lib/api";

interface DashboardViewProps {
  user: User;
  onLogout: () => void;
  onUpdateUser: (updatedUser: User) => void;
}

type TabType = "feed" | "profile";

export default function DashboardView({ user, onLogout, onUpdateUser }: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  
  // Form states
  const [newPostContent, setNewPostContent] = useState("");
  const [nicknamePrivate, setNicknamePrivate] = useState(user.isNicknamePrivate);
  
  // Pin update states
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinMessage, setPinMessage] = useState<{ text: string; error: boolean } | null>(null);
  
  // Utility states
  const [copied, setCopied] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Absolute direct URL path
  const directLinkUrl = `${window.location.origin}/?user=${user.id}`;

  const fetchPostsAndData = async () => {
    setFeedLoading(true);
    setActionError(null);
    try {
      const data = await apiGetPosts(user.id);
      setPosts(data.posts || []);
    } catch (err: any) {
      setActionError(err.message || "An issue occurred connecting to backend.");
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    fetchPostsAndData();
    setNicknamePrivate(user.isNicknamePrivate);
  }, [user.id, user.isNicknamePrivate]);

  const loadComments = async (postId: string) => {
    try {
      const comments = await apiGetComments(postId);
      setCommentsMap(prev => ({ ...prev, [postId]: comments }));
    } catch (err) {
      console.error("Error loading comments", err);
    }
  };

  const handlePostExpand = (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
    } else {
      setExpandedPostId(postId);
      loadComments(postId);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    setActionError(null);
    try {
      const created = await apiCreatePost(user.id, user.pin || "", newPostContent.trim());
      setPosts(prev => [created, ...prev]);
      setNewPostContent("");
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you fully sure you want to delete this post? All comments on it will also be deleted forever.")) return;

    setActionError(null);
    try {
      await apiDeletePost(postId, user.id, user.pin || "");
      setPosts(prev => prev.filter(p => p.id !== postId));
      if (expandedPostId === postId) setExpandedPostId(null);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!confirm("Are you sure you want to moderate and delete this comment?")) return;

    setActionError(null);
    try {
      await apiDeleteComment(commentId, user.id, user.pin || "");
      // Reload comments for this post
      loadComments(postId);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleToggleNickname = async (checked: boolean) => {
    setNicknamePrivate(checked);
    setActionError(null);
    try {
      const resData = await apiToggleNickname(user.id, user.pin || "", checked);
      onUpdateUser({ ...user, isNicknamePrivate: resData.isNicknamePrivate });
    } catch (err: any) {
      setNicknamePrivate(!checked); // revert state
      setActionError(err.message);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      setPinMessage({ text: "New PIN must be exactly 4 digits.", error: true });
      return;
    }

    try {
      const resData = await apiChangePin(user.id, currentPin, newPin);
      onUpdateUser({ ...user, pin: resData.pin });
      setPinMessage({ text: "PIN updated successfully! Remember to save it.", error: false });
      setCurrentPin("");
      setNewPin("");
    } catch (err: any) {
      setPinMessage({ text: err.message, error: true });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directLinkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="dashboard-root" className="max-w-4xl mx-auto px-4 py-6 md:py-10">
      
      {/* Top Banner indicating Owner Access */}
      <div className="bg-slate-900 border border-slate-800 text-white p-5 rounded-2xl mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm portal-glow">
        <div className="flex items-center gap-3">
          <div className="bg-brand-600 p-2 rounded-xl text-white">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold text-lg">
                Your Private Moderator Portal
              </span>
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 bg-brand-700/50 text-brand-100 rounded">
                Portal Loaded
              </span>
            </div>
            <p className="text-xs text-slate-400">
              You are currently viewing with complete admin permission. Visitors viewing your direct link will never see these controls!
            </p>
          </div>
        </div>
        
        <button
          onClick={onLogout}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium py-2 px-4 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 self-stretch md:self-auto justify-center"
        >
          <LogOut className="w-3.5 h-3.5" />
          Lock Portal
        </button>
      </div>

      {/* Profile summary card & Copy Hub */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">
              <UserCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>Logged In Alias</span>
            </div>
            <h3 className="text-2xl font-display font-bold text-slate-800">
              {user.nickname}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Account Created: {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="w-full md:w-auto flex-1 max-w-md bg-slate-50 border border-slate-100 rounded-xl p-3.5">
            <span className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Your Shareable Board Link
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={directLinkUrl}
                className="bg-white border border-slate-200 select-all rounded-lg px-3 py-1.5 text-xs text-slate-500 font-mono w-full focus:outline-none"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all flex-1 sm:flex-initial justify-center ${
                    copied 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all flex-1 sm:flex-initial justify-center"
                  title="Generate sharing QR Code"
                >
                  <QrCode className="w-3.5 h-3.5 text-slate-500" />
                  <span>QR Code</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="border-b border-slate-100 mb-8 flex gap-6">
        <button
          onClick={() => setActiveTab("feed")}
          className={`pb-3 font-display font-semibold text-sm relative transition-all cursor-pointer ${
            activeTab === "feed" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          My Posts Board & Comments
          {activeTab === "feed" && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3 font-display font-semibold text-sm relative transition-all cursor-pointer ${
            activeTab === "profile" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Security & Identity Locks
          {activeTab === "profile" && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
          )}
        </button>
      </div>

      {/* Action Errors helper */}
      {actionError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tab Panels */}
      <div>
        
        {/* TAB 1: FEED MODERATION */}
        {activeTab === "feed" && (
          <div className="space-y-6">
            
            {/* Create Box */}
            <form onSubmit={handleCreatePost} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-800 mb-3 block">
                Publish a New Anonymous Post to Your Board
              </h4>
              <textarea
                placeholder="What is on your mind? Everything published here is displayed anonymously to anyone who opens your link."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                maxLength={1000}
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white focus:outline-none rounded-xl px-4 py-3 text-sm min-h-[100px] max-h-[250px] resize-y transition-all"
              />
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-slate-400 font-mono">
                  {newPostContent.length}/1000 characters
                </span>
                <button
                  type="submit"
                  disabled={!newPostContent.trim()}
                  className="bg-slate-950 hover:bg-slate-900 text-white font-semibold py-2 px-4 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Publish Anonymously
                </button>
              </div>
            </form>

            {/* Posts Lists */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-bold text-slate-800 text-lg">
                  Board Posts ({posts.length})
                </h3>
                <button 
                  onClick={fetchPostsAndData}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                  title="Reload Board Feed"
                >
                  <RefreshCw className={`w-4 h-4 ${feedLoading ? "animate-spin text-brand-600" : ""}`} />
                </button>
              </div>

              {feedLoading && posts.length === 0 ? (
                <div className="border border-slate-100 rounded-2xl p-12 text-center bg-white">
                  <RefreshCw className="w-8 h-8 animate-spin text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Synchronizing your anonymous board...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-2xl p-10 text-center bg-white">
                  <div className="bg-slate-50 p-3 rounded-full inline-block mb-3">
                    <MessageSquare className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-700 font-semibold text-sm">No posts on your board yet</p>
                  <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                    Type a message above in the entry box, or copy your link and share it so others can see your space!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {posts.map((post) => {
                      const isExpanded = expandedPostId === post.id;
                      const comments = commentsMap[post.id] || [];

                      return (
                        <motion.div
                          key={post.id}
                          layout
                          initial={{ opacity: 0, y: 15, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95, y: -15 }}
                          transition={{ 
                            type: "spring",
                            stiffness: 400,
                            damping: 38,
                            mass: 0.8
                          }}
                          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm"
                        >
                          {/* Post Header */}
                          <div className="flex justify-between items-start gap-4 mb-3">
                            <div className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                              Posted {new Date(post.createdAt).toLocaleString()}
                            </div>
                            
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50/50 transition-all cursor-pointer"
                              title="Delete this Post"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Post Content */}
                          <p className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed select-text mb-4">
                            {post.content}
                          </p>

                          {/* Actions Row */}
                          <div className="flex items-center gap-4 pt-3 border-t border-slate-50 text-xs font-semibold text-slate-500">
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                              <span>{post.likesCount} Likes</span>
                            </div>

                            <button
                              onClick={() => handlePostExpand(post.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                                isExpanded 
                                  ? "bg-brand-50 text-brand-700" 
                                  : "hover:bg-slate-50 text-slate-500"
                              }`}
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>{isExpanded ? "Hide Comments" : `Comments (${comments.length})`}</span>
                            </button>
                          </div>

                          {/* Comments Drawer Expansion */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden mt-4 pt-4 border-t border-slate-100 space-y-3"
                              >
                                <h5 className="text-[11px] font-mono tracking-wider font-bold uppercase text-slate-400 mb-2">
                                  Comments Timeline & Moderation
                                </h5>

                                {comments.length === 0 ? (
                                  <p className="text-slate-400 text-xs italic py-2">
                                    No comments on this post yet. Readers can comment using your public shared link!
                                  </p>
                                ) : (
                                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {comments.map((comment) => (
                                      <div 
                                        key={comment.id}
                                        className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-start justify-between gap-3 text-xs"
                                      >
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-slate-700 font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                                              {comment.nickname}
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-mono">
                                              {new Date(comment.createdAt).toLocaleTimeString()}
                                            </span>
                                          </div>
                                          <p className="text-slate-600 leading-relaxed break-words whitespace-pre-wrap">
                                            {comment.content}
                                          </p>
                                        </div>

                                        <button
                                          onClick={() => handleDeleteComment(post.id, comment.id)}
                                          className="text-slate-300 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 transition-all cursor-pointer self-start"
                                          title="Delete Comment"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: PROFILE & OWNER VERIFICATION */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            
            {/* Owner PIN Verification Box */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm text-center max-w-xl mx-auto"
            >
              <div className="inline-flex p-3 bg-teal-50 text-teal-700 border border-teal-100 rounded-full mb-4">
                <Key className="w-6 h-6 shrink-0" />
              </div>
              
              <h3 className="text-xl font-display font-semibold text-slate-800 mb-2">
                Ownership Credentials
              </h3>
              
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                This is your absolute proof of dashboard ownership. Store it safely. No server admin can recover this PIN if you lose your link or number!
              </p>

              {/* ONLY PIN IS DISPLAYED TO VERIFY OWNERSHIP ON THE PROFILE TAB */}
              <div className="bg-slate-900 text-white rounded-xl p-6 mb-6 max-w-xs mx-auto shadow-sm">
                <span className="block text-[10px] font-mono tracking-widest uppercase font-bold text-slate-400 mb-2">
                  Permanent 4-Digit PIN
                </span>
                
                <div className="flex items-center justify-center gap-4">
                  <span className="font-mono text-4xl font-bold tracking-[0.5em] text-emerald-400 pl-4">
                    {showPin ? user.pin?.split("").join(" ") : "• • • •"}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-slate-400 hover:text-white focus:outline-none transition-all p-1 hover:bg-slate-800 rounded cursor-pointer"
                    title={showPin ? "Hide PIN" : "Show PIN"}
                  >
                    {showPin ? <EyeOff className="w-5 h-5 text-slate-300" /> : <Eye className="w-5 h-5 text-slate-300" />}
                  </button>
                </div>
              </div>

              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 max-w-md mx-auto p-3.5 rounded-xl text-left leading-relaxed flex gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Anonymity Guard:</strong> Under strict privacy laws, only this exact PIN binds you to the board. Do not share your PIN with anyone with whom you only want to share positive vibes.
                </span>
              </div>
            </motion.div>

            {/* Privacy Toggles */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm max-w-xl mx-auto"
            >
              <h3 className="text-md font-display font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                Board Display Settings
              </h3>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-50">
                  <div className="space-y-0.5">
                    <span className="block text-sm font-semibold text-slate-800">
                      Toggle Nickname to Private
                    </span>
                    <span className="block text-xs text-slate-400 leading-normal">
                      When enabled, public visitors see "Anonymous Creator" rather than your random name alias.
                    </span>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={nicknamePrivate}
                      onChange={(e) => handleToggleNickname(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                  </label>
                </div>

                <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-slate-500" />
                  <span>
                    Current Public View status: <strong>{nicknamePrivate ? "Strictly Anonymous Board (Fully Hidden)" : `Public Name: ${user.nickname}`}</strong>
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Change PIN locker */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm max-w-xl mx-auto"
            >
              <h3 className="text-md font-display font-semibold text-slate-800 mb-4">
                Update 4-Digit Owner PIN
              </h3>

              <form onSubmit={handleUpdatePin} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Current PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      placeholder="••••"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-center tracking-widest text-lg transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      New 4-Digit PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      placeholder="••••"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full bg-slate-50 border border-slate-200 focus:border-brand-600 focus:bg-white focus:outline-none rounded-xl px-3 py-2 text-sm font-mono text-center tracking-widest text-lg transition-all"
                    />
                  </div>
                </div>

                {pinMessage && (
                  <p className={`text-xs p-3 rounded-lg font-medium ${
                    pinMessage.error 
                      ? "bg-rose-50 border border-rose-100 text-rose-600" 
                      : "bg-emerald-50 border border-emerald-100 text-emerald-700"
                  }`}>
                    {pinMessage.text}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Save New Authorization PIN
                </button>
              </form>
            </motion.div>

          </div>
        )}

      </div>

      {/* QR Code sharing Modal Dialog */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 max-w-sm w-full shadow-xl text-center relative animate-fade-in"
            >
              <h4 className="text-lg font-display font-semibold text-slate-800 mb-2 flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5 text-slate-900" />
                Share Link QR Code
              </h4>
              <p className="text-slate-400 text-xs mb-6">
                Scan this code with a phone camera to quickly pull up your anonymous board website.
              </p>

              {/* qrserver.com simple QR API */}
              <div className="bg-slate-50 p-4 rounded-2xl inline-block border border-slate-100 mb-6">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(directLinkUrl)}`}
                  alt="Board Link QR Code"
                  width={200}
                  height={200}
                  className="rounded-lg bg-white"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="text-xs text-slate-500 font-mono break-all bg-slate-50 p-3 rounded-lg border border-slate-100 select-all mb-6">
                {directLinkUrl}
              </div>

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                Close Share View
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
