import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { AnalyticsService } from './analytics.service';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly exportService: ExportService
  ) {}

  @Permissions('leads:read')
  @Get('summary')
  async getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getSummary(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('lead-sources')
  async getLeadSources(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getLeadSources(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('categories')
  async getCategories(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getCategories(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('countries')
  async getCountries(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getCountries(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('followups')
  async getFollowups(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getFollowups(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('documents')
  async getDocuments(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getDocuments(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('communications')
  async getCommunications(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getCommunications(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('brochures')
  async getBrochures(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getBrochures(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('funnel')
  async getFunnel(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getFunnel(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('revenue')
  async getRevenue(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getRevenue(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('counsellors')
  async getCounsellors(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getCounsellors(startDate, endDate);
  }

  @Permissions('leads:read')
  @Get('lead-aging')
  async getLeadAging(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.analyticsService.getLeadAging(startDate, endDate);
  }

  // ================= EXPORTS ENGINE =================

  @Permissions('leads:read')
  @Post('exports/:reportType')
  async exportReport(
    @Param('reportType') reportType: string,
    @Body() body: { format: 'csv' | 'excel' | 'pdf'; startDate?: string; endDate?: string }
  ) {
    const { format, startDate, endDate } = body;
    if (!format || !['csv', 'excel', 'pdf'].includes(format)) {
      throw new BadRequestException('Invalid format type. Must be csv, excel, or pdf.');
    }

    let title = 'StudyMetro Operational Report';
    let headers: string[] = [];
    let rows: any[][] = [];

    // Compile rows based on reportType
    if (reportType === 'lead-sources') {
      title = 'Lead Sources Analytics Report';
      headers = ['Source', 'Lead Count', 'Conversion Rate %', 'Trend'];
      const data = await this.analyticsService.getLeadSources(startDate, endDate);
      rows = data.map(item => [item.source, item.count, `${item.conversionRate}%`, item.trend]);
    } else if (reportType === 'categories') {
      title = 'Program Categories Analytics Report';
      headers = ['Category', 'Lead Count', 'Conversion Rate %', 'Revenue-Ready Leads'];
      const data = await this.analyticsService.getCategories(startDate, endDate);
      rows = data.map(item => [item.category, item.count, `${item.conversionRate}%`, item.revenueReadyLeads]);
    } else if (reportType === 'countries') {
      title = 'Country Distribution Analytics Report';
      headers = ['Country', 'Interested Count', 'Applications', 'Offers', 'Visas'];
      const data = await this.analyticsService.getCountries(startDate, endDate);
      rows = data.map(item => [item.country, item.totalInterested, item.applications, item.offers, item.visas]);
    } else if (reportType === 'counsellors') {
      title = 'Counsellor Performance Analytics Report';
      headers = ['Counsellor Name', 'Assigned Leads', 'Active Leads', 'Converted Leads', 'Applications', 'Offers', 'Visas', 'Conversion %'];
      const data = await this.analyticsService.getCounsellors(startDate, endDate);
      rows = data.map(item => [
        item.name,
        item.assignedLeads,
        item.activeLeads,
        item.convertedLeads,
        item.applicationsSubmitted,
        item.offerLetters,
        item.visaApproved,
        `${item.conversionRate}%`
      ]);
    } else if (reportType === 'lead-aging') {
      title = 'Lead Aging Report';
      headers = ['Age Range Bucket', 'Lead Count', 'Pending Followups', 'Overdue Followups'];
      const data = await this.analyticsService.getLeadAging(startDate, endDate);
      rows = data.map(item => [item.range, item.count, item.pending, item.overdue]);
    } else if (reportType === 'revenue') {
      title = 'Revenue Analytics Report';
      headers = ['Source Stream', 'Revenue (INR)'];
      const data = await this.analyticsService.getRevenue(startDate, endDate);
      rows = [
        ['Total Estimated Revenue', data.totalRevenue],
        ['Study Abroad Revenue', data.studyAbroadRevenue],
        ['IELTS Training Revenue', data.ieltsRevenue],
        ['PTE Training Revenue', data.pteRevenue],
        ['Computer Courses Revenue', data.computerCourseRevenue],
        ['Digital Marketing Revenue', data.digitalMarketingRevenue],
        ['Other Category Revenue', data.otherRevenue],
      ];
    } else {
      // Default fallback using general summary
      title = 'General Executive Summary Report';
      headers = ['Executive Metric KPI', 'Value Count / Total'];
      const data = await this.analyticsService.getSummary(startDate, endDate);
      rows = [
        ['Total Leads Ingested', data.totalLeads],
        ['Active Pipeline Leads', data.activeLeads],
        ['Converted Leads (Admissions Closed/Completed)', data.convertedLeads],
        ['Applications Submitted to Universities', data.applications],
        ['Visas Approved', data.visaApproved],
        ['Documents Pending Verification', data.documentsPending],
        ['Follow-ups Due Today', data.followupsDueToday],
        ['Transactional Emails Sent', data.emailsSent],
        ['Program Brochures Dispatched', data.brochuresSent]
      ];
    }

    const filename = await this.exportService.createExportFile(reportType, format, title, headers, rows);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return {
      downloadUrl: `${apiBase}/api/v1/analytics/exports/download/${filename}`
    };
  }

  @Get('exports/download/:filename')
  async downloadExportFile(
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    const filePath = this.exportService.getFilePath(filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Export file not found or has expired.');
    }

    const ext = filename.split('.').pop();
    if (ext === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else if (ext === 'xml') {
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="${filename.replace('.xml', '.xls')}"`);
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
