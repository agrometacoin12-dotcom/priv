import React, { useState, useEffect } from "react";
import { User, Post, Comment } from "../types";
import { 
  Lock, Share2, Copy, CheckCircle, Eye, EyeOff, Trash2, 
  Plus, MessageSquare, Heart, Shield, LogOut, Settings, 
  MapPin, UserCheck, AlertCircle, RefreshCw, Key, QrCode, Compass, Bell, BellOff, ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  apiGetPosts, apiGetComments, apiCreatePost, apiDeletePost, 
  apiDeleteComment, apiToggleNickname, apiChangePin, apiReactToPost,
  apiGetGlobalPosts, apiFollowUser, apiGetFollowStatus, apiCreateComment, GlobalPost
} from "../lib/api";
import UserSearch from "./UserSearch";

interface DashboardViewProps {
  user: User;
  onLogout: () => void;
  onUpdateUser: (updatedUser: User) => void;
  onSelectBoard: (userId: string, postId?: string) => void;
}

const EMOJI_LIST = ["❤️", "🔥", "👏", "😂", "😮", "😢"];

const getReactionCount = (post: Post, emoji: string): number => {
  const rx = post.reactions || {};
  if (rx[emoji] !== undefined) {
    return rx[emoji];
  }
  if (emoji === "❤️") {
    const hasOtherCustomReactions = Object.values(rx).some(v => v > 0);
    return hasOtherCustomReactions ? 0 : post.likesCount;
  }
  return 0;
};

type TabType = "feed" | "post_feed" | "profile" | "explore";

export default function DashboardView({ user, onLogout, onUpdateUser, onSelectBoard }: DashboardViewProps) {
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
  const [copiedFollow, setCopiedFollow] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [userReactions, setUserReactions] = useState<Record<string, string[]>>({});
  const [openReactMenuPostId, setOpenReactMenuPostId] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // --- GLOBAL POST FEED HOST STATES & HANDLERS ---
  const [globalPosts, setGlobalPosts] = useState<GlobalPost[]>([]);
  const [feedFilter, setFeedFilter] = useState<"all" | "following">("all");
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [loadingGlobalFeed, setLoadingGlobalFeed] = useState(false);
  const [commentFeedInputs, setCommentFeedInputs] = useState<Record<string, string>>({});
  const [addingCommentGlobalMap, setAddingCommentGlobalMap] = useState<Record<string, boolean>>({});

  const loadGlobalFeed = async () => {
    setLoadingGlobalFeed(true);
    setActionError(null);
    try {
      const allPosts = await apiGetGlobalPosts();
      setGlobalPosts(allPosts);

      const uniqueCreators = Array.from(new Set(allPosts.map((p) => p.authorId)));
      const followMap: Record<string, boolean> = {};
      
      for (const creatorId of uniqueCreators) {
        if (creatorId === user.id) {
          followMap[creatorId] = false;
          continue;
        }
        try {
          const status = await apiGetFollowStatus(creatorId, user.id);
          followMap[creatorId] = status.isFollowing;
        } catch (err) {
          console.error(`Error loading follow status for creator ${creatorId}`, err);
        }
      }
      setFollowingMap(followMap);
    } catch (err: any) {
      setActionError("Failed to charge global community post timeline.");
    } finally {
      setLoadingGlobalFeed(false);
    }
  };

  const handleToggleFollowGlobal = async (followedId: string) => {
    try {
      const res = await apiFollowUser(followedId, user.id);
      setFollowingMap((prev) => ({ ...prev, [followedId]: res.followed }));
    } catch (err) {
      console.error("Error toggling follow", err);
    }
  };

  const handleAddCommentGlobal = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = commentFeedInputs[postId]?.trim();
    if (!text) return;

    setAddingCommentGlobalMap((prev) => ({ ...prev, [postId]: true }));
    try {
      await apiCreateComment(postId, text);
      const cms = await apiGetComments(postId);
      setCommentsMap((prev) => ({ ...prev, [postId]: cms }));
      setCommentFeedInputs((prev) => ({ ...prev, [postId]: "" }));
    } catch (err) {
      console.error("Error adding comment in global feed", err);
    } finally {
      setAddingCommentGlobalMap((prev) => ({ ...prev, [postId]: false }));
    }
  };

  useEffect(() => {
    if (activeTab === "post_feed") {
      loadGlobalFeed();
    }
  }, [activeTab]);
  // --- END OF GLOBAL POST FEED HOST STATES & HANDLERS ---

  // Suggested referred post tracking
  const [referredPost, setReferredPost] = useState<{ userId: string; postId: string; authorNickname?: string } | null>(null);

  // Absolute direct URL path
  const directLinkUrl = `${window.location.origin}/?user=${user.id}`;
  const followLinkUrl = `${window.location.origin}/?user=${user.id}&mode=follow`;

  const handleSharePost = (postId: string) => {
    const postUrl = `${window.location.origin}/?user=${user.id}&post=${postId}`;
    try {
      navigator.clipboard.writeText(postUrl);
      setCopiedPostId(postId);
      setTimeout(() => setCopiedPostId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const checkReferral = async () => {
      try {
        const saved = localStorage.getItem("anon_referred_post");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.userId !== user.id) {
            const { apiGetUser } = await import("../lib/api");
            const author = await apiGetUser(parsed.userId);
            setReferredPost({
              userId: parsed.userId,
              postId: parsed.postId,
              authorNickname: author.nickname || "Anonymous Creator"
            });
          } else {
            localStorage.removeItem("anon_referred_post");
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    checkReferral();
  }, [user.id]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("anon_post_reactions");
      if (saved) {
        setUserReactions(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

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

  const handleReactToPost = async (postId: string, emoji: string) => {
    const currentPostReactions = userReactions[postId] || [];
    if (currentPostReactions.includes(emoji)) return;

    try {
      const data = await apiReactToPost(postId, emoji);
      
      // Update posts local state
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likesCount: data.likesCount,
            reactions: data.reactions
          };
        }
        return p;
      }));

      // Track reacted state in local storage
      const updatedReactions = {
        ...userReactions,
        [postId]: [...currentPostReactions, emoji]
      };
      setUserReactions(updatedReactions);
      localStorage.setItem("anon_post_reactions", JSON.stringify(updatedReactions));
      
      setOpenReactMenuPostId(null);
    } catch (err) {
      console.error("Error reacting to post", err);
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

  const handleCopyFollowLink = () => {
    navigator.clipboard.writeText(followLinkUrl);
    setCopiedFollow(true);
    setTimeout(() => setCopiedFollow(false), 2000);
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

          <div className="w-full md:w-auto flex-1 max-w-xl bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                📢 Share Options & Follow Links
              </span>
              <span className="text-[10px] bg-brand-100 text-brand-700 px-2.5 py-0.5 rounded-full font-sans font-bold">
                Zero-Access Guarded
              </span>
            </div>

            {/* Link Option 1: SECURE FOLLOW LINK */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-850 flex items-center gap-1.5">
                  🌐 Secure Follower Link
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                    Highly Recommended
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Omit private moderate entry keys entirely. Safest way to gain subscribers and share social posts securely.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={followLinkUrl}
                  className="bg-white border border-slate-200 select-all rounded-lg px-3 py-1.5 text-xs text-slate-500 font-mono w-full focus:outline-none"
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleCopyFollowLink}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all flex-1 sm:flex-initial justify-center ${
                      copiedFollow 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {copiedFollow ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedFollow ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQrUrl(followLinkUrl); setShowQrModal(true); }}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all flex-1 sm:flex-initial justify-center"
                    title="Generate Follower QR Code"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-505" />
                    <span>QR</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Link Option 2: DIRECT ADMIN ACCESS LINK */}
            <div className="space-y-1 pt-3 border-t border-slate-200/60">
              <span className="block text-xs font-semibold text-slate-800">
                🔑 Direct Board Link (With admin prompt)
              </span>
              <p className="text-[11px] text-slate-400">
                Displays private PIN login footer at bottom. Keep this private if you do not want others probing for password cracks.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
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
                    onClick={() => { setQrUrl(directLinkUrl); setShowQrModal(true); }}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all flex-1 sm:flex-initial justify-center"
                    title="Generate Direct Board QR Code"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-505" />
                    <span>QR</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy Implications Explanation banner */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5 mt-2 shadow-inner">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 text-xs font-bold font-sans">⚠️ Privacy implications of Sharing:</span>
              </div>
              <ul className="text-[10px] text-slate-300 font-sans space-y-1 pl-3.5 list-disc leading-relaxed">
                <li>
                  <strong className="text-white">Isolate Private Session:</strong> In <span className="text-emerald-400">Secure Follow Link</span>, the owner moderate access button is completely omitted. No one can ever gain unauthorized access to edit your settings or view secrets.
                </li>
                <li>
                  <strong className="text-white">Public Audience Scope:</strong> Anyone possessing this link can look up your board, view all public posts, respond via emoji, and add anonymous timeline comments.
                </li>
                <li>
                  <strong className="text-white">Alias Protection:</strong> Your Board nickname is visible. Toggle <em className="text-indigo-300">"Private Alias Mode"</em> in settings anytime to show up fully as an "Anonymous Creator", shielding your local metadata.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="border-b border-slate-100 mb-8 flex flex-wrap gap-4 sm:gap-6">
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
          onClick={() => setActiveTab("post_feed")}
          className={`pb-3 font-display font-semibold text-sm relative transition-all cursor-pointer ${
            activeTab === "post_feed" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Post Feed Hub
          {activeTab === "post_feed" && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("explore")}
          className={`pb-3 font-display font-semibold text-sm relative transition-all cursor-pointer ${
            activeTab === "explore" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Explore Other Boards
          {activeTab === "explore" && (
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

            {referredPost && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex gap-2.5">
                  <div className="bg-emerald-600 text-white rounded-lg p-1.5 shrink-0">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      📍 Return to the Shared Post you were browsing
                    </span>
                    <p className="text-[11px] text-slate-500">
                      You came from viewing a post by <span className="font-semibold text-emerald-700">{referredPost.authorNickname}</span> before accessing your portal!
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      onSelectBoard(referredPost.userId, referredPost.postId);
                    }}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-1.5 px-3.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    View Original Post
                  </button>
                  <button
                    onClick={() => {
                      try {
                        localStorage.removeItem("anon_referred_post");
                      } catch (err) {
                        console.error(err);
                      }
                      setReferredPost(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold py-1.5 px-2 transition-all cursor-pointer whitespace-nowrap"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            
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
                          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-50 text-xs font-semibold text-slate-500">
                            
                            {/* Render active post reactions */}
                            {EMOJI_LIST.map((emoji) => {
                              const count = getReactionCount(post, emoji);
                              const hasReacted = (userReactions[post.id] || []).includes(emoji);
                              
                              if (count === 0 && !hasReacted) return null;
                              
                              return (
                                <button
                                  key={emoji}
                                  disabled={hasReacted}
                                  onClick={() => handleReactToPost(post.id, emoji)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                                    hasReacted
                                      ? "bg-slate-100 border-slate-200 text-slate-800 opacity-85"
                                      : "bg-white hover:bg-slate-50 border-slate-100 text-slate-600 hover:text-slate-800"
                                  }`}
                                  title={hasReacted ? "You registered this reaction" : `Add reaction ${emoji}`}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-mono text-xs font-bold text-slate-700">{count}</span>
                                </button>
                              );
                            })}

                            {/* Reaction Picker Trigger Button */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenReactMenuPostId(openReactMenuPostId === post.id ? null : post.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                                  openReactMenuPostId === post.id 
                                    ? "bg-brand-50 border-brand-200 text-brand-700" 
                                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                }`}
                              >
                                <span className="text-sm">💬</span>
                                <span>React</span>
                              </button>

                              {/* Floating menu bubble */}
                              <AnimatePresence>
                                {openReactMenuPostId === post.id && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-20" 
                                      onClick={() => setOpenReactMenuPostId(null)} 
                                    />
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                      className="absolute left-0 bottom-full mb-2.5 z-30 bg-white border border-slate-200 shadow-xl rounded-2xl p-2 flex items-center gap-1.5 whitespace-nowrap"
                                    >
                                      {EMOJI_LIST.map((emoji) => {
                                        const hasReacted = (userReactions[post.id] || []).includes(emoji);
                                        return (
                                          <button
                                            key={emoji}
                                            type="button"
                                            disabled={hasReacted}
                                            onClick={() => handleReactToPost(post.id, emoji)}
                                            className="text-lg p-2 rounded-xl transition-all hover:scale-125 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none active:scale-90 cursor-pointer"
                                            title={`React ${emoji}`}
                                          >
                                            {emoji}
                                          </button>
                                        );
                                      })}
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>

                            <button
                              onClick={() => handlePostExpand(post.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                                isExpanded 
                                  ? "bg-brand-50 border-brand-200 text-brand-700" 
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                              }`}
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>{isExpanded ? "Hide Comments" : `Comments (${comments.length})`}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSharePost(post.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                                copiedPostId === post.id
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                              }`}
                            >
                              {copiedPostId === post.id ? (
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Share2 className="w-4 h-4" />
                              )}
                              <span>{copiedPostId === post.id ? "Copied!" : "Share"}</span>
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

        {/* --- TAB: POST FEED HUB --- */}
        {activeTab === "post_feed" && (
          <div className="space-y-6">
            <div className="flex border border-slate-100 rounded-2xl p-6 bg-white flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono tracking-widest uppercase font-bold text-slate-500 bg-slate-100 px-2 rounded-full">
                  📌 Global Hub
                </span>
                <h3 className="text-xl font-display font-semibold text-slate-800">
                  Anonymous Post Feed Hub
                </h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Browse and discover posts from other independent creators across the network, follow your favorites, and join the conversation.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 p-1 rounded-xl self-start">
                <button
                  onClick={() => setFeedFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    feedFilter === "all"
                      ? "bg-slate-900 text-white shadow"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All Posts
                </button>
                <button
                  onClick={() => setFeedFilter("following")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    feedFilter === "following"
                      ? "bg-slate-900 text-white shadow"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  My Subscriptions
                </button>
              </div>
            </div>

            {loadingGlobalFeed ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-400 font-mono">Loading global community timeline...</p>
              </div>
            ) : (() => {
              // Filter based on "all" vs "following"
              let displayedPosts = globalPosts;
              if (feedFilter === "following") {
                displayedPosts = globalPosts.filter((p) => followingMap[p.authorId] === true);
              }

              if (displayedPosts.length === 0) {
                return (
                  <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl p-8 max-w-md mx-auto">
                    <div className="inline-flex p-3 bg-slate-50 border border-slate-100 rounded-full mb-3 text-slate-400">
                      <Compass className="w-6 h-6 animate-pulse" />
                    </div>
                    <h4 className="font-display font-semibold text-slate-800 text-sm mb-1">
                      {feedFilter === "all" ? "No global posts found" : "No subscriptions yet"}
                    </h4>
                    <p className="text-slate-400 text-xs leading-relaxed mb-4">
                      {feedFilter === "all"
                        ? "The timeline is currently quiet. Be the first to share your thoughts on your board!"
                        : "You haven't followed any creators yet. Explore other boards and hit Subscribe to build your feed!"}
                    </p>
                    {feedFilter === "following" && (
                      <button
                        onClick={() => setFeedFilter("all")}
                        className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-1.5 px-4 rounded-xl text-xs cursor-pointer transition-all"
                      >
                        Explore All Public Posts
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {displayedPosts.map((post) => {
                    const isFollowing = followingMap[post.authorId] === true;
                    // Check if self post
                    const isSelf = post.authorId === user.id;
                    const comments = commentsMap[post.id] || [];
                    const isExpanded = expandedPostId === post.id;

                    return (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3"
                      >
                        {/* Post Header: Nickname & Follow option */}
                        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-50">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs">
                              {post.authorNickname.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => onSelectBoard(post.authorId)}
                                  className="font-semibold text-slate-800 text-xs hover:text-brand-600 hover:underline cursor-pointer font-sans"
                                >
                                  {post.authorNickname}
                                </button>
                                {isSelf && (
                                  <span className="text-[9px] bg-indigo-50 text-indigo-600 font-mono px-1.5 py-0.5 rounded font-bold">
                                    Me
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {new Date(post.createdAt).toLocaleDateString()} at {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          {!isSelf && (
                            <button
                              onClick={() => handleToggleFollowGlobal(post.authorId)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                                isFollowing
                                  ? "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                  : "bg-brand-50 border-brand-150 text-brand-700 hover:bg-brand-100"
                              }`}
                            >
                              {isFollowing ? <BellOff className="w-3 h-3 text-slate-400" /> : <Bell className="w-3 h-3" />}
                              <span>{isFollowing ? "Unfollow" : "Follow"}</span>
                            </button>
                          )}
                        </div>

                        {/* Post Content */}
                        <p className="text-slate-600 text-xs leading-relaxed break-words whitespace-pre-wrap">
                          {post.content}
                        </p>

                        {/* Actions Group */}
                        <div className="flex flex-wrap items-center gap-3 pt-3">
                          {/* Emoji reactions */}
                          <div className="relative">
                            <div className="flex items-center gap-1 bg-slate-50 hover:bg-slate-150 p-0.5 rounded-full border border-slate-100">
                              <button
                                onClick={() => setOpenReactMenuPostId(openReactMenuPostId === post.id ? null : post.id)}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-slate-600 cursor-pointer"
                              >
                                <span>{post.likesCount > 0 ? "❤️" : "💡"}</span>
                                <span>React ({post.likesCount})</span>
                              </button>
                            </div>

                            {/* Emoji Reaction dropdown */}
                            <AnimatePresence>
                              {openReactMenuPostId === post.id && (
                                <>
                                  <div className="fixed inset-0 z-20" onClick={() => setOpenReactMenuPostId(null)} />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                    className="absolute left-0 bottom-full mb-2 z-30 bg-white border border-slate-200 shadow-xl rounded-2xl p-1.5 flex items-center gap-1"
                                  >
                                    {EMOJI_LIST.map((emoji) => {
                                      const hasReacted = (userReactions[post.id] || []).includes(emoji);
                                      return (
                                        <button
                                          key={emoji}
                                          disabled={hasReacted}
                                          onClick={async () => {
                                            const savedR = userReactions[post.id] || [];
                                            if (savedR.includes(emoji)) return;
                                            try {
                                              const updated = await apiReactToPost(post.id, emoji);
                                              setGlobalPosts((prev) =>
                                                prev.map((p) => {
                                                  if (p.id === post.id) {
                                                    return { ...p, likesCount: updated.likesCount, reactions: updated.reactions };
                                                  }
                                                  return p;
                                                })
                                              );
                                              setUserReactions((prev) => ({
                                                ...prev,
                                                [post.id]: [...savedR, emoji],
                                              }));
                                            } catch (err) {
                                              console.error(err);
                                            }
                                            setOpenReactMenuPostId(null);
                                          }}
                                          className="text-base p-1.5 rounded-lg hover:bg-slate-50 transition-all hover:scale-125 disabled:opacity-35 cursor-pointer"
                                        >
                                          {emoji}
                                        </button>
                                      );
                                    })}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Trigger reading comments */}
                          <button
                            onClick={async () => {
                              if (isExpanded) {
                                setExpandedPostId(null);
                              } else {
                                setExpandedPostId(post.id);
                                try {
                                  const list = await apiGetComments(post.id);
                                  setCommentsMap((prev) => ({ ...prev, [post.id]: list }));
                                } catch (err) {
                                  console.error(err);
                                }
                              }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                              isExpanded
                                ? "bg-slate-900 border-slate-900 text-white"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{isExpanded ? "Hide Comments" : `Comments (${comments.length})`}</span>
                          </button>

                          {/* Share Post Button */}
                          <button
                            onClick={() => handleSharePost(post.id)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                              copiedPostId === post.id
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {copiedPostId === post.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                            <span>{copiedPostId === post.id ? "Copied Link!" : "Share Link"}</span>
                          </button>

                          {/* View Board */}
                          <button
                            onClick={() => onSelectBoard(post.authorId)}
                            className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold border border-indigo-100 bg-indigo-50/30 text-indigo-700 hover:bg-indigo-50 transition-all cursor-pointer ml-auto"
                          >
                            <span>Browse Board</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Comments Panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden bg-slate-50/50 rounded-xl p-3 border border-slate-100/60 mt-2 space-y-3"
                            >
                              <h5 className="text-[10px] font-mono tracking-wider font-bold uppercase text-slate-400">
                                Comments Timeline
                              </h5>

                              {comments.length === 0 ? (
                                <p className="text-slate-400 text-xs italic">No comments on this post yet. Leave the first comment!</p>
                              ) : (
                                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                                  {comments.map((c) => (
                                    <div key={c.id} className="bg-white p-2 border border-slate-100 rounded-lg text-xs space-y-0.5">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-700 font-mono text-[9px] bg-slate-100 px-1 rounded">
                                          {c.nickname}
                                        </span>
                                        <span className="text-[8px] text-slate-400 font-mono">
                                          {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <p className="text-slate-600 font-sans leading-relaxed break-words">{c.content}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <form onSubmit={(e) => handleAddCommentGlobal(post.id, e)} className="flex gap-2">
                                <input
                                  type="text"
                                  value={commentFeedInputs[post.id] || ""}
                                  onChange={(evt) => setCommentFeedInputs((prev) => ({ ...prev, [post.id]: evt.target.value }))}
                                  placeholder="Type an anonymous comment..."
                                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs flex-1 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-105"
                                />
                                <button
                                  type="submit"
                                  disabled={addingCommentGlobalMap[post.id] || !(commentFeedInputs[post.id] || "").trim()}
                                  className="bg-slate-900 border hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-1 px-3 rounded-xl text-xs cursor-pointer transition-all"
                                >
                                  {addingCommentGlobalMap[post.id] ? "Sending..." : "Comment"}
                                </button>
                              </form>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })()}
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

        {/* TAB 3: DISCOVERY DIRECTORY */}
        {activeTab === "explore" && (
          <div className="space-y-6">
            <UserSearch onSelectBoard={onSelectBoard} currentUserId={user.id} />
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
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl || directLinkUrl)}`}
                  alt="Board Link QR Code"
                  width={200}
                  height={200}
                  className="rounded-lg bg-white"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="text-xs text-slate-500 font-mono break-all bg-slate-50 p-3 rounded-lg border border-slate-100 select-all mb-6">
                {qrUrl || directLinkUrl}
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
