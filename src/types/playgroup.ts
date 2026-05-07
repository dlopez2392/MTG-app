export interface PlaygroupMember {
  id: string;
  name: string;
  avatarColor: string;
  notes?: string;
  friendUserId?: string;
  friendAvatarUrl?: string;
  isFriend: boolean;
  createdAt: string;
}
