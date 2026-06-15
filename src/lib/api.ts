import { User, Post, Comment } from "../types";

// Check if we should use Local Storage Emulator Mode
let isOfflineMode = localStorage.getItem("anon_api_mode") === "local";

// Fallback user state names
const ADJECTIVES = [
  "Silent", "Mystic", "Clever", "Swift", "Golden", "Silver", "Amber", "Wild", 
  "Calm", "Gentle", "Vibrant", "Shadow", "Lunar", "Solar", "Cosmic", "Eldritch", 
  "Spirited", "Quiet", "Sneaky", "Humble", "Daring", "Radiant", "Frosty", "Fiery", 
  "Wandering", "Nimble", "Eager", "Stellar", "Astral", "Emerald", "Obsidian", "Gilded"
];

const ANIMALS = [
  "Owl", "Fox", "Wolf", "Panda", "Badger", "Falcon", "Otter", "Lynx", "Hedgehog", 
  "Rabbit", "Deer", "Squirrel", "Koala", "Panther", "Tiger", "Beaver", "Ferret", 
  "Leopard", "Cheetah", "Jaguar", "Phoenix", "Sparrow", "Swallow", "Eagle", "Hawk", 
  "Raccoon", "Opossum", "Bear", "Moose", "Dolphin", "Gazelle", "Chameleon"
];

const COMMENT_NICKNAMES = [
  "Curious Spectator", "Thoughtful Muse", "Silent Observer", "Friendly Ghost", 
  "Anonymous Sage", "Gentle Listener", "Inquisitive Wanderer", "Humble Critic", 
  "Vibrant Dreamer", "Quiet Scholar", "Mystic Nomad", "Lively Spark"
];

function generateLocalId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

function generateRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

// Get/Set local database
interface LocalDB {
  users: User[];
  posts: Post[];
  comments: Comment[];
}

function getLocalDB(): LocalDB {
  try {
    const users = JSON.parse(localStorage.getItem("anon_local_users") || "[]");
    const posts = JSON.parse(localStorage.getItem("anon_local_posts") || "[]");
    const comments = JSON.parse(localStorage.getItem("anon_local_comments") || "[]");
    return { users, posts, comments };
  } catch (err) {
    console.error("Error reading localStorage database, restoring empty lists", err);
    return { users: [], posts: [], comments: [] };
  }
}

function saveLocalDB(db: LocalDB) {
  try {
    localStorage.setItem("anon_local_users", JSON.stringify(db.users));
    localStorage.setItem("anon_local_posts", JSON.stringify(db.posts));
    localStorage.setItem("anon_local_comments", JSON.stringify(db.comments));
  } catch (err) {
    console.error("Failed saving to browser storage", err);
  }
}

// Unified wrapper to call API first, then fallback gracefully to Local Storage
async function executeRequest<T>(
  apiCall: () => Promise<T>,
  localBackupCall: () => T
): Promise<T> {
  if (isOfflineMode) {
    return localBackupCall();
  }

  try {
    return await apiCall();
  } catch (err: any) {
    if (err && err.message === "BACKEND_MISSING") {
      console.warn("⚠️ No backend container routes found (e.g. Vercel static deployment). Switching permanently to local fallback storage.");
      isOfflineMode = true;
      localStorage.setItem("anon_api_mode", "local");
      return localBackupCall();
    }
    // Network connectivity issue
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
      console.warn("⚠️ Connection failure. Switching to local fallback storage.");
      isOfflineMode = true;
      localStorage.setItem("anon_api_mode", "local");
      return localBackupCall();
    }
    // Re-throw other authentic errors (e.g., actual auth PIN mismatches)
    throw err;
  }
}

// Standard fetch dispatcher with content-type checking to isolate serverlessness
async function fetchJSON(url: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("BACKEND_MISSING");
  }

  if (!res.ok) {
    let errorData: any = {};
    try {
      errorData = await res.json();
    } catch {
      errorData = { error: `Server returned HTTP ${res.status}` };
    }
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }

  return await res.json();
}

// --- SDK INTERFACE FUNCTIONS ---

// 1. Create a user
export async function apiCreateUser(): Promise<User> {
  return executeRequest(
    () => fetchJSON("/api/users", { method: "POST" }),
    () => {
      const db = getLocalDB();
      const id = generateLocalId("usr");
      const nickname = generateRandomNickname();
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      
      const newUser: User = {
        id,
        nickname,
        pin,
        isNicknamePrivate: false,
        createdAt: new Date().toISOString(),
      };
      
      db.users.push(newUser);
      saveLocalDB(db);
      return newUser;
    }
  );
}

// 2. Auth User with PIN
export async function apiAuthUser(userId: string, pin: string): Promise<{ success: boolean; user: User }> {
  return executeRequest(
    () => fetchJSON(`/api/users/${userId}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    }),
    () => {
      const db = getLocalDB();
      const user = db.users.find((u) => u.id === userId);
      
      if (!user) {
        throw new Error("Account not found");
      }
      
      if (user.pin !== pin) {
        throw new Error("Invalid PIN");
      }
      
      return { success: true, user: { ...user, isOwner: true } };
    }
  );
}

// 3. Get user details
export async function apiGetUser(userId: string, pinValue?: string): Promise<User> {
  return executeRequest(
    () => {
      const url = pinValue ? `/api/users/${userId}?pin=${pinValue}` : `/api/users/${userId}`;
      return fetchJSON(url);
    },
    () => {
      const db = getLocalDB();
      const user = db.users.find((u) => u.id === userId);
      
      if (!user) {
        throw new Error("This anonymous board does not exist or was deleted.");
      }
      
      const isOwner = pinValue === user.pin;
      
      return {
        id: user.id,
        nickname: user.isNicknamePrivate && !isOwner ? "Anonymous Creator" : user.nickname,
        isNicknamePrivate: user.isNicknamePrivate,
        createdAt: user.createdAt,
        isOwner,
        pin: isOwner ? user.pin : undefined,
      };
    }
  );
}

// 4. Toggle nickname privacy
export async function apiToggleNickname(userId: string, pin: string, isPrivate: boolean): Promise<{ success: boolean; isNicknamePrivate: boolean; user: User }> {
  return executeRequest(
    () => fetchJSON(`/api/users/${userId}/toggle-nickname`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, isPrivate }),
    }),
    () => {
      const db = getLocalDB();
      const user = db.users.find((u) => u.id === userId);
      
      if (!user) {
        throw new Error("Account not found");
      }
      
      if (user.pin !== pin) {
        throw new Error("Authentication failed");
      }
      
      user.isNicknamePrivate = isPrivate;
      saveLocalDB(db);
      
      return { success: true, isNicknamePrivate: user.isNicknamePrivate, user };
    }
  );
}

// 5. Change PIN
export async function apiChangePin(userId: string, pin: string, newPin: string): Promise<{ success: boolean; pin: string }> {
  return executeRequest(
    () => fetchJSON(`/api/users/${userId}/change-pin`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, newPin }),
    }),
    () => {
      const db = getLocalDB();
      const user = db.users.find((u) => u.id === userId);
      
      if (!user) {
        throw new Error("Account not found");
      }
      
      if (user.pin !== pin) {
        throw new Error("Invalid old PIN");
      }
      
      user.pin = newPin;
      saveLocalDB(db);
      
      return { success: true, pin: user.pin };
    }
  );
}

// 6. Get all posts
export async function apiGetPosts(userId: string): Promise<{ user: Partial<User>; posts: Post[] }> {
  return executeRequest(
    () => fetchJSON(`/api/users/${userId}/posts`),
    () => {
      const db = getLocalDB();
      const user = db.users.find((u) => u.id === userId);
      
      if (!user) {
        throw new Error("User not found");
      }
      
      const userPosts = db.posts.filter((p) => p.userId === userId);
      userPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      return {
        user: {
          id: user.id,
          nickname: user.isNicknamePrivate ? "Anonymous Creator" : user.nickname,
          isNicknamePrivate: user.isNicknamePrivate,
        },
        posts: userPosts,
      };
    }
  );
}

// 7. Create a post
export async function apiCreatePost(userId: string, pin: string, content: string): Promise<Post> {
  return executeRequest(
    () => fetchJSON(`/api/users/${userId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, content }),
    }),
    () => {
      const db = getLocalDB();
      const user = db.users.find((u) => u.id === userId);
      
      if (!user) {
        throw new Error("User not found");
      }
      
      if (user.pin !== pin) {
        throw new Error("Authentication failed: invalid PIN");
      }
      
      const newPost: Post = {
        id: generateLocalId("pst"),
        userId,
        content,
        likesCount: 0,
        createdAt: new Date().toISOString(),
      };
      
      db.posts.push(newPost);
      saveLocalDB(db);
      return newPost;
    }
  );
}

// 8. Like a post
export async function apiLikePost(postId: string): Promise<{ success: boolean; likesCount: number }> {
  return executeRequest(
    () => fetchJSON(`/api/posts/${postId}/like`, { method: "POST" }),
    () => {
      const db = getLocalDB();
      const post = db.posts.find((p) => p.id === postId);
      
      if (!post) {
        throw new Error("Post not found");
      }
      
      post.likesCount += 1;
      saveLocalDB(db);
      return { success: true, likesCount: post.likesCount };
    }
  );
}

// 9. Get comments
export async function apiGetComments(postId: string): Promise<Comment[]> {
  return executeRequest(
    () => fetchJSON(`/api/posts/${postId}/comments`),
    () => {
      const db = getLocalDB();
      const comments = db.comments.filter((c) => c.postId === postId);
      comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return comments;
    }
  );
}

// 10. Create comment
export async function apiCreateComment(postId: string, content: string): Promise<Comment> {
  return executeRequest(
    () => fetchJSON(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),
    () => {
      const db = getLocalDB();
      const post = db.posts.find((p) => p.id === postId);
      
      if (!post) {
        throw new Error("Post not found");
      }
      
      const commNickname = COMMENT_NICKNAMES[Math.floor(Math.random() * COMMENT_NICKNAMES.length)];
      
      const newComment: Comment = {
        id: generateLocalId("cmt"),
        postId,
        nickname: commNickname,
        content,
        createdAt: new Date().toISOString(),
      };
      
      db.comments.push(newComment);
      saveLocalDB(db);
      return newComment;
    }
  );
}

// 11. Delete post
export async function apiDeletePost(postId: string, userId: string, pin: string): Promise<{ success: boolean }> {
  return executeRequest(
    () => fetchJSON(`/api/posts/${postId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, userId }),
    }),
    () => {
      const db = getLocalDB();
      const post = db.posts.find((p) => p.id === postId);
      
      if (!post) {
        throw new Error("Post not found");
      }
      
      if (post.userId !== userId) {
        throw new Error("Authorization failed: not your post");
      }
      
      const user = db.users.find((u) => u.id === userId);
      if (!user || user.pin !== pin) {
        throw new Error("Authentication failed");
      }
      
      db.posts = db.posts.filter((p) => p.id !== postId);
      db.comments = db.comments.filter((c) => c.postId !== postId);
      saveLocalDB(db);
      return { success: true };
    }
  );
}

// 12. Delete comment
export async function apiDeleteComment(commentId: string, userId: string, pin: string): Promise<{ success: boolean }> {
  return executeRequest(
    () => fetchJSON(`/api/comments/${commentId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, userId }),
    }),
    () => {
      const db = getLocalDB();
      const comment = db.comments.find((c) => c.id === commentId);
      
      if (!comment) {
        throw new Error("Comment not found");
      }
      
      const post = db.posts.find((p) => p.id === comment.postId);
      if (!post) {
        throw new Error("Associated post not found");
      }
      
      if (post.userId !== userId) {
        throw new Error("Authorization failed: comment is not on your board");
      }
      
      const user = db.users.find((u) => u.id === userId);
      if (!user || user.pin !== pin) {
        throw new Error("Authentication failed");
      }
      
      db.comments = db.comments.filter((c) => c.id !== commentId);
      saveLocalDB(db);
      return { success: true };
    }
  );
}
