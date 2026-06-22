import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function verify() {
  console.log('🏁 Starting Website Lead Capture SDK verification...\n');

  // 1. Audit metro-tracker.js GET endpoint
  console.log('⏳ 1. Auditing metro-tracker.js GET endpoint...');
  const sdkRes = await fetch(`${API_URL}/sdk/metro-tracker.js`);
  if (!sdkRes.ok) {
    throw new Error(`Failed to load SDK script: ${sdkRes.status} - ${await sdkRes.text()}`);
  }
  const sdkJs = await sdkRes.text();
  
  const checks = {
    interceptionKeywords: sdkJs.includes('matchesContact') && sdkJs.includes('matchesConsult') && sdkJs.includes('matchesAdmission') && sdkJs.includes('matchesLead'),
    metroCaptureAttr: sdkJs.includes('data-metro-capture'),
    targetFields: sdkJs.includes('country') && sdkJs.includes('course') && sdkJs.includes('intake'),
    utmAndReferrer: sdkJs.includes('utmSource') && sdkJs.includes('referrer'),
    noDirectFormName: !sdkJs.includes('form.name.toLowerCase') && !sdkJs.includes('(form.name || "").toLowerCase'),
    safeMetadataExtraction: sdkJs.includes("String(form.id || '')") &&
                            sdkJs.includes("String(form.className || '')") &&
                            sdkJs.includes("String(form.getAttribute('name') || '')") &&
                            sdkJs.includes("String(form.getAttribute('action') || '')"),
    defensiveGuards: sdkJs.includes('try {') && sdkJs.includes('catch (e)')
  };
  
  if (
    checks.interceptionKeywords && 
    checks.metroCaptureAttr && 
    checks.targetFields && 
    checks.utmAndReferrer &&
    checks.noDirectFormName &&
    checks.safeMetadataExtraction &&
    checks.defensiveGuards
  ) {
    console.log('   ✅ SDK client script audit passed!');
  } else {
    console.error('   ❌ SDK client script audit failed:', checks);
    process.exit(1);
  }

  // 2. Setup mock browser IDs
  const visitorId = uuidv4();
  const sessionId = uuidv4();
  console.log(`\n⏳ 2. Generated Visitor ID: ${visitorId}`);
  console.log(`   Generated Session ID: ${sessionId}`);

  // 3. Send website visit event
  console.log('\n⏳ 3. Sending website visit (PAGE_VIEW) event...');
  const visitRes = await fetch(`${API_URL}/api/v1/tracker/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'studymetro-global' },
    body: JSON.stringify({
      type: 'PAGE_VIEW',
      visitorId,
      sessionId,
      meta: {
        landingPage: 'http://localhost:3000/dashboard/tracker-test',
        referrer: 'http://google.com',
        deviceType: 'Desktop',
        browser: 'Chrome',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'winter_promo'
      }
    })
  });
  if (!visitRes.ok) {
    throw new Error(`Failed to track PAGE_VIEW: ${await visitRes.text()}`);
  }
  console.log('   ✅ Website visit tracked successfully!');

  // 4. Submit same form 3 times to test deduplication & history
  console.log('\n⏳ 4. Submitting form 3 times with same email/phone...');
  
  const formPayloads = [
    {
      name: 'Deduplication Test Lead',
      email: 'dedup-verify@studymetro.com',
      phone: '+99999999999',
      country: 'United Kingdom',
      course: 'MSc Data Science',
      intake: 'September 2026'
    },
    {
      name: 'Deduplication Test Lead',
      email: 'dedup-verify@studymetro.com',
      phone: '+99999999999',
      country: 'Canada',
      course: 'MBA',
      intake: 'January 2027'
    },
    {
      name: 'Deduplication Test Lead',
      email: 'dedup-verify@studymetro.com',
      phone: '+99999999999',
      country: 'Australia',
      course: 'Information Technology',
      intake: 'February 2027'
    }
  ];

  for (let i = 0; i < formPayloads.length; i++) {
    console.log(`   Submitting Request #${i + 1}...`);
    const formRes = await fetch(`${API_URL}/api/v1/tracker/form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'studymetro-global' },
      body: JSON.stringify({
        visitorId,
        sessionId,
        formFields: formPayloads[i],
        url: 'http://localhost:3000/dashboard/tracker-test',
        referrer: 'http://google.com',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'winter_promo'
      })
    });
    if (!formRes.ok) {
      throw new Error(`Failed to ingest form request #${i + 1}: ${await formRes.text()}`);
    }
  }
  console.log('   ✅ All 3 form requests ingested successfully!');

  // 5. DB Verification
  console.log('\n⏳ 5. Verifying database records for deduplication & submission history...');
  
  // A. Check that only ONE lead was created for the email
  const leadsCount = await prisma.lead.count({
    where: { email: 'dedup-verify@studymetro.com', deletedAt: null }
  });

  const lead = await prisma.lead.findFirst({
    where: { email: 'dedup-verify@studymetro.com', deletedAt: null },
    include: { studentProfile: true, activities: true, submissions: { orderBy: { createdAt: 'desc' } } }
  });

  if (!lead) throw new Error('Lead not found in DB!');

  const leadChecks = {
    oneRecordOnly: leadsCount === 1,
    submissionCountIs3: lead.submissionCount === 3,
    profileMatchesLatest: lead.studentProfile?.targetCountry === 'Australia' &&
                          lead.studentProfile?.targetCourse === 'Information Technology' &&
                          lead.studentProfile?.intake === 'February 2027',
    hasThreeSubmissions: lead.submissions.length === 3,
    latestSubmissionIsFirst: lead.submissions[0].country === 'Australia' &&
                             lead.submissions[0].course === 'Information Technology' &&
                             lead.submissions[0].intake === 'February 2027',
    middleSubmissionIsSecond: lead.submissions[1].country === 'Canada' &&
                              lead.submissions[1].course === 'MBA' &&
                              lead.submissions[1].intake === 'January 2027',
    oldestSubmissionIsThird: lead.submissions[2].country === 'United Kingdom' &&
                             lead.submissions[2].course === 'MSc Data Science' &&
                             lead.submissions[2].intake === 'September 2026'
  };

  // Timeline check (activities and timeline API simulation)
  const activities = lead.activities.map(a => a.type);
  const timelineChecks = {
    leadCreatedLogged: activities.includes('LEAD_CREATED'),
    formSubmissionsLogged: lead.activities.filter(a => a.type === 'FORM_SUBMITTED').length === 3,
  };

  // Output Verification Table
  console.log('\n=============================================================');
  console.log('📊           CRM LEAD INGESTION VERIFICATION REPORT           ');
  console.log('=============================================================');
  printCheck('SDK script loaded on GET request', true);
  printCheck('Deduplication: Only ONE Lead Record in DB', leadChecks.oneRecordOnly);
  printCheck('Deduplication: Lead Submission Count = 3', leadChecks.submissionCountIs3);
  printCheck('Lead History: 3 LeadSubmission records created', leadChecks.hasThreeSubmissions);
  printCheck('Latest Profile matches latest form input', leadChecks.profileMatchesLatest);
  printCheck('Submission #3 matches latest submission values', leadChecks.latestSubmissionIsFirst);
  printCheck('Submission #2 matches second submission values', leadChecks.middleSubmissionIsSecond);
  printCheck('Submission #1 matches first submission values', leadChecks.oldestSubmissionIsThird);
  printCheck('Chronological form submissions tracked in activities', timelineChecks.formSubmissionsLogged);
  console.log('=============================================================');
  
  const allPassed = Object.values(leadChecks).every(Boolean) && 
                    Object.values(timelineChecks).every(Boolean);

  if (allPassed) {
    console.log('\n🏆 DEDUPLICATION VERIFICATION: ALL END-TO-END FLOW CHECKS PASSED!');
  } else {
    console.error('\n❌ DEDUPLICATION VERIFICATION: SOME CHECKS FAILED.', { leadChecks, timelineChecks });
    process.exit(1);
  }
}

function printCheck(description: string, status: boolean) {
  console.log(`[${status ? '✓ PASSED' : '✗ FAILED'}] ${description}`);
}

verify().catch(err => {
  console.error('\n💥 Unexpected error during verification:', err);
  process.exit(1);
});
