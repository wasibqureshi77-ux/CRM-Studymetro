import { LeadCategory } from '@prisma/client';

export interface DocumentTemplateItem {
  type: string;
  isRequired: boolean;
  expiryDays?: number; // Optional default expiry tracking config
}

export const DocumentTemplates: Record<LeadCategory, DocumentTemplateItem[]> = {
  STUDY_ABROAD: [
    { type: 'Passport', isRequired: true },
    { type: '10th Marksheet', isRequired: true },
    { type: '12th Marksheet', isRequired: true },
    { type: 'Graduation', isRequired: true },
    { type: 'IELTS', isRequired: true },
    { type: 'PTE', isRequired: false },
    { type: 'SOP', isRequired: true },
    { type: 'LOR', isRequired: true },
    { type: 'CV', isRequired: true },
    { type: 'Offer Letter', isRequired: true },
    { type: 'Visa', isRequired: true },
  ],
  IELTS: [
    { type: 'ID Proof', isRequired: true },
    { type: 'Passport', isRequired: true },
    { type: 'Previous IELTS Score', isRequired: true },
  ],
  PTE: [
    { type: 'ID Proof', isRequired: true },
    { type: 'Passport', isRequired: true },
    { type: 'Previous PTE Score', isRequired: true },
  ],
  ENGLISH_SPEAKING: [
    { type: 'ID Proof', isRequired: true },
    { type: 'Photo', isRequired: true },
  ],
  COMPUTER_COURSE: [
    { type: 'ID Proof', isRequired: true },
    { type: 'Photo', isRequired: true },
    { type: 'Qualification Certificate', isRequired: true },
  ],
  DIGITAL_MARKETING: [
    { type: 'ID Proof', isRequired: true },
    { type: 'Photo', isRequired: true },
    { type: 'Qualification Certificate', isRequired: true },
  ],
  OTHER: [
    { type: 'ID Proof', isRequired: true },
    { type: 'Photo', isRequired: true },
  ],
};
