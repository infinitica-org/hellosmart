/**
 * Registers Fastify content-type parser to capture raw body buffer
 * for Cal.com HMAC-SHA256 signature verification.
 */
export function registerWebhookRawBodyParser(fastify: any): void {
  if (fastify && typeof fastify.addContentTypeParser === 'function') {
    fastify.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      function (req: any, body: Buffer, done: (err: Error | null, res?: any) => void) {
        req.rawBody = body;
        if (!body || body.length === 0) {
          return done(null, {});
        }
        try {
          const json = JSON.parse(body.toString('utf8'));
          done(null, json);
        } catch (err) {
          // If this is the Cal.com webhook route, allow the malformed body to reach the controller
          // so that the raw wire delivery and parse failure outcome can be durably recorded.
          if (typeof req.url === 'string' && req.url.includes('/webhooks/calcom')) {
            done(null, { __malformedJson: true, parseError: (err as Error).message });
          } else {
            done(err as Error, undefined);
          }
        }
      },
    );
  }
}
