import { Response } from 'express';

type SSEClient = { res: Response; userId: string };

const clients = new Map<string, Set<SSEClient>>();

export const sseManager = {
  add(userId: string, res: Response): SSEClient {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const client: SSEClient = { res, userId };
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId)!.add(client);

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    res.on('close', () => {
      clearInterval(heartbeat);
      clients.get(userId)?.delete(client);
      if (clients.get(userId)?.size === 0) clients.delete(userId);
    });

    return client;
  },

  push(userId: string, data: Record<string, unknown>): void {
    const userClients = clients.get(userId);
    if (!userClients || userClients.size === 0) return;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of userClients) {
      try {
        client.res.write(payload);
      } catch {
        userClients.delete(client);
      }
    }
  },

  broadcast(data: Record<string, unknown>): void {
    for (const [userId] of clients) {
      this.push(userId, data);
    }
  },

  connectedUserIds(): string[] {
    return Array.from(clients.keys());
  },
};
