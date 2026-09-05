import { AppError, ErrorCode, repositoryIdParamsSchema } from "@ai-archaeologist/shared";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { completeChat, embedTexts } from "../ai/aiServiceClient.js";
import { recordAuditEvent } from "../audit/auditLog.js";
import type { ApiConfig } from "../config.js";
import { assertOrganizationRole } from "../auth/rbac.js";
import { asyncHandler } from "../http/asyncHandler.js";
import { loadRepositoryForOrganization } from "../repositories/repositoryAccess.js";
import { searchSimilarChunks } from "../search/vectorSearch.js";

const chatSessionParamsSchema = repositoryIdParamsSchema.extend({
  sessionId: z.string().uuid(),
});

const createSessionBodySchema = z.object({
  snapshotId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(180).optional(),
});

const createMessageBodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export function createChatRouter(prisma: PrismaClient, config: ApiConfig): Router {
  const router = Router();

  router.post(
    "/repositories/:repositoryId/chat/sessions",
    asyncHandler(async (request, response) => {
      const params = repositoryIdParamsSchema.parse(request.params);
      const body = createSessionBodySchema.parse(request.body);
      const repository = await loadRepositoryForOrganization(
        prisma,
        request.auth,
        params.repositoryId,
        "VIEWER",
      );

      const snapshot =
        body.snapshotId !== undefined
          ? await prisma.repositorySnapshot.findFirst({
              where: {
                id: body.snapshotId,
                repositoryId: repository.id,
              },
            })
          : await prisma.repositorySnapshot.findFirst({
              orderBy: { createdAt: "desc" },
              where: { repositoryId: repository.id },
            });

      if (!snapshot) {
        throw new AppError({
          code: ErrorCode.InvalidInput,
          message: "A repository snapshot is required before chat can start.",
          statusCode: 400,
        });
      }

      const session = await prisma.chatSession.create({
        data: {
          organizationId: repository.organizationId,
          repositoryId: repository.id,
          title: body.title ?? `${repository.name} chat`,
        },
      });

      await recordAuditEvent(prisma, request, {
        action: "chat.session.create",
        organizationId: repository.organizationId,
        resourceId: session.id,
        resourceType: "ChatSession",
        userId: request.auth?.user.id,
      });

      response.status(201).json({ session, snapshotId: snapshot.id });
    }),
  );

  router.post(
    "/repositories/:repositoryId/chat/sessions/:sessionId/messages",
    asyncHandler(async (request, response) => {
      const params = chatSessionParamsSchema.parse(request.params);
      const body = createMessageBodySchema.parse(request.body);
      const repository = await loadRepositoryForOrganization(
        prisma,
        request.auth,
        params.repositoryId,
        "VIEWER",
      );
      assertOrganizationRole(request.auth, repository.organizationId, "VIEWER");

      const session = await prisma.chatSession.findFirst({
        where: {
          id: params.sessionId,
          organizationId: repository.organizationId,
          repositoryId: repository.id,
        },
      });

      if (!session) {
        throw new AppError({
          code: ErrorCode.NotFound,
          message: "Chat session was not found.",
          statusCode: 404,
        });
      }

      const snapshot = await prisma.repositorySnapshot.findFirst({
        orderBy: { createdAt: "desc" },
        where: { repositoryId: repository.id },
      });

      if (!snapshot) {
        throw new AppError({
          code: ErrorCode.InvalidInput,
          message: "No snapshot is available for chat retrieval.",
          statusCode: 400,
        });
      }

      const userMessage = await prisma.chatMessage.create({
        data: {
          content: body.content,
          organizationId: repository.organizationId,
          role: "USER",
          sessionId: session.id,
          ...(request.auth?.user.id ? { userId: request.auth.user.id } : {}),
        },
      });

      const [queryEmbeddings, recentChunks] = await Promise.all([
        embedTexts(config, [body.content]),
        prisma.codeChunk.findMany({
          include: {
            fileNode: {
              select: {
                path: true,
              },
            },
          },
          orderBy: {
            startLine: "asc",
          },
          take: 6,
          where: {
            repositoryId: repository.id,
            snapshotId: snapshot.id,
          },
        }),
      ]);

      const retrieved =
        queryEmbeddings[0] !== undefined
          ? await searchSimilarChunks(prisma, snapshot.id, queryEmbeddings[0], 8)
          : [];

      const contextChunks =
        retrieved.length > 0
          ? retrieved.map((chunk) => ({
              endLine: chunk.endLine,
              path: chunk.path,
              startLine: chunk.startLine,
              text: chunk.text,
            }))
          : recentChunks.map((chunk) => ({
              endLine: chunk.endLine,
              path: chunk.fileNode.path,
              startLine: chunk.startLine,
              text: chunk.text,
            }));

      const completion = await completeChat(config, {
        contextChunks,
        question: body.content,
        repositoryName: repository.name,
      });

      const assistantMessage = await prisma.chatMessage.create({
        data: {
          content: completion.answer,
          modelMetadata: {
            completionTokens: completion.completionTokens,
            model: completion.model,
            promptTokens: completion.promptTokens,
          },
          organizationId: repository.organizationId,
          provenance: {
            chunkPaths: contextChunks.map((chunk) => chunk.path),
          },
          role: "ASSISTANT",
          sessionId: session.id,
        },
      });

      response.status(201).json({
        assistantMessage,
        retrievedChunkCount: contextChunks.length,
        userMessage,
      });
    }),
  );

  return router;
}
