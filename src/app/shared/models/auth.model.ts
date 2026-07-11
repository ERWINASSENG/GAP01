export type PortRole = 'admin' | 'manager' | 'user';

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
}

export interface UserSession {
  token: string;
  user: PortUser;
  expiresAt: number;
}
