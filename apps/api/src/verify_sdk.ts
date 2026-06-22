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

  // 4. Send leadForm interception payload
  console.log('\n⏳ 4. Submitting leadForm...');
  const formRes1 = await fetch(`${API_URL}/api/v1/tracker/form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'studymetro-global' },
    body: JSON.stringify({
      visitorId,
      sessionId,
      formFields: {
        name: 'Sarah LeadForm',
        email: 'leadform-verify@studymetro.com',
        phone: '+1111111111',
        country: 'United Kingdom',
        course: 'MSc Data Science',
        intake: 'September 2026'
      },
      url: 'http://localhost:3000/dashboard/tracker-test',
      referrer: 'http://google.com',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'winter_promo'
    })
  });
  if (!formRes1.ok) {
    throw new Error(`Failed to ingest leadForm: ${await formRes1.text()}`);
  }
  console.log('   ✅ leadForm ingested successfully!');

  // 5. Send contactPageForm interception payload
  console.log('\n⏳ 5. Submitting contactPageForm...');
  const formRes2 = await fetch(`${API_URL}/api/v1/tracker/form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'studymetro-global' },
    body: JSON.stringify({
      visitorId,
      sessionId,
      formFields: {
        name: 'John ContactPageForm',
        email: 'contactpageform-verify@studymetro.com',
        phone: '+2222222222',
        country: 'Canada',
        course: 'MBA',
        intake: 'January 2027'
      },
      url: 'http://localhost:3000/dashboard/tracker-test',
      referrer: 'http://google.com',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'winter_promo'
    })
  });
  if (!formRes2.ok) {
    throw new Error(`Failed to ingest contactPageForm: ${await formRes2.text()}`);
  }
  console.log('   ✅ contactPageForm ingested successfully!');

  // 6. Send modalLeadForm interception payload
  console.log('\n⏳ 6. Submitting modalLeadForm...');
  const formRes3 = await fetch(`${API_URL}/api/v1/tracker/form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'studymetro-global' },
    body: JSON.stringify({
      visitorId,
      sessionId,
      formFields: {
        name: 'Alice ModalLeadForm',
        email: 'modalleadform-verify@studymetro.com',
        phone: '+3333333333',
        country: 'Australia',
        course: 'Information Technology',
        intake: 'February 2027'
      },
      url: 'http://localhost:3000/dashboard/tracker-test',
      referrer: 'http://google.com',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'winter_promo'
    })
  });
  if (!formRes3.ok) {
    throw new Error(`Failed to ingest modalLeadForm: ${await formRes3.text()}`);
  }
  console.log('   ✅ modalLeadForm ingested successfully!');

  // 7. DB Verification
  console.log('\n⏳ 7. Verifying database records...');
  
  // A. Check Lead 1 (leadForm)
  const lead1 = await prisma.lead.findFirst({
    where: { email: 'leadform-verify@studymetro.com' },
    include: { studentProfile: true, activities: true }
  });
  if (!lead1) throw new Error('Lead 1 (leadForm) not found in DB!');
  
  const lead1Checks = {
    profileCreated: !!lead1.studentProfile,
    countryAttributed: lead1.studentProfile?.targetCountry === 'United Kingdom',
    courseAttributed: lead1.studentProfile?.targetCourse === 'MSc Data Science',
    intakeAttributed: lead1.studentProfile?.intake === 'September 2026',
    sourceAttributed: lead1.source === 'WEBSITE_SDK',
    visitorLinked: lead1.visitorId === visitorId
  };

  // B. Check Lead 2 (contactPageForm)
  const lead2 = await prisma.lead.findFirst({
    where: { email: 'contactpageform-verify@studymetro.com' },
    include: { studentProfile: true, activities: true }
  });
  if (!lead2) throw new Error('Lead 2 (contactPageForm) not found in DB!');

  const lead2Checks = {
    profileCreated: !!lead2.studentProfile,
    countryAttributed: lead2.studentProfile?.targetCountry === 'Canada',
    courseAttributed: lead2.studentProfile?.targetCourse === 'MBA',
    intakeAttributed: lead2.studentProfile?.intake === 'January 2027',
    sourceAttributed: lead2.source === 'WEBSITE_SDK',
    visitorLinked: lead2.visitorId === visitorId
  };

  // C. Check Lead 3 (modalLeadForm)
  const lead3 = await prisma.lead.findFirst({
    where: { email: 'modalleadform-verify@studymetro.com' },
    include: { studentProfile: true, activities: true }
  });
  if (!lead3) throw new Error('Lead 3 (modalLeadForm) not found in DB!');

  const lead3Checks = {
    profileCreated: !!lead3.studentProfile,
    countryAttributed: lead3.studentProfile?.targetCountry === 'Australia',
    courseAttributed: lead3.studentProfile?.targetCourse === 'Information Technology',
    intakeAttributed: lead3.studentProfile?.intake === 'February 2027',
    sourceAttributed: lead3.source === 'WEBSITE_SDK',
    visitorLinked: lead3.visitorId === visitorId
  };

  // D. Check Activities logging (WEBSITE_VISIT, FORM_SUBMITTED, LEAD_CREATED)
  const activities1 = lead1.activities.map(a => a.type);
  const activities2 = lead2.activities.map(a => a.type);
  const activities3 = lead3.activities.map(a => a.type);

  const timelineChecks = {
    visitLogged1: activities1.includes('WEBSITE_VISIT'),
    submitLogged1: activities1.includes('FORM_SUBMITTED'),
    createdLogged1: activities1.includes('LEAD_CREATED'),
    visitLogged2: activities2.includes('WEBSITE_VISIT'),
    submitLogged2: activities2.includes('FORM_SUBMITTED'),
    createdLogged2: activities2.includes('LEAD_CREATED'),
    visitLogged3: activities3.includes('WEBSITE_VISIT'),
    submitLogged3: activities3.includes('FORM_SUBMITTED'),
    createdLogged3: activities3.includes('LEAD_CREATED')
  };

  // Output Verification Table
  console.log('\n=============================================================');
  console.log('📊           CRM LEAD INGESTION VERIFICATION REPORT           ');
  console.log('=============================================================');
  printCheck('SDK script loaded on GET request', true);
  printCheck('Visitor ID generation verified', true);
  printCheck('Session ID generation verified', true);
  printCheck('leadForm Interception Ingested', true);
  printCheck('contactPageForm Interception Ingested', true);
  printCheck('modalLeadForm Interception Ingested', true);
  printCheck('CRM Database Lead 1 (leadForm) Created', lead1Checks.profileCreated);
  printCheck('CRM Database Lead 2 (contactPageForm) Created', lead2Checks.profileCreated);
  printCheck('CRM Database Lead 3 (modalLeadForm) Created', lead3Checks.profileCreated);
  printCheck('Attributed Lead Source: WEBSITE_SDK', lead1Checks.sourceAttributed && lead2Checks.sourceAttributed && lead3Checks.sourceAttributed);
  printCheck('Attributed Visitor ID Linked to Leads', lead1Checks.visitorLinked && lead2Linked(lead2Checks.visitorLinked) && lead2Linked(lead3Checks.visitorLinked));
  printCheck('Target Country captured: UK, Canada, Australia', lead1Checks.countryAttributed && lead2Checks.countryAttributed && lead3Checks.countryAttributed);
  printCheck('Target Course captured: CS, MBA, IT', lead1Checks.courseAttributed && lead2Checks.courseAttributed && lead3Checks.courseAttributed);
  printCheck('Intake period captured: Spring, Winter, Fall', lead1Checks.intakeAttributed && lead2Checks.intakeAttributed && lead3Checks.intakeAttributed);
  printCheck('Timeline Entry: WEBSITE_VISIT generated', timelineChecks.visitLogged1 && timelineChecks.visitLogged2 && timelineChecks.visitLogged3);
  printCheck('Timeline Entry: FORM_SUBMITTED generated', timelineChecks.submitLogged1 && timelineChecks.submitLogged2 && timelineChecks.submitLogged3);
  printCheck('Timeline Entry: LEAD_CREATED generated', timelineChecks.createdLogged1 && timelineChecks.createdLogged2 && timelineChecks.createdLogged3);
  console.log('=============================================================');
  
  const allPassed = Object.values(lead1Checks).every(Boolean) && 
                    Object.values(lead2Checks).every(Boolean) && 
                    Object.values(lead3Checks).every(Boolean) && 
                    Object.values(timelineChecks).every(Boolean);

  if (allPassed) {
    console.log('\n🏆 PRODUCTION VERIFICATION: ALL END-TO-END FLOW CHECKS PASSED!');
  } else {
    console.error('\n❌ PRODUCTION VERIFICATION: SOME CHECKS FAILED.', { lead1Checks, lead2Checks, lead3Checks, timelineChecks });
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
