import { Context, Hono } from 'hono'
import PostalMime from "postal-mime";

type Bindings = {
  DB: D1Database
  NOTIFICATION: Fetcher
  KV: KVNamespace
  R2: R2Bucket
  QUEUE: Queue
  ALLOWED_EMAILS: string;
};

const NOTIFICATION_BASE_URL = 'http://my-invest-notification'

const app = new Hono<{ Bindings: Bindings }>()

// Private Routes for managing Newsletters
app.post('/api/newsletter', async (c: Context) => {
  const { title, description, logo } = await c.req.json<{ title: string, description: string, logo: string }>()

  const id = crypto.randomUUID()

  const createdAt = new Date().toISOString()
  const updatedAt = createdAt

  await c.env.R2.put(`newsletters/${id}/index.md`, `# ${title}\n\n${description}`)

  try {
    await c.env.DB.prepare(
      `INSERT INTO Newsletter (id, title, description, logo, subscribable, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, title, description, logo, true, createdAt, updatedAt).run()

    return c.json({ id, title, description, logo, subscribable: true, createdAt, updatedAt }, 201)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.put('/api/newsletter/:newsletterId/offline', async (c: Context) => {
  const { newsletterId } = c.req.param()

  try {
    await c.env.DB.prepare(
      `UPDATE Newsletter SET subscribable = ? WHERE id = ?`
    ).bind(false, newsletterId).run()

    return c.json({ message: 'Newsletter taken offline successfully' })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Public Routes for managing Subscriptions
app.get('/api/subscribe/confirm/:token', async (c: Context) => {
  const { token } = c.req.param()

  // Validate Token and Get Email
  const tokenString = await c.env.KV.get(token) as string
  if (!tokenString) {
    return c.json({ error: 'Invalid or expired token' }, 400)
  }

  const { email, newsletterId } = JSON.parse(tokenString)

  if (!email || !newsletterId) {
    return c.json({ error: 'Invalid or expired token' }, 400)
  }

  // Upsert Subscription
  await c.env.DB.prepare(
    `INSERT INTO Subscriber (email, newsletter_id, isSubscribed) VALUES (?, ?, ?)
     ON CONFLICT(email, newsletter_id) DO UPDATE SET isSubscribed = ?`
  ).bind(email, newsletterId, true, true).run()

  return renderHtml(c, 'Subscription confirmed successfully', '订阅成功确认');
})

app.get('/api/subscribe/cancel/:token', async (c: Context) => {
  const { token } = c.req.param()

  // Validate Token and Get Email
  const tokenString = await c.env.KV.get(token) as string
  if (!tokenString) {
    return c.json({ error: 'Invalid or expired token' }, 400)
  }

  const { email, newsletterId } = JSON.parse(tokenString)

  if (!email || !newsletterId) {
    return c.json({ error: 'Invalid or expired token' }, 400)
  }

  // Update Subscription Status
  await c.env.DB.prepare(
    `UPDATE Subscriber SET isSubscribed = ? WHERE email = ? AND newsletter_id = ?`
  ).bind(false, email, newsletterId).run()

  return renderHtml(c, 'Unsubscribed successfully', '取消订阅成功');
})

app.post('/api/subscribe/send-confirmation', async (c: Context) => {
  const { email, newsletterId } = await c.req.json<{ email: string, newsletterId: string }>()
  const token = crypto.randomUUID()
  const expiry = 5 * 60 * 1000 // 5 minutes

  // Store Token
  await c.env.KV.put(token, JSON.stringify({ email, newsletterId }), { expirationTtl: expiry })

  // Send Confirmation Email
  const confirmationUrl = `https://ld.i365.tech/api/subscribe/confirm/${token}`

  await sendEmail(c.env, email, 'Confirm your subscription', `Please confirm your subscription by clicking the following link: ${confirmationUrl}`)

  return c.json({ message: 'Confirmation email sent' })
})

app.post('/api/subscribe/send-cancellation', async (c: Context) => {
  const { email, newsletterId } = await c.req.json<{ email: string, newsletterId: string }>()
  const token = crypto.randomUUID()
  const expiry = 5 * 60 * 1000 // 5 minutes

  // Store Token
  await c.env.KV.put(token, JSON.stringify({ email, newsletterId }), { expirationTtl: expiry })

  // Send Cancellation Email
  const cancellationUrl = `https://ld.i365.tech/api/subscribe/cancel/${token}`

  await sendEmail(c.env, email, 'Cancel your subscription', `Please cancel your subscription by clicking the following link: ${cancellationUrl}`)

  return c.json({ message: 'Cancellation email sent' })
})

const sendEmail = async (env: Bindings, email: string, subject: string, txt: string, html: string = '') => {
  const res = await env.NOTIFICATION.fetch(
    new Request(`${NOTIFICATION_BASE_URL}/send_email`, {
      method: 'POST',
      body: JSON.stringify({ mail_to: email, subject, txt, html }),
      headers: { 'Content-Type': 'application/json' },
    })
  );

  const { message } = await res.json() as { message: string };

  if (message !== 'success') {
    console.error(`[send email failed for ${email}`);
  }
}

// Public Page for viewing Newsletters
app.get('/newsletter/:newsletterId', async (c) => {
  const { newsletterId } = c.req.param()

  try {
    const newsletter = await c.env.DB.prepare(
      `SELECT * FROM Newsletter WHERE id = ?`
    ).bind(newsletterId).first()

    if (!newsletter) {
      return c.html('<h1>Newsletter not found</h1>', 404)
    }

    if (!newsletter.subscribable) {
      return c.html('<h1>Newsletter is not subscribable</h1>', 404)
    }

    const subscriberCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM Subscriber WHERE newsletter_id = ? and isSubscribed = ?`
    ).bind(newsletterId, 1).first() || { count: 0 }

    // 获取用户语言
    const language = c.req.header('Accept-Language')?.startsWith('zh') ? 'zh' : 'en'

    const html = language === 'zh' ? `
      <html>
        <head>
          <title>${newsletter.title}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              background-color: #f4f4f4;
            }
            .container {
              background: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              text-align: center;
              width: 90%;
              max-width: 600px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            h1 {
              margin: 20px 0;
            }
            p {
              font-size: 16px;
              color: #333;
            }
            .input-container {
              margin: 20px 0;
            }
            input[type="email"] {
              padding: 10px;
              font-size: 16px;
              width: 80%;
              max-width: 400px;
              border: 1px solid #ccc;
              border-radius: 5px;
            }
            .button {
              display: inline-block;
              margin: 10px 5px;
              padding: 10px 20px;
              font-size: 16px;
              color: white;
              background-color: #007BFF;
              border: none;
              border-radius: 5px;
              text-decoration: none;
              cursor: pointer;
            }
            .button.cancel {
              background-color: #dc3545;
            }
            .message {
              margin-top: 20px;
              font-size: 16px;
              color: green;
            }
            .error {
              margin-top: 20px;
              font-size: 16px;
              color: red;
            }
          </style>
          <script>
            function validateEmail(email) {
              const re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
              return re.test(email)
            }

            async function handleSubscribe(action) {
              const email = document.getElementById('email').value
              const messageElement = document.getElementById('message')
              const errorElement = document.getElementById('error')
              
              messageElement.textContent = ''
              errorElement.textContent = ''
              
              if (!email || !validateEmail(email)) {
                errorElement.textContent = '请输入有效的邮箱地址。'
                return
              }

              try {
                const response = await fetch(\`/api/subscribe/\${action}\`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ email, newsletterId: '${newsletterId}' })
                })

                if (response.ok) {
                  messageElement.textContent = '操作成功，请检查您的邮箱。'
                } else {
                  const result = await response.json()
                  errorElement.textContent = result.error || '操作失败，请重试。'
                }
              } catch (error) {
                errorElement.textContent = '请求失败，请检查您的网络连接。'
              }
            }
          </script>
        </head>
        <body>
          <div class="container">
            <img src="${newsletter.logo}" alt="${newsletter.title} Logo" />
            <h1>${newsletter.title}</h1>
            <p>${newsletter.description}</p>
            <p>订阅者: ${subscriberCount.count}</p>
            <div class="input-container">
              <input type="email" id="email" placeholder="请输入您的邮箱地址" />
            </div>
            <button class="button" onclick="handleSubscribe('send-confirmation')">订阅</button>
            <button class="button cancel" onclick="handleSubscribe('send-cancellation')">取消订阅</button>
            <p id="message" class="message"></p>
            <p id="error" class="error"></p>
          </div>
        </body>
      </html>
    ` : `
      <html>
        <head>
          <title>${newsletter.title}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              background-color: #f4f4f4;
            }
            .container {
              background: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              text-align: center;
              width: 90%;
              max-width: 600px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            h1 {
              margin: 20px 0;
            }
            p {
              font-size: 16px;
              color: #333;
            }
            .input-container {
              margin: 20px 0;
            }
            input[type="email"] {
              padding: 10px;
              font-size: 16px;
              width: 80%;
              max-width: 400px;
              border: 1px solid #ccc;
              border-radius: 5px;
            }
            .button {
              display: inline-block;
              margin: 10px 5px;
              padding: 10px 20px;
              font-size: 16px;
              color: white;
              background-color: #007BFF;
              border: none;
              border-radius: 5px;
              text-decoration: none;
              cursor: pointer;
            }
            .button.cancel {
              background-color: #dc3545;
            }
            .message {
              margin-top: 20px;
              font-size: 16px;
              color: green;
            }
            .error {
              margin-top: 20px;
              font-size: 16px;
              color: red;
            }
          </style>
          <script>
            function validateEmail(email) {
              const re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
              return re.test(email)
            }

            async function handleSubscribe(action) {
              const email = document.getElementById('email').value
              const messageElement = document.getElementById('message')
              const errorElement = document.getElementById('error')
              
              messageElement.textContent = ''
              errorElement.textContent = ''
              
              if (!email || !validateEmail(email)) {
                errorElement.textContent = 'Please enter a valid email address.'
                return
              }

              try {
                const response = await fetch(\`/api/subscribe/\${action}\`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ email, newsletterId: '${newsletterId}' })
                })

                if (response.ok) {
                  messageElement.textContent = 'Operation successful, please check your email.'
                } else {
                  const result = await response.json()
                  errorElement.textContent = result.error || 'Operation failed, please try again.'
                }
              } catch (error) {
                errorElement.textContent = 'Request failed, please check your network connection.'
              }
            }
          </script>
        </head>
        <body>
          <div class="container">
            <img src="${newsletter.logo}" alt="${newsletter.title} Logo" />
            <h1>${newsletter.title}</h1>
            <p>${newsletter.description}</p>
            <p>Subscribers: ${subscriberCount.count}</p>
            <div class="input-container">
              <input type="email" id="email" placeholder="Enter your email address" />
            </div>
            <button class="button" onclick="handleSubscribe('send-confirmation')">Subscribe</button>
            <button class="button cancel" onclick="handleSubscribe('send-cancellation')">Unsubscribe</button>
            <p id="message" class="message"></p>
            <p id="error" class="error"></p>
          </div>
        </body>
      </html>
    `

    return c.html(html)
  } catch (error: any) {
    return c.html(`<h1>${error.message}</h1>`, 500)
  }
})

// Common Functions

function renderHtml(c: Context, englishMessage: string, chineseMessage: string) {
  const language = c.req.header('Accept-Language')?.startsWith('zh') ? 'zh' : 'en';
  const message = language === 'zh' ? chineseMessage : englishMessage;

  const html = `
    <!DOCTYPE html>
    <html lang="${language}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${message}</title>
      </head>
      <body>
        <h1>${message}</h1>
      </body>
    </html>
  `;

  return c.html(html);
}

const streamToArrayBuffer = async function (stream: ReadableStream, streamSize: number) {
  let result = new Uint8Array(streamSize);
  let bytesRead = 0;
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    result.set(value, bytesRead);
    bytesRead += value.length;
  }
  return result;
}

async function getSubscribers(newsletterId: string, db: D1Database): Promise<{ email: string }[]> {
  const { results } = await db.prepare(`SELECT email FROM Subscriber WHERE newsletter_id = ? AND isSubscribed = true`).bind(newsletterId).all();
  return results as { email: string }[];
}

export default {
  fetch: app.fetch,
  async email(message: ForwardableEmailMessage, env: Bindings, ctx: ExecutionContext) {
    const allowedEmails = env.ALLOWED_EMAILS.split(',');

    if (allowedEmails.indexOf(message.from) === -1) {
      message.setReject("Address not allowed");
      return;
    }

    const subject = message.headers.get('subject') ?? '';

    console.log(`Processing email with subject: ${subject}`);

    const newsletterIdMatch = subject.match(/\[Newsletter-ID:([a-f0-9-]{36})\]/);
    const newsletterId = newsletterIdMatch ? newsletterIdMatch[1] : null;

    const realSubject = subject.replace(/\[Newsletter-ID:[a-f0-9-]{36}\]/, '').trim();

    if (!newsletterId) {
      message.setReject("No Newsletter ID found in subject");
      return;
    }

    const rawEmail = await streamToArrayBuffer(message.raw, message.rawSize);
    const parser = new PostalMime();
    const parsedEmail = await parser.parse(rawEmail);
    if (!parsedEmail.html || !parsedEmail.text) {
      console.error(`Can not parse email`);
      return;
    }

    const fileName = `newsletters/${newsletterId}/${Date.now()}.html`;

    await env.R2.put(fileName, parsedEmail.html);

    const subscribers = await getSubscribers(newsletterId, env.DB);

    for (const subscriber of subscribers) {
      await env.QUEUE.send({
        email: subscriber.email,
        newsletterId,
        subject: realSubject,
        fileName
      });
    }
  },
  async queue(batch: MessageBatch<{ email: string, newsletterId: string, subject: string, fileName: string }>, env: Bindings): Promise<void> {
    for (const message of batch.messages) {
      const { email, subject, newsletterId, fileName } = message.body;

      console.log(`Sending email to ${email} for newsletter ${newsletterId}`);

      try {
        const object = await env.R2.get(fileName);
        if (!object) throw new Error('Failed to get HTML content from R2');

        const htmlContent = await object.text();

        await sendEmail(env, email, subject, '', htmlContent);
        console.log(`Email sent to ${email}`);
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
      }
    }
  }
}
