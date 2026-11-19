export type AuthMembership = {
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  roleCode: string;
  roleName: string;
  scope: "all" | "assigned";
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  jobTitle: string | null;
  userType: "interno" | "fornecedor" | "cliente";
  profileName: string | null;
  profileCode: string | null;
  permissions: string[];
  pages: string[];
  memberships: AuthMembership[];
};

export type AuthResult = {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
  refreshToken: string;
  remember: boolean;
};

export type LoginMeta = {
  ip: string | null;
  userAgent: string | null;
};
