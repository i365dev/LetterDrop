# LetterDrop

LetterDrop is a secure and efficient newsletter management service powered by Cloudflare Workers, enabling easy creation, distribution, and subscription management of newsletters.

## The story

I have been using `TinyLetter` to send newsletters to my subscribers, but unfortunately, Mailchimp has now shut down this free service. This isn't the first time I've faced such an issue, whenever this happens, I lose all my subscribers and have to look for a new way to send newsletters. To avoid this recurring problem, I've decided to build my own free newsletter service. It needs to be zero-cost, easy to use, and reliable so it won't get shut down. To achieve this, I'm using Cloudflare Workers to create the service, which I've named LetterDrop.

## How to use?

### Create a newsletter

1. Create a newsletter by sending a POST request to the `/api/newsletter` endpoint like this:

```bash
curl --request POST \
  --url https://ld.i365.tech/api/newsletter \
  --header 'CF-Access-Client-Id: <<CF-Access-Client-Id>>' \
  --header 'CF-Access-Client-Secret: <<CF-Access-Client-Secret>>' \
  --header 'content-type: application/json' \
  --data '{
    "title": "BMPI",
    "description": "BMPI weekly newsletter",
    "logo": "https://www.bmpi.dev/images/logo.png"
}'
```

2. Offline the newsletter by sending a PUT request to the `/api/newsletter/:id/offline` endpoint like this:

```bash
curl --request PUT \
  --url https://ld.i365.tech/api/newsletter/9080f810-e0f7-43aa-bac8-8d1cb3ceeff4/offline \
  --header 'CF-Access-Client-Id: <<CF-Access-Client-Id>>' \
  --header 'CF-Access-Client-Secret: <<CF-Access-Client-Secret>>'
```

__NOTE:__ These APIs should be protected by Cloudflare zero-trust security. That means you need to create a [service-token](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/) and use it to access these APIs.

### Subscribe or Unsubscribe to a newsletter

Just go to the newsletter page and click the subscribe or unsubscribe button. e.g. [BMPI](https://ld.i365.tech/newsletter/e0b379d3-0be0-4ae5-9fe2-cd972a667cdb).

Then you will receive an email to confirm your subscription or unsubscription. After that, you will receive the newsletter when it is published.

__NOTE:__ The newsletter page link pattern is `https://<<your-domain>>/newsletter/:id`.

### Publish a newsletter

The LetterDrop use the Cloudflare Email Worker to send emails. And there is a `ALLOWED_EMAILS` variable to control who can send newsletters. You can use the Cloudflare dashboard to update the variable.

After that, you can publish a newsletter by sending your newsletter content to this specific email address. And the Email Worker will send the newsletter to all subscribers.

__NOTE:__

- You should config the Email Worker to let it can be triggered by the specific email address. Please refer to the [Cloudflare Email Worker](https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/) to know how to do it.
- The newsletter email subject should be `[Newsletter-ID:<<the-newsletter-id>>]<<your-newsletter-title>>`, e.g. `[Newsletter-ID:9080f810-e0f7-43aa-bac8-8d1cb3ceeff4]BMPI Weekly Newsletter - 20240623`.

## How to deploy?

To use LetterDrop, you need to create a Cloudflare account and deploy the Worker script. The Worker script is available in the `app` directory. You can deploy the Worker script using the Cloudflare Workers dashboard.

__NOTE:__ You need to change the `app/wrangler.toml` file to use your config values.

### The dependencies

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Cloudflare Email Workers](https://developers.cloudflare.com/email-routing/email-workers/)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/#cloudflare-queues/)
- [Cloudflare D1](https://developers.cloudflare.com/d1)
  - Please refer to the [app/db/README.md](app/db/README.md) file to create the database.

### Variables

- `ALLOWED_EMAILS`: The list of allowed emails to create newsletters.

### How to setup the notification service?

Currently LetterDrop uses [AWS SES](https://aws.amazon.com/ses/) to send emails. You need to create an AWS account and configure SES to send emails. After that, you need to create a Cloudflare Worker as a notification service. The code is very simple, you can use the ChatGPT to generate the code.

### How to handle the failed emails?

LetterDrop uses the Cloudflare Queues to handle the failed emails. You can use the Cloudflare dashboard to monitor the failed emails and replay them in the dead-letter queue.

## What is the next step?

The next step is to add more features to LetterDrop.

- Improvments
  - [ ] Add the unit tests.
  - [ ] Add the email template.
  - [ ] Track the email open rate.
  - [ ] Support more third-party email services like SendGrid, Mailgun, etc.
- [ ] Support the mulit-tenant feature.
- [ ] Add the landing page.

## How to contribute?

I used the GPT-4o model to generate the code for LetterDrop. That means the code is generated by the AI model, and I only need to provide the prompts to the model. This approach is very efficient and can save a lot of time. I've also recorded a [video](https://www.youtube.com/playlist?list=PL21oMWN6Y7PCqSwbwesD4_wmXEVSeeQ7h) to show how to create the LetterDrop project using the GPT-4o model.

That also means you can easily customize the code by changing the prompts. You can find the prompts in the [CDDR](docs/CDDR//app.md) file.

Even I use the GPT model to generate the code, I still need to review the code and test it. So if you find any issues or have any suggestions, please feel free to create an issue or pull request. And there is no restriction on the contribution, you can contribute to any part of the project by yourself or with the help of the GPT model.

## Disscussion

If you have any questions or suggestions, please feel free to create an issue or pull request. I'm happy to discuss with you. Or you can discuss it in this hacker news [thread](https://news.ycombinator.com/item?id=40764579).
