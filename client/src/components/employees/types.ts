import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type Outputs = inferRouterOutputs<AppRouter>;

export type EmployeeFileData = Outputs["employees"]["getFile"];
export type EmployeeListItem = Outputs["employees"]["list"][number];
export type DocumentsOverview = Outputs["employees"]["getDocumentsOverview"];
export type DocumentsOverviewItem = DocumentsOverview["rows"][number];

export type EmployeeFileTab = "basic" | "documents" | "salary" | "account";

/** حساب البوابة (عقد employeeAuth.getAccount) */
export interface PortalAccountInfo {
  employeeId: number;
  username: string | null;
  hasPortalAccess: boolean;
  hasPassword: boolean;
  lastLogin: Date | string | null;
}

/** نتيجة employeeAuth.saveAccount */
export interface SavePortalAccountResult {
  success: true;
  generatedPassword?: string;
}

/** نتيجة employeeAuth.resetPassword */
export interface ResetPortalPasswordResult {
  success: true;
  password: string;
}
