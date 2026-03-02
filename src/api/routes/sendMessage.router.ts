import { RouterBroker } from '@api/abstract/abstract.router';
import {
  SendAudioDto,
  SendButtonsDto,
  SendContactDto,
  SendListDto,
  SendLocationDto,
  SendMediaDto,
  SendPollDto,
  SendPtvDto,
  SendReactionDto,
  SendStatusDto,
  SendStickerDto,
  SendTemplateDto,
  SendTextDto,
} from '@api/dto/sendMessage.dto';
import { sendMessageController } from '@api/server.module';
import {
  audioMessageSchema,
  buttonsMessageSchema,
  contactMessageSchema,
  listMessageSchema,
  locationMessageSchema,
  mediaMessageSchema,
  pollMessageSchema,
  ptvMessageSchema,
  reactionMessageSchema,
  statusMessageSchema,
  stickerMessageSchema,
  templateMessageSchema,
  textMessageSchema,
} from '@validate/validate.schema';
import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import multer from 'multer';

import { HttpStatus } from './index.router';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function messageSendRateLimit(req: Request, res: Response, next: NextFunction): void {
  const instanceName = req.params.instanceName ?? 'unknown';
  const now = Date.now();
  const entry = rateLimitStore.get(instanceName);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(instanceName, { count: 1, windowStart: now });
    return next();
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      status: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded: max ${RATE_LIMIT_MAX} messages per minute per instance.`,
      retryAfterSeconds: retryAfter,
    });
    return;
  }

  entry.count++;
  return next();
}

const upload = multer({ storage: multer.memoryStorage() });

export class MessageRouter extends RouterBroker {
  constructor(...guards: RequestHandler[]) {
    super();
    this.router
      .post(this.routerPath('sendTemplate'), ...guards, messageSendRateLimit, async (req, res) => {
        const response = await this.dataValidate<SendTemplateDto>({
          request: req,
          schema: templateMessageSchema,
          ClassRef: SendTemplateDto,
          execute: (instance, data) => sendMessageController.sendTemplate(instance, data),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .post(this.routerPath('sendText'), ...guards, messageSendRateLimit, async (req, res) => {
        const response = await this.dataValidate<SendTextDto>({
          request: req,
          schema: textMessageSchema,
          ClassRef: SendTextDto,
          execute: (instance, data) => sendMessageController.sendText(instance, data),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .post(this.routerPath('sendMedia'), ...guards, messageSendRateLimit, upload.single('file'), async (req, res) => {
        const bodyData = req.body;

        const response = await this.dataValidate<SendMediaDto>({
          request: req,
          schema: mediaMessageSchema,
          ClassRef: SendMediaDto,
          execute: (instance) => sendMessageController.sendMedia(instance, bodyData, req.file as any),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .post(this.routerPath('sendPtv'), ...guards, messageSendRateLimit, upload.single('file'), async (req, res) => {
        const bodyData = req.body;

        const response = await this.dataValidate<SendPtvDto>({
          request: req,
          schema: ptvMessageSchema,
          ClassRef: SendPtvDto,
          execute: (instance) => sendMessageController.sendPtv(instance, bodyData, req.file as any),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .post(
        this.routerPath('sendWhatsAppAudio'),
        ...guards,
        messageSendRateLimit,
        upload.single('file'),
        async (req, res) => {
          const bodyData = req.body;

          const response = await this.dataValidate<SendAudioDto>({
            request: req,
            schema: audioMessageSchema,
            ClassRef: SendMediaDto,
            execute: (instance) => sendMessageController.sendWhatsAppAudio(instance, bodyData, req.file as any),
          });

          return res.status(HttpStatus.CREATED).json(response);
        },
      )
      // TODO: Revisar funcionamento do envio de Status
      .post(this.routerPath('sendStatus'), ...guards, messageSendRateLimit, upload.single('file'), async (req, res) => {
        const bodyData = req.body;

        const response = await this.dataValidate<SendStatusDto>({
          request: req,
          schema: statusMessageSchema,
          ClassRef: SendStatusDto,
          execute: (instance) => sendMessageController.sendStatus(instance, bodyData, req.file as any),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .post(
        this.routerPath('sendSticker'),
        ...guards,
        messageSendRateLimit,
        upload.single('file'),
        async (req, res) => {
          const bodyData = req.body;

          const response = await this.dataValidate<SendStickerDto>({
            request: req,
            schema: stickerMessageSchema,
            ClassRef: SendStickerDto,
            execute: (instance) => sendMessageController.sendSticker(instance, bodyData, req.file as any),
          });

          return res.status(HttpStatus.CREATED).json(response);
        },
      )
      .post(this.routerPath('sendLocation'), ...guards, messageSendRateLimit, async (req, res) => {
        const response = await this.dataValidate<SendLocationDto>({
          request: req,
          schema: locationMessageSchema,
          ClassRef: SendLocationDto,
          execute: (instance, data) => sendMessageController.sendLocation(instance, data),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .post(this.routerPath('sendContact'), ...guards, messageSendRateLimit, async (req, res) => {
        const response = await this.dataValidate<SendContactDto>({
          request: req,
          schema: contactMessageSchema,
          ClassRef: SendContactDto,
          execute: (instance, data) => sendMessageController.sendContact(instance, data),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .post(this.routerPath('sendReaction'), ...guards, messageSendRateLimit, async (req, res) => {
        const response = await this.dataValidate<SendReactionDto>({
          request: req,
          schema: reactionMessageSchema,
          ClassRef: SendReactionDto,
          execute: (instance, data) => sendMessageController.sendReaction(instance, data),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .post(this.routerPath('sendPoll'), ...guards, messageSendRateLimit, async (req, res) => {
        const response = await this.dataValidate<SendPollDto>({
          request: req,
          schema: pollMessageSchema,
          ClassRef: SendPollDto,
          execute: (instance, data) => sendMessageController.sendPoll(instance, data),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .post(this.routerPath('sendList'), ...guards, messageSendRateLimit, async (req, res) => {
        const response = await this.dataValidate<SendListDto>({
          request: req,
          schema: listMessageSchema,
          ClassRef: SendListDto,
          execute: (instance, data) => sendMessageController.sendList(instance, data),
        });

        return res.status(HttpStatus.CREATED).json(response);
      })
      .post(this.routerPath('sendButtons'), ...guards, messageSendRateLimit, async (req, res) => {
        const response = await this.dataValidate<SendButtonsDto>({
          request: req,
          schema: buttonsMessageSchema,
          ClassRef: SendButtonsDto,
          execute: (instance, data) => sendMessageController.sendButtons(instance, data),
        });

        return res.status(HttpStatus.CREATED).json(response);
      });
  }

  public readonly router: Router = Router();
}
