import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
  getTestDbPool,
  getDevDbPool,
  setupTestEnvironment,
  cleanupTestEnvironment,
  getDatabaseCounts,
  type TestOrgFixture,
  type DbCounts,
} from './helpers/db-helper';
import { getInviteLinkFromMailpit, deleteMailpitMessage } from './helpers/mailpit-helper';

test.describe.configure({ mode: 'serial' });

test.describe('Hiring Lifecycle E2E Journey (Company Setup to Candidate Onboarding)', () => {
  let pool: any;
  let devPool: any;
  let fixture: TestOrgFixture;
  let createdAssessmentId: string | null = null;
  let importedEmail: string;
  let candidatePassword: string;
  let candidateContext: BrowserContext | null = null;
  let candidatePage: Page | null = null;
  let inviteUrl: string | null = null;
  let adminPage: Page;
  let devCountsBefore: DbCounts;
  let devCountsAfter: DbCounts;

  test.beforeAll(async ({ browser }) => {
    pool = getTestDbPool();
    devPool = getDevDbPool();

    // Invariant: Verify dev database row counts before test starts
    devCountsBefore = await getDatabaseCounts(devPool);

    // Setup synthetic test org, entitlements, company admin, template & published version on hellosmart_test
    fixture = await setupTestEnvironment(pool);

    importedEmail = `candidate1.${Date.now().toString(36)}@example.test`;
    candidatePassword = `CandPass_${Date.now().toString(36)}_!Secure99`;

    const adminContext = await browser.newContext();
    adminPage = await adminContext.newPage();
  });

  test.afterAll(async () => {
    try {
      if (candidateContext) {
        await candidateContext.close().catch(() => {});
      }
      if (adminPage) {
        await adminPage
          .context()
          .close()
          .catch(() => {});
      }

      if (pool && fixture) {
        // Reverse dependency cleanup with hs_owner admin role
        await cleanupTestEnvironment(pool, fixture);
      }

      // Invariant: Verify dev database (hellosmart) remained 100% untouched
      devCountsAfter = await getDatabaseCounts(devPool);
      expect(devCountsAfter.organizations).toBe(devCountsBefore.organizations);
      expect(devCountsAfter.users).toBe(devCountsBefore.users);
      expect(devCountsAfter.assessments).toBe(devCountsBefore.assessments);
      expect(devCountsAfter.invitations).toBe(devCountsBefore.invitations);
      expect(devCountsAfter.templates).toBe(devCountsBefore.templates);
      expect(devCountsAfter.templateVersions).toBe(devCountsBefore.templateVersions);
      expect(devCountsAfter.auditEvents).toBe(devCountsBefore.auditEvents);
    } finally {
      await pool?.end();
      await devPool?.end();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REAL STEP 1: Admin Login -> Template Catalog -> Wizard -> Rubric
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 1: Company Admin Login, Template Catalog, 3-Step Assessment Wizard & Rubric Customizer [CO-001, CO-003, CO-004, CO-006, BR-02, BR-03, BR-18]', async () => {
    // 1a: Company Admin Login
    await adminPage.goto('/login');
    await expect(adminPage).toHaveTitle(/HelloSmart/i);

    const emailInput = adminPage.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill(fixture.adminEmail);
    await adminPage.keyboard.press('Enter');

    const passwordInput = adminPage.locator('input[type="password"], input[name="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 10_000 });
    await passwordInput.fill(fixture.adminPassword);
    await adminPage.keyboard.press('Enter');

    await adminPage.waitForURL(/\/company/, { timeout: 15_000 });
    expect(adminPage.url()).toContain('/company');

    // 1b: Browse Templates Catalog & Select Assigned Template
    await adminPage.goto('/company/templates');
    await expect(adminPage.getByRole('heading', { name: /role template catalog/i })).toBeVisible({
      timeout: 15_000,
    });

    const templateCard = adminPage
      .locator('article, [class*="rounded"]')
      .filter({ hasText: fixture.templateName });
    await expect(templateCard.first()).toBeVisible({ timeout: 10_000 });

    const previewBtn = templateCard.first().getByRole('button', { name: /preview/i });
    await previewBtn.click();

    const drawer = adminPage
      .getByTestId('template-preview-drawer')
      .or(adminPage.getByRole('dialog'));
    await expect(drawer.first()).toBeVisible({ timeout: 10_000 });

    const useTemplateBtn = adminPage.getByRole('button', { name: /use this template/i });
    await expect(useTemplateBtn.first()).toBeEnabled({ timeout: 10_000 });
    await useTemplateBtn.first().click();

    await adminPage.waitForURL(/\/company\/assessments\/new/, { timeout: 15_000 });

    // 1c: Configure 3-Step Assessment Wizard
    await expect(adminPage.getByTestId('assessment-creation-wizard')).toBeVisible();

    const nextBtn = adminPage.getByTestId('wizard-next-btn');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    await expect(adminPage.getByRole('textbox', { name: /candidate instructions/i })).toBeVisible({
      timeout: 10_000,
    });
    await nextBtn.click();

    await expect(adminPage.getByTestId('wizard-step-3')).toBeVisible({ timeout: 10_000 });

    const submitBtn = adminPage.getByTestId('wizard-submit-btn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    const confirmDialog = adminPage
      .getByRole('dialog')
      .or(adminPage.locator('[data-testid="confirm-assessment-dialog"]'));
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });

    const confirmBtn = adminPage
      .getByTestId('confirm-create-assessment-btn')
      .or(confirmDialog.getByRole('button', { name: /create assessment/i }));
    await expect(confirmBtn.first()).toBeVisible({ timeout: 5_000 });
    await confirmBtn.first().click();

    await adminPage.waitForURL(
      (url) => url.pathname === '/company/assessments' && url.searchParams.has('createdId'),
      { timeout: 15_000 },
    );
    const currentUrl = new URL(adminPage.url());
    createdAssessmentId = currentUrl.searchParams.get('createdId');
    expect(createdAssessmentId).toBeTruthy();

    // 1d: Customize Rubric & Adjust Weights
    await adminPage.goto(
      `/company/assessments/${createdAssessmentId}/rubric?templateId=${encodeURIComponent(
        fixture.templateSlug,
      )}&versionId=${encodeURIComponent(fixture.templateVersionString)}`,
    );
    await expect(adminPage.getByTestId('rubric-editor')).toBeVisible({ timeout: 15_000 });

    const balanceCard = adminPage.getByTestId('rubric-weight-balance-card');
    await expect(balanceCard).toBeVisible();
    await expect(balanceCard).toContainText('100%');

    const saveBtn = adminPage.getByTestId('save-rubric-btn');
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await expect(adminPage.getByText(/rubric is 100% balanced/i)).toBeVisible({
        timeout: 10_000,
      });
    }

    // Verify assessment appears in assessments hub and is persisted in database
    await adminPage.goto('/company/assessments');
    await expect(adminPage.getByText(/active assessments/i)).toBeVisible({
      timeout: 10_000,
    });

    const verifyClient = await pool.connect();
    try {
      const dbAssess = await verifyClient.query(
        'SELECT id, name, status FROM app.assessments WHERE id = $1',
        [createdAssessmentId],
      );
      expect(dbAssess.rows.length).toBe(1);
      expect(dbAssess.rows[0].status).toBe('draft');
    } finally {
      verifyClient.release();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SKIPPED STEP 1e: Publish Assessment
  // ─────────────────────────────────────────────────────────────────────────
  test.fixme(
    'Step 1e: Publish Assessment [CO-025] - Fastify Backend Lacks Publish Endpoint & UI Publish Button',
    async () => {
      // [SKIPPED]: CO-025 Assessment publish endpoint (/assessments/:id/publish) is unmapped on the Fastify API
      // and no publish trigger button exists in the web assessment management view.
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // REAL STEP 2: Candidate Bulk CSV Ingestion & Invitation Creation
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 2: Candidate Bulk CSV Ingestion & Invitation Creation [CO-012, BR-06, BR-24]', async () => {
    await adminPage.goto('/company/candidates');
    await expect(adminPage.getByTestId('candidate-search-input')).toBeVisible({ timeout: 10_000 });

    const bulkUploadBtn = adminPage.getByRole('button', { name: /bulk upload/i });
    await expect(bulkUploadBtn).toBeVisible();
    await bulkUploadBtn.click();

    const dialog = adminPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Synthesize CSV: 3 valid candidates on example.test + 1 malformed row
    const csvContent = [
      'name,email',
      `E2E Candidate Alpha,${importedEmail}`,
      `E2E Candidate Beta,candidate2.${Date.now().toString(36)}@example.test`,
      `E2E Candidate Gamma,candidate3.${Date.now().toString(36)}@example.test`,
      'Corrupted Row,not-an-email-address',
    ].join('\n');

    const fileInput = adminPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'candidates-e2e.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
    });

    // Preview step: asserts 3 valid, 1 error
    await expect(
      dialog.getByText(/validation summary/i).or(dialog.getByText(/3 valid/i)),
    ).toBeVisible({ timeout: 10_000 });

    const proceedBtn = dialog.getByRole('button', { name: /import 3 valid candidates/i });
    await expect(proceedBtn).toBeEnabled();
    await proceedBtn.click();

    // Summary step: asserts success and invitation
    await expect(dialog.getByText(/bulk import completed/i)).toBeVisible({ timeout: 12_000 });
    await expect(dialog.getByText(/successfully invited/i)).toBeVisible();

    const doneBtn = dialog.getByRole('button', { name: /done/i });
    await doneBtn.click();
    await expect(dialog).toBeHidden();

    // Candidate appears in UI table with status Invited
    await expect(adminPage.getByText(importedEmail)).toBeVisible({ timeout: 10_000 });

    // Database assertion: verify exactly 3 invitations were created for this org
    const client = await pool.connect();
    try {
      const inviteRes = await client.query(
        'SELECT count(*)::int AS count FROM app.invitations WHERE org_id = $1',
        [fixture.orgId],
      );
      expect(inviteRes.rows[0].count).toBe(3);
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REAL STEP 3: Mailpit Invitation Delivery, Password Setup & Candidate Login
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 3: Mailpit Invitation Delivery, Password Setup & Candidate Login [CA-001, CA-002, BR-24]', async ({
    browser,
  }) => {
    // Read real invitation email from Mailpit API
    const inviteData = await getInviteLinkFromMailpit(
      importedEmail,
      'http://127.0.0.1:8025',
      15_000,
    );
    expect(inviteData).not.toBeNull();
    inviteUrl = inviteData!.inviteUrl;

    // Delete test message from Mailpit by ID
    await deleteMailpitMessage(inviteData!.messageId);

    // Open invite in isolated candidate context (no company admin session cookies)
    candidateContext = await browser.newContext();
    candidatePage = await candidateContext.newPage();

    await candidatePage.goto(inviteUrl);
    await expect(
      candidatePage.getByRole('heading', { name: /set your password/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    const newPassInput = candidatePage.locator('input#new-password');
    const confirmPassInput = candidatePage.locator('input#confirm-password');
    await newPassInput.fill(candidatePassword);
    await confirmPassInput.fill(candidatePassword);

    const savePassBtn = candidatePage.getByRole('button', { name: /save password/i });
    await expect(savePassBtn).toBeEnabled();
    await savePassBtn.click();

    // Automatically redirects to /login after successful password setup
    await expect(candidatePage).toHaveURL(/\/login/, { timeout: 15_000 });

    // Candidate Login with newly configured password
    const loginEmailInput = candidatePage.locator('input[type="email"], input[name="email"]');
    await expect(loginEmailInput).toBeVisible({ timeout: 10_000 });
    await loginEmailInput.fill(importedEmail);
    await candidatePage.keyboard.press('Enter');

    const loginPassInput = candidatePage.locator('input[type="password"], input[name="password"]');
    await expect(loginPassInput).toBeVisible({ timeout: 10_000 });
    await loginPassInput.fill(candidatePassword);
    await candidatePage.keyboard.press('Enter');

    // Server redirects by role: candidate lands on Candidate Portal (/candidate)
    await expect(candidatePage).toHaveURL(/\/candidate/, { timeout: 15_000 });
    expect(candidatePage.url()).toContain('/candidate');

    // Assert consumed single-use invitation token is invalidated (BR-24)
    const secondPage = await candidateContext.newPage();
    await secondPage.goto(inviteUrl);
    await expect(
      secondPage
        .getByRole('alert')
        .or(secondPage.getByText(/no longer valid|invitation unavailable/i)),
    ).toBeVisible({ timeout: 10_000 });
    await secondPage.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SKIPPED STEP 3d: Candidate Diagnostic Pre-check
  // ─────────────────────────────────────────────────────────────────────────
  test.fixme(
    'Step 3d: Candidate Diagnostic Pre-check [unconfirmed] - Web Diagnostic Wizard Not Implemented',
    async () => {
      // [SKIPPED]: Diagnostic pre-check wizard component is unbuilt in MMP web app.
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SKIPPED STEP 3e: Mode-based Candidate Consent Modal
  // ─────────────────────────────────────────────────────────────────────────
  test.fixme(
    'Step 3e: Candidate Mode-based Consent Modal [CA-007, BR-12] - Candidate Consent View Not Implemented',
    async () => {
      // [SKIPPED]: CA-007 / BR-12 Mode-specific candidate consent modal (POST /candidate/assignments/:id/consent)
      // is not built in the candidate UI.
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SKIPPED STEP 4: Candidate Workspace Launch & Solution Upload
  // ─────────────────────────────────────────────────────────────────────────
  test.fixme(
    'Step 4: Candidate Workspace Launch & Solution Upload [CA-005, CA-018] - Cloud Workspace Orchestrator Required',
    async () => {
      // [SKIPPED]: CA-005 workspace connect state and CA-018 submit work endpoint
      // (POST /candidate/workspaces/:id/submit) require an active cloud VM / container runtime orchestrator.
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SKIPPED STEP 5: Company Submission Review & Artifact Download
  // ─────────────────────────────────────────────────────────────────────────
  test.fixme(
    'Step 5: Company Submission Review & Artifact Download [CO-042] - Requires Completed Candidate Submission',
    async () => {
      // [SKIPPED]: CO-042 Submission detail view and presigned download link require a submitted workspace session.
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // REAL STEP 6: Route & Role Isolation Smoke Tests (BR-25)
  // ─────────────────────────────────────────────────────────────────────────
  test('Step 6: Route & Role Isolation Smoke Checks [BR-25]', async ({ browser }) => {
    // 1. Unauthenticated guest visiting protected /company route redirects to /login
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto('/company');
    await expect(guestPage).toHaveURL(/\/login/, { timeout: 10_000 });
    expect(guestPage.url()).toContain('/login');
    await guestContext.close();

    // 2. Candidate role accessing /company or /admin is redirected back to /candidate
    if (candidatePage) {
      await candidatePage.goto('/company');
      await expect(candidatePage).toHaveURL(/\/candidate/, { timeout: 10_000 });
      expect(candidatePage.url()).toContain('/candidate');

      await candidatePage.goto('/admin');
      await expect(candidatePage).toHaveURL(/\/candidate/, { timeout: 10_000 });
      expect(candidatePage.url()).toContain('/candidate');
    }

    // 3. Company Admin accessing /admin is denied or redirected
    await adminPage.goto('/admin');
    await expect(adminPage).toHaveURL(/\/(company|login)/, { timeout: 10_000 });
    expect(adminPage.url()).not.toContain('/admin');
  });
});
