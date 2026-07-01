import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { encryptSession, decryptSession } from '../utils/crypto.helper';
import { WhatsappWebSocketGateway } from '../websocket/whatsapp.websocket';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  ConnectionState,
  AuthenticationState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class WhatsappGatewayService implements OnModuleInit, OnModuleDestroy {
  private activeSockets = new Map<string, any>();
  public qrStore = new Map<string, string>();
  private readonly logger = new Logger(WhatsappGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wsGateway: WhatsappWebSocketGateway
  ) {}

  async onModuleInit() {
    // Automatically restore active sessions on boot
    this.logger.log('Restoring active WhatsApp sessions on boot...');
    await this.restoreSessions();
  }

  async onModuleDestroy() {
    for (const [instanceId, sock] of this.activeSockets.entries()) {
      try {
        sock.ev.removeAllListeners('connection.update');
        sock.ev.removeAllListeners('creds.update');
        sock.logout();
      } catch (err) {
        this.logger.error(`Error closing socket ${instanceId}: ${err.message}`);
      }
    }
  }

  private async restoreSessions() {
    const instances = await this.prisma.whatsappInstance.findMany({
      where: {
        status: { in: ['CONNECTED', 'CONNECTING', 'QR_PENDING'] },
      },
    });

    for (const inst of instances) {
      if (inst.sessionEncrypted) {
        this.logger.log(`Restoring session for instance: ${inst.instanceName} (${inst.id})`);
        this.connectInstance(inst.id, inst.tenantId).catch((err) => {
          this.logger.error(`Failed to auto-restore instance ${inst.id}: ${err.message}`);
        });
      }
    }
  }

  async connectInstance(instanceId: string, tenantId: string): Promise<void> {
    console.log("Starting Baileys socket for instance:", instanceId);
    if (this.activeSockets.has(instanceId)) {
      this.logger.log(`Instance ${instanceId} is already connecting or connected.`);
      return;
    }

    const instance = await this.prisma.whatsappInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new Error('Instance not found');
    }

    // Prepare temp auth creds directory
    const tempDir = path.join(process.cwd(), 'uploads', 'sessions', instanceId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const credsFile = path.join(tempDir, 'creds.json');
    if (instance.sessionEncrypted) {
      try {
        const decryptedCreds = decryptSession(instance.sessionEncrypted);
        if (decryptedCreds) {
          fs.writeFileSync(credsFile, JSON.stringify(decryptedCreds, null, 2));
        }
      } catch (err) {
        this.logger.error(`Failed to decrypt credentials for ${instanceId}: ${err.message}`);
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(tempDir);

    console.log("Creating makeWASocket client...");
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }) as any,
    });

    this.activeSockets.set(instanceId, sock);

    sock.ev.on('creds.update', async () => {
      console.log("creds.update event fired");
      await saveCreds();
      // Securely read, encrypt, and save to DB
      try {
        if (fs.existsSync(credsFile)) {
          const credsData = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
          const encrypted = encryptSession(credsData);
          await this.prisma.whatsappInstance.update({
            where: { id: instanceId },
            data: { sessionEncrypted: encrypted },
          });
        }
      } catch (err) {
        this.logger.error(`Error saving credentials to DB: ${err.message}`);
      }
    });

    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;
      console.log("connection.update event fired. connection status:", connection, "QR exists:", !!qr);

      if (qr) {
        console.log("QR GENERATED:", qr);
        this.qrStore.set(instanceId, qr);
        // Broadcast new QR code state via WebSocket
        await this.prisma.whatsappInstance.update({
          where: { id: instanceId },
          data: { status: 'QR_PENDING' },
        });
        this.wsGateway.emitToTenant(tenantId, 'whatsapp_status', {
          instanceId,
          status: 'QR_PENDING',
          qr,
        });
      }

      if (connection === 'open') {
        this.qrStore.delete(instanceId);
      }

      if (connection === 'connecting') {
        await this.prisma.whatsappInstance.update({
          where: { id: instanceId },
          data: { status: 'CONNECTING' },
        });
        this.wsGateway.emitToTenant(tenantId, 'whatsapp_status', {
          instanceId,
          status: 'CONNECTING',
        });
      }

      if (connection === 'open') {
        const userJid = sock.user?.id;
        const phone = userJid ? userJid.split(':')[0] : null;
        const name = sock.user?.name || null;

        await this.prisma.whatsappInstance.update({
          where: { id: instanceId },
          data: {
            status: 'CONNECTED',
            phoneNumber: phone,
            displayName: name,
            connectedAt: new Date(),
          },
        });

        this.wsGateway.emitToTenant(tenantId, 'whatsapp_status', {
          instanceId,
          status: 'CONNECTED',
          phoneNumber: phone,
          displayName: name,
        });
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

        this.logger.log(`Connection closed for ${instanceId}. Reconnecting? ${shouldReconnect}`);

        await this.prisma.whatsappInstance.update({
          where: { id: instanceId },
          data: { status: 'DISCONNECTED' },
        });

        this.wsGateway.emitToTenant(tenantId, 'whatsapp_status', {
          instanceId,
          status: 'DISCONNECTED',
        });

        this.activeSockets.delete(instanceId);

        if (shouldReconnect) {
          setTimeout(() => {
            this.connectInstance(instanceId, tenantId).catch((err) => {
              this.logger.error(`Reconnection error for ${instanceId}: ${err.message}`);
            });
          }, 5000);
        } else {
          // Logged out: wipe DB session and files
          this.cleanupInstanceFiles(instanceId);
          await this.prisma.whatsappInstance.update({
            where: { id: instanceId },
            data: { sessionEncrypted: null },
          });
        }
      }
    });

    // Handle Incoming Messages
    sock.ev.on('messages.upsert', async (m) => {
      console.log("messages.upsert event received. Type:", m.type);
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key.fromMe) {
            await this.handleIncomingMessage(instanceId, msg, tenantId);
          }
        }
      }
    });
  }

  private cleanupInstanceFiles(instanceId: string) {
    const tempDir = path.join(process.cwd(), 'uploads', 'sessions', instanceId);
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        this.logger.error(`Error deleting temp session files: ${err.message}`);
      }
    }
  }

  async logoutInstance(instanceId: string, tenantId: string): Promise<void> {
    const sock = this.activeSockets.get(instanceId);
    if (sock) {
      try {
        await sock.logout();
      } catch (err) {
        this.logger.error(`Error during socket logout: ${err.message}`);
      }
      this.activeSockets.delete(instanceId);
    }
    this.cleanupInstanceFiles(instanceId);
    await this.prisma.whatsappInstance.update({
      where: { id: instanceId },
      data: {
        status: 'DISCONNECTED',
        sessionEncrypted: null,
      },
    });
    this.wsGateway.emitToTenant(tenantId, 'whatsapp_status', {
      instanceId,
      status: 'DISCONNECTED',
    });
  }

  async sendSocketMessage(instanceId: string, to: string, content: any): Promise<any> {
    const sock = this.activeSockets.get(instanceId);
    if (!sock) {
      throw new Error(`Instance ${instanceId} is not connected.`);
    }
    const cleanJid = to.includes('@s.whatsapp.net') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;
    return sock.sendMessage(cleanJid, content);
  }

  private async handleIncomingMessage(instanceId: string, msg: any, tenantId: string) {
    const phone = msg.key.remoteJid ? msg.key.remoteJid.split('@')[0] : '';
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const messageId = msg.key.id;

    if (!phone || !messageId) return;

    // Find the lead associated with this phone
    let lead = await this.prisma.lead.findFirst({
      where: {
        tenantId,
        phone: { contains: phone },
      },
    });

    // Create DB entry
    const savedMsg = await this.prisma.whatsappMessage.create({
      data: {
        messageId,
        instanceId,
        direction: 'INBOUND',
        messageType: 'TEXT',
        body,
        status: 'READ',
        leadId: lead?.id || null,
      },
    });

    this.wsGateway.emitToTenant(tenantId, 'incoming_message', {
      message: savedMsg,
      leadId: lead?.id,
    });
  }
}

// Dummy helper import for pino
import pino from 'pino';
