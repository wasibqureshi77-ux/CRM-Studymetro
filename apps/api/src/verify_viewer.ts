import { PrismaService } from './prisma/prisma.service';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaService();

async function createRealPdf() {
  console.log('📄 Programmatically generating a real 3-page PDF using pdf-lib...');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= 3; i++) {
    const page = pdfDoc.addPage([600, 800]);
    page.drawText(`Study Metro International - Official Page ${i}`, {
      x: 50,
      y: 700,
      size: 24,
      font,
      color: rgb(0.1, 0.3, 0.8),
    });
    page.drawText(`This is the actual page content of page ${i} of our official brochure.`, {
      x: 50,
      y: 640,
      size: 14,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const uploadDir = path.resolve(process.cwd(), 'uploads', 'brochures');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `real-brochure-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, pdfBytes);
  console.log(`✓ Real PDF saved to: ${filePath}`);

  // Create Brochure Record in DB
  const brochure = await prisma.brochure.create({
    data: {
      title: 'Study Metro Official Course Guide',
      category: 'STUDY_ABROAD',
      filePath: `brochures/${filename}`,
      totalPages: 3,
      isActive: true,
    },
  });
  console.log(`✓ Brochure record created in DB. ID: ${brochure.id}`);

  // Find or create test lead
  let lead = await prisma.lead.findFirst({
    where: { email: 'viewer-audit@studymetrojaipur.com' },
  });
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        tenantId: 'studymetro-global',
        firstName: 'Viewer',
        lastName: 'Auditor',
        email: 'viewer-audit@studymetrojaipur.com',
        phone: '9998887770',
        leadCategory: 'STUDY_ABROAD',
        status: 'NEW_LEAD',
      },
    });
  }

  // Assign Brochure
  const token = `verify_${Date.now()}`;
  const assignment = await prisma.brochureAssignment.create({
    data: {
      leadId: lead.id,
      brochureId: brochure.id,
      token,
      tracking: {
        create: {
          opened: false,
          readingTime: 0,
          pageViews: 0,
          completionPercentage: 0,
          lastPageViewed: 0,
          downloadCount: 0,
          viewedPages: '',
          engagementScore: 0,
        },
      },
    },
  });

  console.log(`✓ Brochure assigned successfully!`);
  console.log(`\n👉 Viewer URL: http://localhost:3000/brochure/view/${token}`);
  console.log(`👉 Physical path: ${filePath}\n`);
}

createRealPdf()
  .catch((err) => {
    console.error('Failed to create real PDF:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.onModuleDestroy();
  });
