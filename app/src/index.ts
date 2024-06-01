import { Context, Hono } from 'hono'

type Bindings = {
  DB: D1Database
  NOTIFICATION: Fetcher
  KV: KVNamespace
}

const NOTIFICATION_BASE_URL = 'http://my-invest-notification'

const app = new Hono<{ Bindings: Bindings }>()

// Private Routes for managing Newsletters
app.post('/api/newsletter', async (c: Context) => {
  const { title, description, logo } = await c.req.json<{ title: string, description: string, logo: string }>()

  const id = crypto.randomUUID()

  const createdAt = new Date().toISOString()
  const updatedAt = createdAt

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

  return c.json({ message: 'Subscription confirmed successfully' })
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

  return c.json({ message: 'Unsubscribed successfully' })
})

app.post('/api/subscribe/send-confirmation', async (c: Context) => {
  const { email, newsletterId } = await c.req.json<{ email: string, newsletterId: string }>()
  const token = crypto.randomUUID()
  const expiry = 5 * 60 * 1000 // 5 minutes

  // Store Token
  await c.env.KV.put(token, JSON.stringify({ email, newsletterId }), { expirationTtl: expiry })

  // Send Confirmation Email
  const confirmationUrl = `https://ld.i365.tech/api/subscribe/confirm/${token}`

  await sendEmail(c, email, 'Confirm your subscription', `Please confirm your subscription by clicking the following link: ${confirmationUrl}`)

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

  await sendEmail(c, email, 'Cancel your subscription', `Please cancel your subscription by clicking the following link: ${cancellationUrl}`)

  return c.json({ message: 'Cancellation email sent' })
})

const sendEmail = async (c: Context, email: string, subject: string, txt: string) => {
  const res = await c.env.NOTIFICATION.fetch(
    new Request(`${NOTIFICATION_BASE_URL}/send_email`, {
      method: 'POST',
      body: JSON.stringify({ mail_to: email, subject, txt }),
      headers: { 'Content-Type': 'application/json' },
    })
  );

  const { message } = await res.json();

  if (message !== 'success') {
    console.error(`[send email failed for ${email}`);
  }
}

// Public Page for viewing Newsletters
// TODO: Change it to render a view instead of JSON
app.get('/newsletter/:newsletterId', async (c) => {
  const { newsletterId } = c.req.param()

  try {
    const newsletter = await c.env.DB.prepare(
      `SELECT * FROM Newsletter WHERE id = ?`
    ).bind(newsletterId).first()

    if (!newsletter) {
      return c.json({ error: 'Newsletter not found' }, 404)
    }

    const subscriberCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM Subscriber WHERE newsletter_id = ? AND isSubscribed = ?`
    ).bind(newsletterId, true).first() || { count: 0 }

    return c.json({ ...newsletter, subscriberCount: subscriberCount.count })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// TODO: Admin send newsletter to subscribers

export default app
