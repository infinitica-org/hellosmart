import { Controller, Get, HttpCode, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { Public } from '../decorators/public.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../constants/auth.constants.js';
import { problem } from '../errors/app-http.exception.js';
import { StorageService } from './storage.service.js';

@Controller('storage')
export class StorageController {
  constructor(
    @Inject(StorageService)
    private readonly storageService: StorageService,
  ) {}

  /**
   * Candidate submission artifact upload.
   * Consumes multipart/form-data with a 50MB streaming hard cap and magic bytes verification.
   */
  @Post('upload')
  @Roles('candidate')
  @HttpCode(201)
  async upload(
    @Req() req: FastifyRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Query('assignmentId') queryAssignmentId?: string,
  ) {
    if (!req.isMultipart()) {
      throw problem({
        status: 400,
        code: 'BAD_REQUEST',
        title: 'Bad Request',
        detail: 'Request must be multipart/form-data',
      });
    }

    const part = await req.file();
    if (!part) {
      throw problem({
        status: 400,
        code: 'BAD_REQUEST',
        title: 'Bad Request',
        detail: 'No file part found in multipart request',
      });
    }

    // Extract assignmentId from query or multipart field
    const fieldAssignmentId = (part.fields as any)?.assignmentId?.value;
    const assignmentId = (queryAssignmentId || fieldAssignmentId || '').trim();

    if (!assignmentId) {
      throw problem({
        status: 400,
        code: 'BAD_REQUEST',
        title: 'Bad Request',
        detail: 'assignmentId is required in query or form fields',
      });
    }

    return this.storageService.uploadArtifact({
      assignmentId,
      fileStream: part.file,
      filename: part.filename,
      mimeType: part.mimetype,
      user,
    });
  }

  /**
   * Generates a 900-second download URL for a submission artifact.
   * Allowed for company_admin (own org) and platform_admin (audited exception).
   * Candidate role is rejected with 403.
   */
  @Get('download-url/:assignmentId/:objectId')
  @Roles('company_admin', 'platform_admin')
  async getDownloadUrl(
    @Param('assignmentId') assignmentId: string,
    @Param('objectId') objectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('orgId') targetOrgId?: string,
  ) {
    if (!assignmentId || !objectId) {
      throw problem({
        status: 400,
        code: 'BAD_REQUEST',
        title: 'Bad Request',
        detail: 'assignmentId and objectId are required',
      });
    }

    return this.storageService.createDownloadUrl(assignmentId, objectId, user, targetOrgId);
  }

  /**
   * Public download streaming endpoint for local filesystem storage.
   * Verified using an HMAC-SHA256 signed token.
   * Access logs strip query params (split on '?'), so the token is never logged.
   */
  @Get('download')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async download(@Query('token') token: string, @Res() reply: FastifyReply) {
    if (!token) {
      throw problem({
        status: 404,
        code: 'NOT_FOUND',
        title: 'Not Found',
        detail: 'Artifact not found',
      });
    }

    let result;
    try {
      result = await this.storageService.getDownloadStream(token);
    } catch {
      throw problem({
        status: 404,
        code: 'NOT_FOUND',
        title: 'Not Found',
        detail: 'Artifact not found',
      });
    }

    reply.header('Content-Type', result.contentType || 'application/octet-stream');
    reply.header(
      'Content-Disposition',
      `attachment; filename="${result.filename || 'deliverable'}"`,
    );
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cache-Control', 'no-store');

    return reply.send(result.stream);
  }
}
