# Technical Architecture Analysis - Employee Portal

## Current Stack Overview

### Frontend
- **Framework**: React 19 + TypeScript
- **Routing**: Wouter (lightweight router)
- **UI Components**: shadcn/ui + Tailwind CSS 4
- **State Management**: React hooks + tRPC queries
- **Icons**: Lucide React

### Backend
- **API Layer**: tRPC 11 with Express 4
- **Database**: MySQL/TiDB via Drizzle ORM
- **Authentication**: Custom JWT + Manus OAuth
- **File Storage**: S3 via storagePut helper

### Portal Structure
```
client/src/
├── pages/
│   ├── EmployeePortal.tsx      # Regular employees (1200+ lines)
│   └── AdminEmployeePortal.tsx # Supervisors (1200+ lines)
├── components/portal/
│   ├── EmployeeInfoForm.tsx    # Document info form
│   ├── EmployeeProfile.tsx     # Profile display
│   ├── SalarySlip.tsx          # Salary details
│   ├── LeaveBalance.tsx        # Leave tracking
│   ├── BonusReport.tsx         # Bonus info
│   ├── RequestTimeline.tsx     # Request history
│   ├── RequestAttachments.tsx  # File uploads
│   └── EmailSetupModal.tsx     # Email configuration
```

### API Endpoints (employeePortal router)
- getProfile / updateProfile
- setupEmail
- getSalarySlip / getSalaryHistory
- getLeaveBalance / getLeaveHistory
- getBonusReport / getBonusHistory
- cancelRequest / updateRequest
- getRequestsStats
- uploadAttachment / getAttachments
- hasSubmittedInfo / submitInfo / getDocumentInfo

## Identified Issues

### 1. Code Duplication
- `EmployeePortal.tsx` and `AdminEmployeePortal.tsx` share ~40% similar code
- Constants (REQUEST_TYPE_NAMES, STATUS_NAMES, STATUS_COLORS) duplicated
- Similar UI patterns repeated

### 2. Monolithic Components
- Both portal files exceed 1200 lines
- Mixed concerns: UI, business logic, state management
- Hard to test and maintain

### 3. Missing Role-Based Features
- No supervisor-specific document status dashboard
- No proactive notifications for expiring documents
- No unified profile management across roles

## Proposed Architectural Changes

### Change 1: Shared Portal Core Module
Extract common logic into reusable modules:
```
client/src/lib/portal/
├── constants.ts      # REQUEST_TYPES, STATUSES, COLORS
├── hooks/
│   ├── useEmployeeData.ts
│   ├── useDocumentStatus.ts
│   └── useRequestManagement.ts
├── types.ts          # Shared interfaces
└── utils.ts          # Helper functions
```

### Change 2: Role-Aware Layout Component
Create unified layout that adapts to user role:
```tsx
// PortalLayout.tsx
interface PortalLayoutProps {
  role: 'employee' | 'supervisor' | 'admin';
  userId: number;
}
// Renders appropriate navigation, features based on role
```

### Change 3: Document Status Service
Add backend service for proactive document management:
```
server/services/
└── documentStatusService.ts
    - getExpiringDocuments(userId, daysThreshold)
    - getDocumentCompletionStatus(userId)
    - scheduleDocumentReminders()
```

## Impact Assessment

| Change | Effort | Impact | Priority |
|--------|--------|--------|----------|
| Shared Core Module | Medium | High | 1 |
| Role-Aware Layout | Medium | High | 2 |
| Document Status Service | Low | High | 3 |

## Recommended Implementation Order

1. **Phase 1**: Create shared constants and types (1 hour)
2. **Phase 2**: Extract custom hooks (2 hours)
3. **Phase 3**: Build PortalLayout component (2 hours)
4. **Phase 4**: Implement Document Status Service (1 hour)
5. **Phase 5**: Refactor existing portals to use new modules (3 hours)

Total estimated effort: ~9 hours
