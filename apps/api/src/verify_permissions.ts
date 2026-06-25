import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000';

async function run() {
  console.log('🏁 STARTING ROLE SYSTEM VERIFICATION...');

  const tenantId = 'studymetro-global';
  const email = 'counsellor@studymetrojaipur.com';

  console.log('🔑 Logging in as Counsellor to retrieve JWT...');
  const loginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ email, password: 'Password123#' }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} - ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log('   JWT retrieved successfully!');
  console.log('   User role in payload:', loginData.user.role);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
  };

  // Find a lead assigned to superadmin (not counsellor)
  const superAdminUser = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN, tenantId }
  });
  if (!superAdminUser) {
    throw new Error('SuperAdmin user not found in database to perform boundary test.');
  }

  const unassignedLead = await prisma.lead.findFirst({
    where: { assigneeId: superAdminUser.id, tenantId }
  });
  if (!unassignedLead) {
    throw new Error('No lead assigned to SuperAdmin found for boundary test.');
  }

  console.log(`🔒 Boundary Test Lead ID (owned by SuperAdmin): ${unassignedLead.id}`);

  const results = {
    dashboardVisible: false,
    pipelineVisible: false,
    leadsVisible: false,
    followupsVisible: false,
    documentsHidden: false,
    activitiesVisible: false,
    applicationsHidden: false,
    templatesHidden: false,
    smtpHidden: false,
    brochuresHidden: false,
    reportsHidden: false,
    usersHidden: false,
  };

  // 1. Dashboard / Leads
  console.log('\n🧪 Testing Leads: GET /api/v1/leads...');
  const leadsRes = await fetch(`${API_URL}/api/v1/leads`, { headers: authHeaders });
  console.log(`   Leads Status: ${leadsRes.status}`);
  if (leadsRes.status === 200) {
    results.leadsVisible = true;
    results.dashboardVisible = true;
    results.pipelineVisible = true;
  }

  // 2. Followups
  console.log('\n🧪 Testing Followups: GET /api/v1/followups...');
  const followupsRes = await fetch(`${API_URL}/api/v1/followups`, { headers: authHeaders });
  console.log(`   Followups Status: ${followupsRes.status}`);
  if (followupsRes.status === 200) {
    results.followupsVisible = true;
  }

  // 3. Documents
  console.log('\n🧪 Testing Documents: GET /api/v1/documents...');
  const docsRes = await fetch(`${API_URL}/api/v1/documents`, { headers: authHeaders });
  console.log(`   Documents Status: ${docsRes.status}`);
  if (docsRes.status === 403) {
    results.documentsHidden = true;
  }

  // 4. Activities (Should be visible to counsellors, scoped to them)
  console.log('\n🧪 Testing Activities: GET /api/v1/leads/meta/activities...');
  const activitiesRes = await fetch(`${API_URL}/api/v1/leads/meta/activities`, { headers: authHeaders });
  console.log(`   Activities Status: ${activitiesRes.status}`);
  if (activitiesRes.status === 200) {
    results.activitiesVisible = true;
  }

  // 5. Applications (Accessing an unassigned lead's applications should be 403 Forbidden)
  console.log(`\n🧪 Testing Applications (for unowned Lead): GET /api/v1/applications/lead/${unassignedLead.id}...`);
  const appsRes = await fetch(`${API_URL}/api/v1/applications/lead/${unassignedLead.id}`, { headers: authHeaders });
  console.log(`   Applications Status: ${appsRes.status}`);
  if (appsRes.status === 403) {
    results.applicationsHidden = true;
  }

  // 6. Templates
  console.log('\n🧪 Testing Templates: GET /api/v1/communication/templates...');
  const templatesRes = await fetch(`${API_URL}/api/v1/communication/templates`, { headers: authHeaders });
  console.log(`   Templates Status: ${templatesRes.status}`);
  if (templatesRes.status === 403) {
    results.templatesHidden = true;
  }

  // 7. SMTP Settings
  console.log('\n🧪 Testing SMTP: GET /api/v1/communication/settings...');
  const settingsRes = await fetch(`${API_URL}/api/v1/communication/settings`, { headers: authHeaders });
  console.log(`   SMTP Settings Status: ${settingsRes.status}`);
  if (settingsRes.status === 403) {
    results.smtpHidden = true;
  }

  // 8. Brochures
  console.log('\n🧪 Testing Brochures: GET /api/v1/brochures...');
  const brochuresRes = await fetch(`${API_URL}/api/v1/brochures`, { headers: authHeaders });
  console.log(`   Brochures Status: ${brochuresRes.status}`);
  if (brochuresRes.status === 403) {
    results.brochuresHidden = true;
  }

  // 9. Reports & Analytics
  console.log('\n🧪 Testing Reports/Analytics: GET /api/v1/analytics/summary...');
  const reportsRes = await fetch(`${API_URL}/api/v1/analytics/summary`, { headers: authHeaders });
  console.log(`   Reports Status: ${reportsRes.status}`);
  if (reportsRes.status === 403) {
    results.reportsHidden = true;
  }

  // 10. Users Management
  console.log('\n🧪 Testing Users Management: GET /api/v1/users...');
  const usersRes = await fetch(`${API_URL}/api/v1/users`, { headers: authHeaders });
  console.log(`   Users Status: ${usersRes.status}`);
  if (usersRes.status === 403) {
    results.usersHidden = true;
  }

  // Generate Report
  console.log('\n==================================================');
  console.log('📋 VERIFICATION REPORT');
  console.log('==================================================');
  console.log(`1. Dashboard visible       : ${results.dashboardVisible ? 'PASS' : 'FAIL'}`);
  console.log(`2. Pipeline visible        : ${results.pipelineVisible ? 'PASS' : 'FAIL'}`);
  console.log(`3. Leads visible           : ${results.leadsVisible ? 'PASS' : 'FAIL'}`);
  console.log(`4. Followups visible       : ${results.followupsVisible ? 'PASS' : 'FAIL'}`);
  console.log(`5. Documents hidden (403)  : ${results.documentsHidden ? 'PASS' : 'FAIL'}`);
  console.log(`6. Activities visible (200): ${results.activitiesVisible ? 'PASS' : 'FAIL'}`);
  console.log(`7. Applications hidden(403): ${results.applicationsHidden ? 'PASS' : 'FAIL'}`);
  console.log(`8. Templates hidden (403)  : ${results.templatesHidden ? 'PASS' : 'FAIL'}`);
  console.log(`9. SMTP hidden (403)       : ${results.smtpHidden ? 'PASS' : 'FAIL'}`);
  console.log(`10. Brochures hidden (403) : ${results.brochuresHidden ? 'PASS' : 'FAIL'}`);
  console.log(`11. Reports hidden (403)   : ${results.reportsHidden ? 'PASS' : 'FAIL'}`);
  console.log(`12. Users hidden (403)     : ${results.usersHidden ? 'PASS' : 'FAIL'}`);
  console.log('==================================================');

  const allPassed = Object.values(results).every(v => v === true);
  if (allPassed) {
    console.log('🎉 ALL ROLE SYSTEM TESTS PASSED SUCCESSFULLY!');
  } else {
    throw new Error('Some role verification checks failed!');
  }
}

run()
  .catch((err) => {
    console.error('💥 Verification program failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
