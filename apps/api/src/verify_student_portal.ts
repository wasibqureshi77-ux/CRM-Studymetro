import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://127.0.0.1:4000';

async function run() {
  console.log('🏁 STARTING STUDENT PORTAL VERIFICATION (PHASE 8B)...');

  const tenantId = 'studymetro-global';
  const studentEmail = 'verify.student@studymetrojaipur.com';

  // 1. Clean old test leads
  console.log('🧹 Cleaning old test records...');
  const oldLeads = await prisma.lead.findMany({
    where: { email: studentEmail, tenantId }
  });
  for (const oldLead of oldLeads) {
    await prisma.activity.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.followup.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.leadDocument.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.studentProfile.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.brochureAssignment.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.communicationLog.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.communicationQueue.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.lead.delete({ where: { id: oldLead.id } });
  }

  // 2. Log in as Super Admin to get Admin JWT
  console.log('🔑 Logging in as Super Admin...');
  const adminLoginRes = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ email: 'superadmin@studymetrojaipur.com', password: 'Password123#' }),
  });
  if (!adminLoginRes.ok) {
    throw new Error(`Admin login failed: ${adminLoginRes.status} - ${await adminLoginRes.text()}`);
  }
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.accessToken;

  const adminHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
  };

  // 3. Create a Lead via CRM API
  console.log('➕ Creating a Lead via CRM API...');
  const createLeadRes = await fetch(`${API_URL}/api/v1/leads`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      firstName: 'Alex',
      lastName: 'Student',
      email: studentEmail,
      phone: '+919999888877',
      leadCategory: 'STUDY_ABROAD',
      preferredCountry: 'Canada',
    }),
  });

  if (!createLeadRes.ok) {
    throw new Error(`Failed to create lead: ${createLeadRes.status} - ${await createLeadRes.text()}`);
  }
  const leadData = await createLeadRes.json();
  console.log(`   Lead created successfully. ID: ${leadData.id}, Portal ID: ${leadData.studentPortalId}`);

  // 4. Update status to ENROLLED to trigger Portal ID generation
  console.log('🔄 Moving Lead to ENROLLED status to generate Portal ID...');
  const updateLeadRes = await fetch(`${API_URL}/api/v1/leads/${leadData.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      status: 'ENROLLED',
    }),
  });

  if (!updateLeadRes.ok) {
    throw new Error(`Failed to update lead status: ${updateLeadRes.status} - ${await updateLeadRes.text()}`);
  }

  // Retrieve lead from DB and check Portal ID
  const enrolledLead = await prisma.lead.findUnique({ where: { id: leadData.id } });
  if (!enrolledLead || !enrolledLead.studentPortalId) {
    throw new Error('❌ Failed to generate studentPortalId during status transition to ENROLLED');
  }

  console.log(`   Success! Generated Portal ID: ${enrolledLead.studentPortalId}`);

  const studentLead = enrolledLead;

  // Resolve results checklist
  const results = {
    emailValidated: false,
    emailOtpDelivered: false,
    emailOtpVerified: false,
    magicLinkDelivered: false,
    magicLinkVerified: false,
    singleUseTokenInvalidated: false,
    dashboardAccessible: false,
    crmAccessBlocked: false,
    settingsUpdateSync: false,
    documentUploadWorks: false,
    versionIncrementWorks: false,
    profileUpdateWorks: false,
    autoLoginLinkWorks: false,
  };

  // 2. Validate email and check active methods
  console.log('\n🧪 Testing Email Validation: POST /api/v1/student-portal/auth/check-email...');
  const checkEmailRes = await fetch(`${API_URL}/api/v1/student-portal/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ email: studentEmail }),
  });
  const checkEmailData = await checkEmailRes.json();
  console.log(`   Exists: ${checkEmailData.exists}, Available Methods:`, checkEmailData.methods);
  if ((checkEmailRes.status === 200 || checkEmailRes.status === 201) && checkEmailData.exists && checkEmailData.methods.emailOtp) {
    results.emailValidated = true;
  }

  // 3. Test Email OTP flow
  console.log('\n🧪 Testing Email OTP Dispatch: POST /api/v1/student-portal/auth/send-otp (email_otp)...');
  const sendOtpRes = await fetch(`${API_URL}/api/v1/student-portal/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ email: studentEmail, method: 'email_otp' }),
  });
  if (sendOtpRes.status === 201) {
    results.emailOtpDelivered = true;
  }

  // Retrieve OTP code directly from database to simulate receipt
  const otpLead = await prisma.lead.findUnique({ where: { id: studentLead.id } });
  const otpCode = otpLead?.studentOtpCode;
  console.log(`   OTP code retrieved from DB: ${otpCode}`);

  console.log('🧪 Testing Email OTP Verification: POST /api/v1/student-portal/auth/verify-otp...');
  const verifyOtpRes = await fetch(`${API_URL}/api/v1/student-portal/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ email: studentEmail, code: otpCode }),
  });
  
  let studentJwtToken = '';
  if (verifyOtpRes.status === 201 || verifyOtpRes.status === 200) {
    const data = await verifyOtpRes.json();
    studentJwtToken = data.token;
    results.emailOtpVerified = true;
    console.log('   Logged in via OTP! JWT retrieved.');
  }

  // 4. Test Magic Link flow
  console.log('\n🧪 Testing Magic Link Dispatch: POST /api/v1/student-portal/auth/send-otp (magic_link)...');
  const sendMagicRes = await fetch(`${API_URL}/api/v1/student-portal/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ email: studentEmail, method: 'magic_link' }),
  });
  if (sendMagicRes.status === 201) {
    results.magicLinkDelivered = true;
  }

  const magicLead = await prisma.lead.findUnique({ where: { id: studentLead.id } });
  const magicToken = magicLead?.studentMagicToken;
  console.log(`   Magic token retrieved from DB: ${magicToken}`);

  console.log('🧪 Testing Magic Link Verification...');
  const verifyMagicRes = await fetch(`${API_URL}/api/v1/student-portal/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ token: magicToken }),
  });
  console.log(`   Verify Magic Link Status: ${verifyMagicRes.status}`);
  if (verifyMagicRes.status !== 200 && verifyMagicRes.status !== 201) {
    console.log(`   Verify Magic Link Error Body: ${await verifyMagicRes.text()}`);
  }
  if (verifyMagicRes.status === 201 || verifyMagicRes.status === 200) {
    results.magicLinkVerified = true;
    console.log('   Logged in via Magic Link!');
  }

  console.log('🧪 Testing Magic Link Token single-use invalidation...');
  const verifyMagicRetryRes = await fetch(`${API_URL}/api/v1/student-portal/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ token: magicToken }),
  });
  console.log(`   Retry Status: ${verifyMagicRetryRes.status}`);
  if (verifyMagicRetryRes.status === 401) {
    results.singleUseTokenInvalidated = true;
    console.log('   Passed! Magic token was successfully invalidated after first use.');
  }

  // 5. Test Dashboard Scoping
  console.log('\n🧪 Testing Student Dashboard API: GET /api/v1/student-portal/dashboard...');
  const dashboardRes = await fetch(`${API_URL}/api/v1/student-portal/dashboard`, {
    headers: {
      'Authorization': `Bearer ${studentJwtToken}`,
      'x-tenant-id': tenantId
    },
  });
  console.log(`   Dashboard Status: ${dashboardRes.status}`);
  if (dashboardRes.status === 200) {
    const data = await dashboardRes.json();
    console.log(`   Portal ID in response: ${data.student.portalId}`);
    console.log(`   Country: ${data.student.country}, Course: ${data.student.course}`);
    results.dashboardAccessible = true;
  }

  // 6. Test Security Boundaries (No CRM access for student JWT)
  console.log('\n🧪 Testing CRM Leads endpoint access using Student JWT...');
  const crmLeadsRes = await fetch(`${API_URL}/api/v1/leads`, {
    headers: {
      'Authorization': `Bearer ${studentJwtToken}`,
      'x-tenant-id': tenantId
    },
  });
  console.log(`   CRM Leads Status: ${crmLeadsRes.status}`);

  console.log('🧪 Testing CRM Users endpoint access using Student JWT...');
  const crmUsersRes = await fetch(`${API_URL}/api/v1/users`, {
    headers: {
      'Authorization': `Bearer ${studentJwtToken}`,
      'x-tenant-id': tenantId
    },
  });
  console.log(`   CRM Users Status: ${crmUsersRes.status}`);

  if (crmLeadsRes.status === 403 && crmUsersRes.status === 403) {
    results.crmAccessBlocked = true;
    console.log('   Passed! CRM admin/counsellor endpoints rejected the Student token.');
  }

  // 7. Verify dynamic settings switches
  console.log('\n🧪 Testing Dynamic Switches: disabling Magic Link...');
  const existingSetting = await prisma.emailSetting.findUnique({ where: { tenantId } });
  if (!existingSetting) {
    await prisma.emailSetting.create({
      data: {
        tenantId,
        host: 'smtp.test.com',
        port: 587,
        username: 'test@test.com',
        password: 'dummy-encrypted-password',
        senderName: 'Test',
        senderEmail: 'test@test.com',
        studentMagicLinkEnabled: false,
      }
    });
  } else {
    await prisma.emailSetting.update({
      where: { tenantId },
      data: { studentMagicLinkEnabled: false }
    });
  }

  const checkEmailAfterDisableRes = await fetch(`${API_URL}/api/v1/student-portal/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
    body: JSON.stringify({ email: studentEmail }),
  });
  const checkEmailAfterDisableData = await checkEmailAfterDisableRes.json();
  console.log(`   Available Methods:`, checkEmailAfterDisableData.methods);
  
  if (!checkEmailAfterDisableData.methods.magicLink && checkEmailAfterDisableData.methods.emailOtp) {
    results.settingsUpdateSync = true;
    console.log('   Passed! Disabling Magic Link in settings dynamically updated login screen choices.');
  }

  // Clean up setting switches back to enabled
  await prisma.emailSetting.update({
    where: { tenantId },
    data: { studentMagicLinkEnabled: true }
  });

  // ============================================
  // PHASE 8B FEATURE TESTING
  // ============================================

  // 8. Document Checklist Generation & Upload
  console.log('\n🧪 Testing Phase 8B: Document Upload...');
  // Generate checklist for study abroad category
  await fetch(`${API_URL}/api/v1/documents/checklist/generate`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ leadId: studentLead.id, category: 'STUDY_ABROAD' }),
  });

  const docChecklist = await prisma.leadDocument.findFirst({
    where: { leadId: studentLead.id, documentType: 'Passport', isCurrent: true }
  });
  if (!docChecklist) {
    throw new Error('Checklist generation failed: Passport not found');
  }

  // Construct Form Data
  const formData = new FormData();
  formData.append('documentType', 'Passport');
  const mockFile = new Blob(['mock passport content'], { type: 'application/pdf' });
  formData.append('file', mockFile, 'passport_mock.pdf');

  const uploadRes = await fetch(`${API_URL}/api/v1/student-portal/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${studentJwtToken}`,
      'x-tenant-id': tenantId,
    },
    body: formData,
  });

  console.log(`   Upload Status: ${uploadRes.status}`);
  if (uploadRes.status === 201 || uploadRes.status === 200) {
    const uploadData = await uploadRes.json();
    if (uploadData.success) {
      results.documentUploadWorks = true;
      console.log('   Passed! Document uploaded successfully.');
    }
  }

  // 9. Document Re-upload & Versioning (Block when UPLOADED, Allow when REJECTED)
  console.log('\n🧪 Testing Phase 8B: Block upload for UPLOADED items & version incrementing...');
  const blockRes = await fetch(`${API_URL}/api/v1/student-portal/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${studentJwtToken}`,
      'x-tenant-id': tenantId,
    },
    body: formData,
  });
  console.log(`   Blocked Upload Status (expect 400): ${blockRes.status}`);

  if (blockRes.status === 400) {
    console.log('   Correctly blocked upload for UPLOADED document. Rejecting document to allow version increment test...');
    
    // Admin rejects document
    const currentDoc = await prisma.leadDocument.findFirst({
      where: { leadId: studentLead.id, documentType: 'Passport', isCurrent: true }
    });
    if (currentDoc) {
      await fetch(`${API_URL}/api/v1/documents/${currentDoc.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'REJECTED', note: 'Please upload clean scan of first/last page.' }),
      });

      // Upload again
      const reuploadRes = await fetch(`${API_URL}/api/v1/student-portal/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${studentJwtToken}`,
          'x-tenant-id': tenantId,
        },
        body: formData,
      });

      console.log(`   Re-upload Status: ${reuploadRes.status}`);
      if (reuploadRes.status === 201 || reuploadRes.status === 200) {
        const checkDoc = await prisma.leadDocument.findFirst({
          where: { leadId: studentLead.id, documentType: 'Passport', isCurrent: true }
        });
        if (checkDoc && checkDoc.version === 2 && checkDoc.status === 'UPLOADED') {
          results.versionIncrementWorks = true;
          console.log(`   Passed! Version incremented to ${checkDoc.version}.`);
        }
      }
    }
  }

  // 10. Student Profile Updates
  console.log('\n🧪 Testing Phase 8B: Profile updates...');
  const profilePatchRes = await fetch(`${API_URL}/api/v1/student-portal/profile`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${studentJwtToken}`,
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      phone: '+919999888800',
      address: '456 Student Boulevard',
      emergencyContact: '+91 99999 11111',
      photo: 'https://example.com/student-photo.png',
    }),
  });

  console.log(`   Profile Update Status: ${profilePatchRes.status}`);
  if (profilePatchRes.ok) {
    const updatedDbLead = await prisma.lead.findUnique({ where: { id: studentLead.id } });
    if (
      updatedDbLead?.phone === '+919999888800' &&
      updatedDbLead?.address === '456 Student Boulevard' &&
      updatedDbLead?.emergencyContact === '+91 99999 11111' &&
      updatedDbLead?.photo === 'https://example.com/student-photo.png'
    ) {
      results.profileUpdateWorks = true;
      console.log('   Passed! Profile update values match database values.');
    }
  }

  // 11. Auto-Login Link generation and enqueued message callback verification
  console.log('\n🧪 Testing Phase 8B: Auto-login Link generator...');
  await fetch(`${API_URL}/api/v1/communication/enqueue`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      leadId: studentLead.id,
      channel: 'EMAIL',
      eventType: 'WELCOME',
      payload: {},
    }),
  });

  console.log('   Triggering queue processing...');
  await fetch(`${API_URL}/api/v1/communication/process`, {
    method: 'POST',
    headers: adminHeaders,
  });

  const welcomeLog = await prisma.communicationLog.findFirst({
    where: { leadId: studentLead.id, eventType: 'WELCOME' },
    orderBy: { sentAt: 'desc' }
  });

  if (welcomeLog) {
    console.log('   Log found. Message content:');
    console.log(`   --- CONTENT START ---\n${welcomeLog.message}\n   --- CONTENT END ---`);
    
    // Find URL token
    const tokenMatch = welcomeLog.message.match(/token=([a-f0-9]+)/);
    if (tokenMatch) {
      const extractedToken = tokenMatch[1];
      console.log(`   Extracted login token: ${extractedToken}`);

      // Try auto login via token
      const autoLoginVerifyRes = await fetch(`${API_URL}/api/v1/student-portal/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({ token: extractedToken }),
      });

      console.log(`   Auto-login verify status: ${autoLoginVerifyRes.status}`);
      if (autoLoginVerifyRes.status === 201 || autoLoginVerifyRes.status === 200) {
        results.autoLoginLinkWorks = true;
        console.log('   Passed! Auto-login using enqueued token succeeded.');
      }
    }
  }

  // Generate E2E Report
  console.log('\n==================================================');
  console.log('📋 STUDENT PORTAL E2E VERIFICATION REPORT');
  console.log('==================================================');
  console.log(`1. Student Email check     : ${results.emailValidated ? 'PASS' : 'FAIL'}`);
  console.log(`2. Email OTP dispatch      : ${results.emailOtpDelivered ? 'PASS' : 'FAIL'}`);
  console.log(`3. Email OTP verification  : ${results.emailOtpVerified ? 'PASS' : 'FAIL'}`);
  console.log(`4. Magic Link dispatch     : ${results.magicLinkDelivered ? 'PASS' : 'FAIL'}`);
  console.log(`5. Magic Link verification : ${results.magicLinkVerified ? 'PASS' : 'FAIL'}`);
  console.log(`6. Single-use token check  : ${results.singleUseTokenInvalidated ? 'PASS' : 'FAIL'}`);
  console.log(`7. Dashboard accessibility  : ${results.dashboardAccessible ? 'PASS' : 'FAIL'}`);
  console.log(`8. CRM Admin access block  : ${results.crmAccessBlocked ? 'PASS' : 'FAIL'}`);
  console.log(`9. Dynamic settings switches: ${results.settingsUpdateSync ? 'PASS' : 'FAIL'}`);
  console.log(`10. Document upload works   : ${results.documentUploadWorks ? 'PASS' : 'FAIL'}`);
  console.log(`11. Version increment works : ${results.versionIncrementWorks ? 'PASS' : 'FAIL'}`);
  console.log(`12. Profile patch works     : ${results.profileUpdateWorks ? 'PASS' : 'FAIL'}`);
  console.log(`13. Outbound auto-login works: ${results.autoLoginLinkWorks ? 'PASS' : 'FAIL'}`);
  console.log('==================================================');

  const allPassed = Object.values(results).every(v => v === true);
  if (allPassed) {
    console.log('🎉 ALL STUDENT PORTAL PHASE 8B TESTS PASSED SUCCESSFULLY!');
  } else {
    throw new Error('Some Student Portal verification checks failed!');
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
