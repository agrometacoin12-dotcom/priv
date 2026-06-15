import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Database File Path
const DB_FILE = path.join(process.cwd(), "db.json");

// Define interfaces for our local database
interface User {
  id: string; // e.g. usr_a1b2c3d4
  nickname: string;
  pin: string; // 4-digit PIN
  isNicknamePrivate: boolean;
  createdAt: string;
}

interface Post {
  id: string;
  userId: string; // author user id
  content: string;
  likesCount: number;
  createdAt: string;
}

interface Comment {
  id: string;
  postId: string;
  nickname: string; // anonymous commenter nickname
  content: string;
  createdAt: string;
}

interface DatabaseStructure {
  users: User[];
  posts: Post[];
  comments: Comment[];
}

// Initial/default DB structure
const initialDb: DatabaseStructure = {
  users: [],
  posts: [],
  comments: [],
};

// Help load/save functions for DB
function loadDb(): DatabaseStructure {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading database file, resetting to initial state", err);
  }
  saveDb(initialDb);
  return initialDb;
}

function saveDb(data: DatabaseStructure) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database file", err);
  }
}

// Helper to generate IDs
function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

// Random nicknames generator list
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

function generateRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser
  app.use(express.json());

  // --- API ROUTING START ---

  // Create temporary account
  app.post("/api/users", (req, res) => {
    const db = loadDb();
    
    // Generate new secure details
    const id = generateId("usr");
    const nickname = generateRandomNickname();
    
    // 4-digit PIN: mathematical range from 0000 to 9999
    const pin = Math.floor(1000 + Math.random() * 9000).toString(); 
    
    const newUser: User = {
      id,
      nickname,
      pin,
      isNicknamePrivate: false,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveDb(db);

    res.status(201).json(newUser);
  });

  // Verify PIN auth
  app.post("/api/users/:userId/auth", (req, res) => {
    const { userId } = req.params;
    const { pin } = req.body;

    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.pin !== pin) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    res.json({ success: true, user });
  });

  // Get user profile (public info vs private ownership)
  app.get("/api/users/:userId", (req, res) => {
    const { userId } = req.params;
    const { pin } = req.query; // If pin is supplied and correct, return full info

    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Owner checks
    const isOwner = pin === user.pin;

    res.json({
      id: user.id,
      nickname: user.isNicknamePrivate && !isOwner ? "Anonymous Creator" : user.nickname,
      isNicknamePrivate: user.isNicknamePrivate,
      createdAt: user.createdAt,
      isOwner,
      // Only expose the PIN to the authenticated owner
      pin: isOwner ? user.pin : undefined,
    });
  });

  // Toggle nickname privacy (requires authenticated pin)
  app.put("/api/users/:userId/toggle-nickname", (req, res) => {
    const { userId } = req.params;
    const { pin, isPrivate } = req.body;

    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.pin !== pin) {
      return res.status(401).json({ error: "Invalid PIN. Authentication failed." });
    }

    user.isNicknamePrivate = isPrivate;
    saveDb(db);

    res.json({ success: true, isNicknamePrivate: user.isNicknamePrivate, user });
  });

  // Change PIN (requires old pin)
  app.put("/api/users/:userId/change-pin", (req, res) => {
    const { userId } = req.params;
    const { pin, newPin } = req.body;

    if (!newPin || typeof newPin !== "string" || newPin.length !== 4 || isNaN(Number(newPin))) {
      return res.status(400).json({ error: "New PIN must be a 4-digit number" });
    }

    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.pin !== pin) {
      return res.status(401).json({ error: "Invalid old PIN" });
    }

    user.pin = newPin;
    saveDb(db);

    res.json({ success: true, pin: user.pin });
  });

  // Get all posts of a specific user/portal
  app.get("/api/users/:userId/posts", (req, res) => {
    const { userId } = req.params;
    const db = loadDb();
    
    // Check user exists
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Filter posts for this specific profile
    const userPosts = db.posts.filter((p) => p.userId === userId);
    
    // Sort by latest first
    userPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      user: {
        id: user.id,
        nickname: user.isNicknamePrivate ? "Anonymous Creator" : user.nickname,
        isNicknamePrivate: user.isNicknamePrivate,
      },
      posts: userPosts,
    });
  });

  // Create a post (Owner-only write, verified by PIN)
  app.post("/api/users/:userId/posts", (req, res) => {
    const { userId } = req.params;
    const { pin, content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "Post content is required" });
    }

    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.pin !== pin) {
      return res.status(401).json({ error: "Authentication failed: invalid PIN" });
    }

    const newPost: Post = {
      id: generateId("pst"),
      userId,
      content,
      likesCount: 0,
      createdAt: new Date().toISOString(),
    };

    db.posts.push(newPost);
    saveDb(db);

    res.status(201).json(newPost);
  });

  // Like a post (Any anonymous visitor can do)
  app.post("/api/posts/:postId/like", (req, res) => {
    const { postId } = req.params;
    const db = loadDb();

    const post = db.posts.find((p) => p.id === postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    post.likesCount += 1;
    saveDb(db);

    res.json({ success: true, likesCount: post.likesCount });
  });

  // Get comments of a post
  app.get("/api/posts/:postId/comments", (req, res) => {
    const { postId } = req.params;
    const db = loadDb();

    const comments = db.comments.filter((c) => c.postId === postId);
    // Sort oldest first for comments timeline flow
    comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    res.json(comments);
  });

  // Add Comment on a post (Any anonymous visitor can do; assigns a funny random comment identity)
  app.post("/api/posts/:postId/comments", (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "Comment content cannot be empty" });
    }

    const db = loadDb();
    const post = db.posts.find((p) => p.id === postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const commNickname = COMMENT_NICKNAMES[Math.floor(Math.random() * COMMENT_NICKNAMES.length)];

    const newComment: Comment = {
      id: generateId("cmt"),
      postId,
      nickname: commNickname,
      content,
      createdAt: new Date().toISOString(),
    };

    db.comments.push(newComment);
    saveDb(db);

    res.status(201).json(newComment);
  });

  // Delete a post (Owner-only moderation, verified by PIN)
  app.delete("/api/posts/:postId", (req, res) => {
    const { postId } = req.params;
    const { pin, userId } = req.body;

    const db = loadDb();
    const post = db.posts.find((p) => p.id === postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: "Authorization failed: not your post" });
    }

    const user = db.users.find((u) => u.id === userId);
    if (!user || user.pin !== pin) {
      return res.status(401).json({ error: "Authentication failed" });
    }

    // Filter out post and associated comments
    db.posts = db.posts.filter((p) => p.id !== postId);
    db.comments = db.comments.filter((c) => c.postId !== postId);
    saveDb(db);

    res.json({ success: true });
  });

  // Delete a comment (Owner-only moderation of their board, verified by PIN)
  app.delete("/api/comments/:commentId", (req, res) => {
    const { commentId } = req.params;
    const { pin, userId } = req.body;

    const db = loadDb();
    const comment = db.comments.find((c) => c.id === commentId);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const post = db.posts.find((p) => p.id === comment.postId);
    if (!post) {
      return res.status(404).json({ error: "Associated post not found" });
    }

    if (post.userId !== userId) {
      return res.status(403).json({ error: "Authorization failed: comment is not on your board" });
    }

    const user = db.users.find((u) => u.id === userId);
    if (!user || user.pin !== pin) {
      return res.status(401).json({ error: "Authentication failed" });
    }

    db.comments = db.comments.filter((c) => c.id !== commentId);
    saveDb(db);

    res.json({ success: true });
  });

  // --- API ROUTING END ---

  // Vite Integration & SPA asset fallback
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Anonymous Post Portal server running on http://localhost:${PORT}`);
  });
}

startServer();
