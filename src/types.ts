export interface User {
  id: string;
  nickname: string;
  isNicknamePrivate: boolean;
  createdAt: string;
  isOwner?: boolean;
  pin?: string;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  likesCount: number;
  reactions?: Record<string, number>;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  nickname: string;
  content: string;
  createdAt: string;
}
