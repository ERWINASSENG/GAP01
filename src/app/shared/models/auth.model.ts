export type PortRole = 'admin' | 'manager' | 'user';

export interface UserPermissions {
  can_manage_vessels: boolean;
  can_validate_operations: boolean;
  can_view_analytics: boolean;
  can_edit_cahier: boolean;
}

export interface PortSite {
  id: string;
  name: string;
  code: string;
  location: string;
  type: 'container' | 'bulk' | 'oil' | 'passenger';
  status: 'active' | 'maintenance' | 'inactive';
}

export interface PortUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: PortRole;
  avatarUrl?: string;
  assignedSiteId?: string;
  assignedSiteName?: string;
  permissions?: UserPermissions;
}

export interface UserSession {
  token: string;
  user: PortUser;
  expiresAt: number;
}

export interface CreatedUser {
  id: string;
  email?: string;
  user_metadata?: {
    display_name?: string;
    role?: string;
    avatar_url?: string;
    created_by?: string;
  };
  created_at?: string;
}
