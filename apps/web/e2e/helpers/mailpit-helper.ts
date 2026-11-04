import { URL } from 'node:url';

export interface MailpitMessageSummary {
  ID: string;
  Subject: string;
  To: Array<{ Address: string }>;
  Snippet: string;
}

export interface MailpitMessageListResponse {
  total: number;
  messages: MailpitMessageSummary[];
}

export interface MailpitMessageDetail {
  ID: string;
  Subject: string;
  Text: string;
  HTML: string;
}

/**
 * Polls Mailpit API for an invitation email sent to `toEmail`.
 * Extracts the accept-invite link and deletes the test message.
 */
export async function getInviteLinkFromMailpit(
  toEmail: string,
  mailpitBaseUrl = 'http://127.0.0.1:8025',
  maxWaitMs = 12_000,
): Promise<{ inviteUrl: string; messageId: string } | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const res = await fetch(`${mailpitBaseUrl}/api/v1/messages`, {
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = (await res.json()) as MailpitMessageListResponse;
        const match = data.messages.find((m) =>
          m.To.some((recipient) => recipient.Address.toLowerCase() === toEmail.toLowerCase()),
        );

        if (match) {
          // Fetch full message body
          const detailRes = await fetch(`${mailpitBaseUrl}/api/v1/message/${match.ID}`, {
            signal: AbortSignal.timeout(3000),
          });

          if (detailRes.ok) {
            const detail = (await detailRes.json()) as MailpitMessageDetail;
            const content = `${detail.Text} ${detail.HTML}`;
            // Match accept-invite link with token query param
            const urlMatch = content.match(
              /https?:\/\/[^\s"'<>]+\/accept-invite\?token=[a-zA-Z0-9_\-]+/,
            );
            if (urlMatch && urlMatch[0]) {
              return {
                inviteUrl: urlMatch[0],
                messageId: match.ID,
              };
            }
          }
        }
      }
    } catch {
      // transient connection error or mailpit startup
    }

    await new Promise((r) => setTimeout(r, 600));
  }

  return null;
}

/**
 * Deletes specific test messages from Mailpit by ID.
 */
export async function deleteMailpitMessage(
  messageId: string,
  mailpitBaseUrl = 'http://127.0.0.1:8025',
): Promise<void> {
  try {
    await fetch(`${mailpitBaseUrl}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: [messageId] }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // ignore cleanup error
  }
}
