const SAMPLE_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const INVITE_URL = `http://localhost:3000/accept-invite?token=${SAMPLE_TOKEN}`;

async function run() {
  console.log('Sending invitation email to Mailpit on http://127.0.0.1:8025/api/v1/send ...');

  const payload = {
    From: {
      Email: 'no-reply@hellosmart.ai',
      Name: 'HelloSmart.ai Notification',
    },
    To: [
      {
        Email: 'jane.doe@example.com',
        Name: 'Jane Doe',
      },
    ],
    Subject: 'You have been invited to join Acme Corporation on HelloSmart.ai',
    HTML: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 36px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">HelloSmart<span style="color: #4f46e5;">.ai</span></span>
          </div>
          <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px;">You're Invited to Acme Corporation</h1>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
            Hello Jane,<br><br>
            You have been invited to complete a candidate work simulation assessment for <strong>Acme Corporation</strong> on HelloSmart.ai.
          </p>
          <div style="margin: 32px 0;">
            <a href="${INVITE_URL}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
              Activate Account &amp; Set Password &rarr;
            </a>
          </div>
          <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
            <strong>Important:</strong> This invitation link is strictly single-use and will expire in 72 hours.<br>
            If the button doesn't work, copy and paste this URL into your browser:<br>
            <span style="color: #4f46e5; word-break: break-all;">${INVITE_URL}</span>
          </p>
        </div>
      </body>
      </html>
    `,
    Text: `You have been invited to join Acme Corporation on HelloSmart.ai as a Candidate.\n\nActivate your account and set your password here:\n${INVITE_URL}\n\nThis link is single-use and expires in 72 hours.`,
  };

  const res = await fetch('http://127.0.0.1:8025/api/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`Mailpit response status: ${res.status}`);
  const data = await res.json();
  console.log('Mailpit response data:', data);

  // Check messages in inbox
  const inboxRes = await fetch('http://127.0.0.1:8025/api/v1/messages');
  const inboxData = await inboxRes.json();
  console.log(`\nMessages currently in Mailpit inbox: ${inboxData.total}`);
  if (inboxData.messages?.length > 0) {
    const msg = inboxData.messages[0];
    console.log(`- Subject: "${msg.Subject}"`);
    console.log(`- From   : ${msg.From?.Name} <${msg.From?.Address}>`);
    console.log(`- To     : ${msg.To?.map(t => t.Address).join(', ')}`);
    console.log(`- ID     : ${msg.ID}`);
  }
}

run().catch(console.error);
