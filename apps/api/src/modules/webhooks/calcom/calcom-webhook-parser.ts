/**
 * Registers Fastify content-type parser to capture raw body buffer
 * for Cal.com HMAC-SHA256 signature verification.
 */
export function registerWebhookRawBodyParser(target: any): void {
  if (target && typeof target.useBodyParser === 'function') {
    // FastifyAdapter passed directly: registers both urlencoded and json parsers,
    // marking _isParserRegistered = true so Nest does not re-register application/json.
    if (typeof target.registerUrlencodedContentParser === 'function') {
      target.registerUrlencodedContentParser(false);
    }
    target.useBodyParser(
      'application/json',
      true,
      {},
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
  } else if (target && typeof target.addContentTypeParser === 'function') {
    if (typeof target.removeContentTypeParser === 'function') {
      try {
        target.removeContentTypeParser('application/json');
      } catch {
        // ignore if not present
      }
    }
    target.addContentTypeParser(
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
