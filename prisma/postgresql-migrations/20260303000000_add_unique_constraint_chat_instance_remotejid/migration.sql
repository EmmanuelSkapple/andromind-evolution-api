-- Add unique constraint to Chat table for ON CONFLICT support in addLabel
-- Required by the raw SQL upsert in whatsapp.baileys.service.ts addLabel()
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_instanceId_remoteJid_key" UNIQUE ("instanceId", "remoteJid");
