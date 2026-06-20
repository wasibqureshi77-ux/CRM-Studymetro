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
    interceptionKeywords: sdkJs.includes('matchesContact') && sdkJs.includes('matchesConsult') && sdkJs.includes('matchesAdmission'),
    metroCaptureAttr: sdkJs.includes('data-metro-capture'),
    targetFields: sdkJs.includes('country') && sdkJs.includes('course') && sdkJs.includes('intake'),
    utmAndReferrer: sdkJs.includes('utmSource') && sdkJs.includes('referrer')
  };
  
  if (checks.interceptionKeywords && checks.metroCaptureAttr && checks.targetFields && checks.utmAndReferrer) {
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

  // 4. Send Contact Form interception payload
  console.log('\n⏳ 4. Submitting Contact Form (interception simulation)...');
  const formRes1 = await fetch(`${API_URL}/api/v1/tracker/form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'studymetro-global' },
    body: JSON.stringify({
      visitorId,
      sessionId,
      formFields: {
        name: 'James Verify Contact',
        email: 'contact-verify@studymetro.com',
        phone: '+61499888777',
        country: 'Australia',
        course: 'Bachelor of IT',
        intake: 'Spring 2027'
      },
      url: 'http://localhost:3000/dashboard/tracker-test',
      referrer: 'http://google.com',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'winter_promo'
    })
  });
  if (!formRes1.ok) {
    throw new Error(`Failed to ingest form 1: ${await formRes1.text()}`);
  }
  console.log('   ✅ Contact Form ingested successfully!');

  // 5. Send data-metro-capture form interception payload
  console.log('\n⏳ 5. Submitting data-metro-capture Form (interception simulation)...');
  const formRes2 = await fetch(`${API_URL}/api/v1/tracker/form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'studymetro-global' },
    body: JSON.stringify({
      visitorId,
      sessionId,
      formFields: {
        name: 'Sophia Verify Custom',
        email: 'custom-verify@studymetro.com',
        phone: '+18887776655',
        country: 'United States',
        course: 'MS Data Science',
        intake: 'Fall 2026'
      },
      url: 'http://localhost:3000/dashboard/tracker-test',
      referrer: 'http://google.com',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'winter_promo'
    })
  });
  if (!formRes2.ok) {
    throw new Error(`Failed to ingest form 2: ${await formRes2.text()}`);
  }
  console.log('   ✅ data-metro-capture Form ingested successfully!');

  // 6. DB Verification
  console.log('\n⏳ 6. Verifying database records...');
  
  // A. Check Lead 1
  const lead1 = await prisma.lead.findFirst({
    where: { email: 'contact-verify@studymetro.com' },
    include: { studentProfile: true, activities: true }
  });
  if (!lead1) throw new Error('Lead 1 not found in DB!');
  
  const lead1Checks = {
    profileCreated: !!lead1.studentProfile,
    countryAttributed: lead1.studentProfile?.targetCountry === 'Australia',
    courseAttributed: lead1.studentProfile?.targetCourse === 'Bachelor of IT',
    intakeAttributed: lead1.studentProfile?.intake === 'Spring 2027',
    sourceAttributed: lead1.source === 'WEBSITE_SDK',
    visitorLinked: lead1.visitorId === visitorId
  };

  // B. Check Lead 2
  const lead2 = await prisma.lead.findFirst({
    where: { email: 'custom-verify@studymetro.com' },
    include: { studentProfile: true, activities: true }
  });
  if (!lead2) throw new Error('Lead 2 not found in DB!');

  const lead2Checks = {
    profileCreated: !!lead2.studentProfile,
    countryAttributed: lead2.studentProfile?.targetCountry === 'United States',
    courseAttributed: lead2.studentProfile?.targetCourse === 'MS Data Science',
    intakeAttributed: lead2.studentProfile?.intake === 'Fall 2026',
    sourceAttributed: lead2.source === 'WEBSITE_SDK',
    visitorLinked: lead2.visitorId === visitorId
  };

  // C. Check Activities logging (WEBSITE_VISIT, FORM_SUBMITTED, LEAD_CREATED)
  const activities1 = lead1.activities.map(a => a.type);
  const activities2 = lead2.activities.map(a => a.type);

  const timelineChecks = {
    visitLogged1: activities1.includes('WEBSITE_VISIT'),
    submitLogged1: activities1.includes('FORM_SUBMITTED'),
    createdLogged1: activities1.includes('LEAD_CREATED'),
    visitLogged2: activities2.includes('WEBSITE_VISIT'),
    submitLogged2: activities2.includes('FORM_SUBMITTED'),
    createdLogged2: activities2.includes('LEAD_CREATED')
  };

  // Output Verification Table
  console.log('\n=============================================================');
  console.log('📊           CRM LEAD INGESTION VERIFICATION REPORT           ');
  console.log('=============================================================');
  printCheck('SDK script loaded on GET request', true);
  printCheck('Visitor ID generation verified', true);
  printCheck('Session ID generation verified', true);
  printCheck('Contact Form Interception Ingested', true);
  printCheck('data-metro-capture Form Interception Ingested', true);
  printCheck('CRM Database Lead 1 Record Created', lead1Checks.profileCreated);
  printCheck('CRM Database Lead 2 Record Created', lead2Checks.profileCreated);
  printCheck('Attributed Lead Source: WEBSITE_SDK', lead1Checks.sourceAttributed && lead2Checks.sourceAttributed);
  printCheck('Attributed Visitor ID Linked to Leads', lead1Checks.visitorLinked && lead2Linked(lead2Checks.visitorLinked));
  printCheck('Target Country captured: Australia & United States', lead1Checks.countryAttributed && lead2Checks.countryAttributed);
  printCheck('Target Course captured: Bachelor of IT & MS Data Science', lead1Checks.courseAttributed && lead2Checks.courseAttributed);
  printCheck('Intake period captured: Spring 2027 & Fall 2026', lead1Checks.intakeAttributed && lead2Checks.intakeAttributed);
  printCheck('Timeline Entry: WEBSITE_VISIT generated', timelineChecks.visitLogged1 && timelineChecks.visitLogged2);
  printCheck('Timeline Entry: FORM_SUBMITTED generated', timelineChecks.submitLogged1 && timelineChecks.submitLogged2);
  printCheck('Timeline Entry: LEAD_CREATED generated', timelineChecks.createdLogged1 && timelineChecks.createdLogged2);
  console.log('=============================================================');
  
  const allPassed = Object.values(lead1Checks).every(Boolean) && 
                    Object.values(lead2Checks).every(Boolean) && 
                    Object.values(timelineChecks).every(Boolean);

  if (allPassed) {
    console.log('\n🏆 PRODUCTION VERIFICATION: ALL END-TO-END FLOW CHECKS PASSED!');
  } else {
    console.error('\n❌ PRODUCTION VERIFICATION: SOME CHECKS FAILED.', { lead1Checks, lead2Checks, timelineChecks });
    process.exit(1);
  }
}

function lead2Linked(val: any) {
  return !!val;
}

function printCheck(description: string, status: boolean) {
  console.log(`[${status ? '✓ PASSED' : '✗ FAILED'}] ${description}`);
}

verify().catch(err => {
  console.error('\n💥 Unexpected error during verification:', err);
  process.exit(1);
});
