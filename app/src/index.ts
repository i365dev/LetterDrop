import { Hono } from 'hono'
import { uuid as uuidv4 } from 'uuidv4'

type Bindings = {
  DB: D1Database
  NOTIFICATION: string
  KV: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

// Private Routes for managing Newsletters
app.post('/api/newsletter', async (c) => {
  const { title, description, logo } = await c.req.json<{ title: string, description: string, logo: string }>()
  const id = uuidv4()
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

app.put('/api/newsletter/:newsletterId/offline', async (c) => {
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
app.get('/api/subscribe/confirm/:token', async (c) => {
  const { token } = c.req.param()
  
  // Validate Token and Get Email
  const email = await c.env.KV.get(token)
  if (!email) {
    return c.json({ error: 'Invalid or expired token' }, 400)
  }

  // Update Subscription Status
  await c.env.DB.prepare(
    `UPDATE Subscriber SET isSubscribed = ? WHERE email = ?`
  ).bind(true, email).run()

  return c.json({ message: 'Subscription confirmed successfully' })
})

app.get('/api/subscribe/cancel/:token', async (c) => {
  const { token } = c.req.param()

  // Validate Token and Get Email
  const email = await c.env.KV.get(token)
  if (!email) {
    return c.json({ error: 'Invalid or expired token' }, 400)
  }

  // Update Subscription Status
  await c.env.DB.prepare(
    `UPDATE Subscriber SET isSubscribed = ? WHERE email = ?`
  ).bind(false, email).run()

  return c.json({ message: 'Unsubscribed successfully' })
})

app.post('/api/subscribe/send-confirmation', async (c) => {
  const { email, newsletterId } = await c.req.json<{ email: string, newsletterId: string }>()
  const token = uuidv4()
  const expiry = 5 * 60 * 1000 // 5 minutes

  // Store Token
  await c.env.KV.put(token, email, { expirationTtl: expiry })

  // Send Confirmation Email
  const confirmationUrl = `https://ld.i365.tech/api/subscribe/confirm?token=${token}`
  await fetch(c.env.NOTIFICATION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      subject: 'Confirm your subscription',
      body: `Please confirm your subscription by clicking the following link: ${confirmationUrl}`
    })
  })

  return c.json({ message: 'Confirmation email sent' })
})

app.post('/api/subscribe/send-cancellation', async (c) => {
  const { email, newsletterId } = await c.req.json<{ email: string, newsletterId: string }>()
  const token = uuidv4()
  const expiry = 5 * 60 * 1000 // 5 minutes

  // Store Token
  await c.env.KV.put(token, email, { expirationTtl: expiry })

  // Send Cancellation Email
  const cancellationUrl = `https://your-domain.com/api/subscribe/cancel?token=${token}`
  await fetch(c.env.NOTIFICATION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      subject: 'Cancel your subscription',
      body: `Please cancel your subscription by clicking the following link: ${cancellationUrl}`
    })
  })

  return c.json({ message: 'Cancellation email sent' })
})

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
      `SELECT COUNT(*) as count FROM Subscriber WHERE newsletter_id = ?`
    ).bind(newsletterId).first() || { count: 0 }

    return c.json({ ...newsletter, subscriberCount: subscriberCount.count })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// TODO: Admin send newsletter to subscribers

export default app
