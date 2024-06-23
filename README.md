# LetterDrop

LetterDrop is a secure and efficient newsletter management service powered by Cloudflare Workers, enabling easy creation, distribution, and subscription management of newsletters.

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

__NOTE:__ The newsletter page link pattern is `https://<<your-domain>>/newsletter/:id`.

## How to deploy?

To use LetterDrop, you need to create a Cloudflare account and deploy the Worker script. The Worker script is available in the `app` directory. You can deploy the Worker script using the Cloudflare Workers dashboard.

__NOTE:__ You need to change the `app/wrangler.toml` file to use your config values.

### How to setup the notification service?

Currently LetterDrop uses [AWS SES](https://aws.amazon.com/ses/) to send emails. You need to create an AWS account and configure SES to send emails. After that, you need to create a Cloudflare Worker as a notification service. The code is very simple, you can use the ChatGPT to generate the code.

## What is the next step?

The next step is to add more features to LetterDrop.

- [ ] Support the mulit-tenant feature.
- [ ] Add the landing page.

## How to contribute?

All codes are written by GPT-4o, and the prompts are stored in this [CDDR](docs/CDDR//app.md) file.
