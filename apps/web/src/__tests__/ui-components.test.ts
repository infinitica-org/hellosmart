import { describe, it, expect } from 'vitest';
import * as UI from '@hs/ui';

describe('@hs/ui shared components export contract', () => {
  it('exports foundation components', () => {
    expect(UI.Button).toBeDefined();
    expect(UI.IconButton).toBeDefined();
    expect(UI.Card).toBeDefined();
    expect(UI.CardHeader).toBeDefined();
    expect(UI.CardTitle).toBeDefined();
    expect(UI.CardDescription).toBeDefined();
    expect(UI.CardContent).toBeDefined();
    expect(UI.CardFooter).toBeDefined();
    expect(UI.Badge).toBeDefined();
    expect(UI.StatusIndicator).toBeDefined();
    expect(UI.StatusTag).toBeDefined();
    expect(UI.Separator).toBeDefined();
    expect(UI.Input).toBeDefined();
    expect(UI.Textarea).toBeDefined();
    expect(UI.Select).toBeDefined();
    expect(UI.Checkbox).toBeDefined();
    expect(UI.RadioGroup).toBeDefined();
    expect(UI.RadioGroupItem).toBeDefined();
    expect(UI.Switch).toBeDefined();
    expect(UI.Avatar).toBeDefined();
    expect(UI.AvatarGroup).toBeDefined();
    expect(UI.Label).toBeDefined();
    expect(UI.FormField).toBeDefined();
  });

  it('exports form components and fields', () => {
    expect(UI.FormLabel).toBeDefined();
    expect(UI.FormDescription).toBeDefined();
    expect(UI.FormError).toBeDefined();
    expect(UI.TextField).toBeDefined();
    expect(UI.PasswordField).toBeDefined();
    expect(UI.TextAreaField).toBeDefined();
    expect(UI.SelectField).toBeDefined();
    expect(UI.CheckboxField).toBeDefined();
    expect(UI.Form).toBeDefined();
  });

  it('exports navigation components', () => {
    expect(UI.Breadcrumbs).toBeDefined();
    expect(UI.DropdownMenu).toBeDefined();
    expect(UI.DropdownMenuTrigger).toBeDefined();
    expect(UI.DropdownMenuContent).toBeDefined();
    expect(UI.DropdownMenuItem).toBeDefined();
    expect(UI.DropdownMenuSeparator).toBeDefined();
    expect(UI.DropdownMenuLabel).toBeDefined();
    expect(UI.NavigationMenu).toBeDefined();
    expect(UI.Tabs).toBeDefined();
    expect(UI.TabsList).toBeDefined();
    expect(UI.TabsTrigger).toBeDefined();
    expect(UI.TabsContent).toBeDefined();
    expect(UI.Pagination).toBeDefined();
    expect(UI.CommandMenu).toBeDefined();
    expect(UI.SidebarNavItem).toBeDefined();
    expect(UI.SidebarNavigation).toBeDefined();
  });

  it('exports popups and overlay components', () => {
    expect(UI.Popover).toBeDefined();
    expect(UI.Tooltip).toBeDefined();
    expect(UI.Dialog).toBeDefined();
    expect(UI.DialogContent).toBeDefined();
    expect(UI.DialogHeader).toBeDefined();
    expect(UI.DialogTitle).toBeDefined();
    expect(UI.DialogDescription).toBeDefined();
    expect(UI.DialogFooter).toBeDefined();
    expect(UI.AlertDialog).toBeDefined();
    expect(UI.ConfirmationDialog).toBeDefined();
    expect(UI.Drawer).toBeDefined();
    expect(UI.Sheet).toBeDefined();
    expect(UI.ContextMenu).toBeDefined();
    expect(UI.HoverCard).toBeDefined();
    expect(UI.ToastProvider).toBeDefined();
    expect(UI.useToast).toBeDefined();
  });

  it('exports data and display components', () => {
    expect(UI.Table).toBeDefined();
    expect(UI.TableHeader).toBeDefined();
    expect(UI.TableBody).toBeDefined();
    expect(UI.TableRow).toBeDefined();
    expect(UI.TableHead).toBeDefined();
    expect(UI.TableCell).toBeDefined();
    expect(UI.List).toBeDefined();
    expect(UI.ListItem).toBeDefined();
    expect(UI.StatCard).toBeDefined();
    expect(UI.MetricCard).toBeDefined();
    expect(UI.ProgressBar).toBeDefined();
    expect(UI.Skeleton).toBeDefined();
    expect(UI.LoadingSpinner).toBeDefined();
    expect(UI.FilterBar).toBeDefined();
    expect(UI.SearchAndSortToolbar).toBeDefined();
    expect(UI.BulkActionBar).toBeDefined();
    expect(UI.Timeline).toBeDefined();
    expect(UI.TimelineItem).toBeDefined();
    expect(UI.Accordion).toBeDefined();
    expect(UI.AccordionItem).toBeDefined();
    expect(UI.AccordionTrigger).toBeDefined();
    expect(UI.AccordionContent).toBeDefined();
    expect(UI.PageHeader).toBeDefined();
    expect(UI.EmptyState).toBeDefined();
    expect(UI.BrandMark).toBeDefined();
  });

  it('exports error and 404 presentation components', () => {
    expect(UI.NotFound).toBeDefined();
    expect(UI.ErrorState).toBeDefined();
    expect(UI.AccessDenied).toBeDefined();
    expect(UI.ServerError).toBeDefined();
    expect(UI.NetworkError).toBeDefined();
    expect(UI.LoadingState).toBeDefined();
    expect(UI.NotFoundState).toBeDefined();
    expect(UI.AccessDeniedState).toBeDefined();
    expect(UI.ServerErrorState).toBeDefined();
    expect(UI.NetworkErrorState).toBeDefined();
  });

  it('exports HelloSmart product domain components', () => {
    expect(UI.SafeMarkdown).toBeDefined();
    expect(UI.EvidenceReference).toBeDefined();
    expect(UI.CountdownTimer).toBeDefined();
    expect(UI.AssessmentStatusBadge).toBeDefined();
    expect(UI.AssignmentStatus).toBeDefined();
    expect(UI.ConsentPanel).toBeDefined();
    expect(UI.WorkspaceConnectionStatus).toBeDefined();
    expect(UI.WorkspaceRecoveryPanel).toBeDefined();
    expect(UI.AiUsageIndicator).toBeDefined();
    expect(UI.RubricScoreCard).toBeDefined();
    expect(UI.ReviewDisagreementAlert).toBeDefined();
    expect(UI.HumanReviewPanel).toBeDefined();
    expect(UI.EntitlementUsageCard).toBeDefined();
    expect(UI.AuditEventList).toBeDefined();
  });

  it('exports cn utility function', () => {
    expect(UI.cn).toBeDefined();
    expect(typeof UI.cn).toBe('function');
    expect(UI.cn('px-4', undefined, 'py-2', false, 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('renders company dashboard with "Create Assessment" pointing to /company/assessments (BUG-10)', async () => {
    const React = await import('react');
    const { CompanyDashboardView } = await import('../app/(company)/company/page');
    const pageElement = CompanyDashboardView({});
    expect(pageElement).toBeDefined();

    const children = React.Children.toArray(pageElement.props.children);
    const card = children.find(
      (child: any) =>
        child?.props?.children &&
        React.Children.toArray(child.props.children).some(
          (c: any) => c?.props?.title === 'No assessments created yet',
        ),
    ) as any;
    expect(card).toBeDefined();

    const emptyState = React.Children.toArray(card.props.children).find(
      (c: any) => c?.props?.title === 'No assessments created yet',
    ) as any;
    expect(emptyState).toBeDefined();
    expect(emptyState.props.action).toEqual({
      label: 'Create Assessment',
      href: '/company/assessments',
    });
  });
});
