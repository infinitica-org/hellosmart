# @hs/ui — HelloSmart Shared UI Library

The shared, accessible UI component library for HelloSmart. Used across Company, Admin, and Candidate portals to guarantee visual consistency, accessibility, and uniform design tokens.

---

## 1. Architecture & Design Tokens

- **Styling**: Tailwind CSS v3.4 + CSS Custom Properties.
- **Base Theme**: Dark mode default (`#090d16` background, `#0c1222` surface, `#6366f1` Indigo primary).
- **Design Tokens**: `packages/ui/src/styles/tokens.css`
- **Utility**: `cn(...)` exported from `@hs/ui` for merging class names.

---

## 2. Public Component API

### Foundation Components
- `Button` & `IconButton` — primary, secondary, outline, ghost, danger variants; sizes `sm`, `md`, `lg`; `isLoading` spinner state.
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Badge` & `StatusIndicator` — status states (`online`, `offline`, `busy`, `idle`, `error`) with pulse/ping animations.
- `Avatar` & `AvatarGroup` — accessible initials fallback, image loading, status indicator dots.
- `Separator` — horizontal/vertical ARIA separators.
- `Input`, `Textarea`, `Select` — prefix/suffix icons, error states, option groups.
- `Checkbox`, `RadioGroup`, `RadioGroupItem`, `Switch` — accessible form toggles.
- `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`
- `List`, `ListItem`
- `Progress` & `ProgressBar`
- `StatCard`, `FilterBar`, `SearchAndSortToolbar`, `BulkActionBar`, `Timeline`, `TimelineItem`

### Form Components
- `FormField` — composable field layout with label, helper, and error slots.
- `FormLabel`, `FormDescription`, `FormError`
- `TextField` — integrated label, input, and validation error.
- `PasswordField` — integrated password input with show/hide toggle.
- `TextAreaField`, `SelectField`, `CheckboxField`
- `Form` — accessible form wrapper.

### Navigation & Overlays
- `Breadcrumbs`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuLabel`
- `ContextMenu`, `NavigationMenu`, `CommandMenu`
- `Pagination` — accessible pagination controls with sibling count and edge navigation.
- `Dialog`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogContent`, `DialogFooter`
- `AlertDialog` & `ConfirmationDialog` — critical confirmation modals for destructive operations.
- `Drawer` & `Sheet` — slide-overs (right, left, top, bottom).
- `Tooltip`, `Popover`, `HoverCard`

### Feedback & Page States
- `Alert` — `info`, `success`, `warning`, `error` alert boxes.
- `Spinner` & `LoadingSpinner`
- `Skeleton` — rectangular, circular, and text shimmer placeholders.
- `EmptyState` — icon, title, description, and action button.
- `ErrorState`, `LoadingState`, `NotFoundState`, `AccessDeniedState`, `ServerErrorState`, `NetworkErrorState`
- `ToastProvider`, `useToast` — toast notification stack.
- `PageHeader` — portal page header with action buttons and breadcrumbs.
- `BrandMark` — HelloSmart branding with white-label toggle (`BR-28`).

### HelloSmart Product Components (`@hs/ui/product` or `@hs/ui`)
- `SafeMarkdown` — sanitized markdown rendering for briefs and candidate submissions.
- `EvidenceReference` — citation pill linking scores to terminal, diff, chat, or test runs (`BR-18`).
- `CountdownTimer` — server-authoritative assessment countdown (`BR-08`, `BR-09`).
- `AssessmentStatusBadge` — `draft`, `dry_run_passed`, `published`, `closed`, `archived`.
- `AssignmentStatus` — `invited`, `window_not_open`, `ready`, `in_progress`, `disconnected`, `submitted`, `expired`, `revoked`.
- `ConsentPanel` — modal consent screen detailing recording and timer rules (`BR-12`).
- `WorkspaceConnectionStatus` — connection health and resume trigger (`BR-10`).
- `WorkspaceRecoveryPanel` — disconnect overlay and state recovery.
- `AiUsageIndicator` — tokens/cost tracking against caps (`BR-15`).
- `RubricScoreCard` — rubric dimension score, confidence, and cited evidence.
- `ReviewDisagreementAlert` — multi-agent score discrepancy warnings.
- `HumanReviewPanel` — human reviewer overrides, notes, and finalization (`BR-20`).
- `EntitlementUsageCard` — organization quota limits and usage meters (`BR-05`, `BR-06`).
- `AuditEventList` — append-only audit trail logs (`BR-31`).

---

## 3. Usage Example

```tsx
import {
  Button,
  Card,
  TextField,
  PasswordField,
  Breadcrumbs,
  Dialog,
  StatCard,
  useToast,
} from '@hs/ui';
```

---

## 1. Architecture & Design Tokens

- **Styling**: Tailwind CSS v3.4 + CSS Custom Properties.
- **Base Theme**: Dark mode default (`#090d16` background, `#0c1222` surface, `#6366f1` Indigo primary).
- **Design Tokens**: `packages/ui/src/styles/tokens.css`
- **Utility**: `cn(...)` exported from `@hs/ui` for merging class names.

---

## 2. Public Component API

### Foundation Components
- `Button` & `IconButton` — primary, secondary, outline, ghost, danger variants; sizes `sm`, `md`, `lg`; `isLoading` spinner state.
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Badge` & `StatusIndicator` — status states (`online`, `offline`, `busy`, `idle`, `error`) with pulse/ping animations.
- `Avatar` & `AvatarGroup` — accessible initials fallback, image loading, status indicator dots.
- `Separator` — horizontal/vertical ARIA separators.
- `Input`, `Textarea`, `Select` — prefix/suffix icons, error states, option groups.
- `Checkbox`, `RadioGroup`, `RadioGroupItem`, `Switch` — accessible form toggles.
- `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`
- `List`, `ListItem`
- `Progress` & `ProgressBar`
- `StatCard`, `FilterBar`, `SearchAndSortToolbar`, `BulkActionBar`, `Timeline`, `TimelineItem`

### Form Components
- `FormField` — composable field layout with label, helper, and error slots.
- `FormLabel`, `FormDescription`, `FormError`
- `TextField` — integrated label, input, and validation error.
- `PasswordField` — integrated password input with show/hide toggle.
- `TextAreaField`, `SelectField`, `CheckboxField`
- `Form` — accessible form wrapper.

### Navigation & Overlays
- `Breadcrumbs`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuLabel`
- `ContextMenu`, `NavigationMenu`, `CommandMenu`
- `Pagination` — accessible pagination controls with sibling count and edge navigation.
- `Dialog`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogContent`, `DialogFooter`
- `AlertDialog` & `ConfirmationDialog` — critical confirmation modals for destructive operations.
- `Drawer` & `Sheet` — slide-overs (right, left, top, bottom).
- `Tooltip`, `Popover`, `HoverCard`

### Feedback & Page States
- `Alert` — `info`, `success`, `warning`, `error` alert boxes.
- `Spinner` & `LoadingSpinner`
- `Skeleton` — rectangular, circular, and text shimmer placeholders.
- `EmptyState` — icon, title, description, and action button.
- `ErrorState`, `LoadingState`, `NotFoundState`, `AccessDeniedState`, `ServerErrorState`, `NetworkErrorState`
- `ToastProvider`, `useToast` — toast notification stack.
- `PageHeader` — portal page header with action buttons and breadcrumbs.
- `BrandMark` — HelloSmart branding with white-label toggle (`BR-28`).

### HelloSmart Product Components (`@hs/ui/product` or `@hs/ui`)
- `SafeMarkdown` — sanitized markdown rendering for briefs and candidate submissions.
- `EvidenceReference` — citation pill linking scores to terminal, diff, chat, or test runs (`BR-18`).
- `CountdownTimer` — server-authoritative assessment countdown (`BR-08`, `BR-09`).
- `AssessmentStatusBadge` — `draft`, `dry_run_passed`, `published`, `closed`, `archived`.
- `AssignmentStatus` — `invited`, `window_not_open`, `ready`, `in_progress`, `disconnected`, `submitted`, `expired`, `revoked`.
- `ConsentPanel` — modal consent screen detailing recording and timer rules (`BR-12`).
- `WorkspaceConnectionStatus` — connection health and resume trigger (`BR-10`).
- `WorkspaceRecoveryPanel` — disconnect overlay and state recovery.
- `AiUsageIndicator` — tokens/cost tracking against caps (`BR-15`).
- `RubricScoreCard` — rubric dimension score, confidence, and cited evidence.
- `ReviewDisagreementAlert` — multi-agent score discrepancy warnings.
- `HumanReviewPanel` — human reviewer overrides, notes, and finalization (`BR-20`).
- `EntitlementUsageCard` — organization quota limits and usage meters (`BR-05`, `BR-06`).
- `AuditEventList` — append-only audit trail logs (`BR-31`).

---

## 3. Usage Example

```tsx
import {
  Button,
  Card,
  TextField,
  PasswordField,
  Breadcrumbs,
  Dialog,
  StatCard,
  useToast,
} from '@hs/ui';
```

