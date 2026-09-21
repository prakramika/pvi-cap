# Deploy PVI-CAP to AWS

Phase 1 production: **web (nginx) + API (Node) + RDS PostgreSQL + Amazon SES**.

You cannot finish this from this laptop without an AWS account login. Create the account (or get access), then follow the steps. Mumbai `ap-south-1` is the usual region for PVI.

## What to create in AWS

1. **RDS PostgreSQL 16**
   - Public access off
   - Security group: allow 5432 only from the EC2/ECS security group
   - Database name `pvi_cap`
2. **Amazon SES**
   - Verify `prakramikavocationalinstitute.com` (or the from-address)
   - Create SMTP credentials
   - Leave the account in sandbox until PVI asks AWS to move it to production (sandbox can only mail verified addresses)
3. **EC2** (simplest for UAT) or **ECS Fargate**
   - Ubuntu 22.04, open 80 and 443
   - Install Docker
4. **ECR** (optional if you use GitHub Actions)
   - Repositories `pvi-cap-api` and `pvi-cap-web`

## Environment (put on the server, never in git)

```
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@RDS_HOST:5432/pvi_cap
WEB_ORIGIN=https://YOUR_DOMAIN
JWT_ACCESS_SECRET=long-random-string
JWT_REFRESH_SECRET=another-long-random-string
SMTP_HOST=email-smtp.ap-south-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=AKIA...
SMTP_PASS=ses-smtp-password
SMTP_FROM=Prakramika Vocational Institute <no-reply@prakramikavocationalinstitute.com>
EMAIL_REPLY_TO=info.prakramika@gmail.com
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=change-this-before-uat
```

## First deploy on EC2

From the repo on the instance:

```bash
cp .env.example .env
# edit .env with the RDS and SES values
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

Then open `http://EC2_PUBLIC_IP`. Add a domain and TLS (Nginx / ACM / Cloudflare) when PVI has the hostname.

`GET /health` should return `{ "status": "ok" }`.

## Mail on AWS

SES uses the same `SMTP_*` keys as Mailpit. After SES is verified:

- Admin **Send a form** → parent enrolment letter
- Family sign-in OTP → parent / teacher / caregiver mailbox
- Completion letter after all six tools

Until SES is out of sandbox, only verified To-addresses receive mail. For local UAT keep Mailpit (`docs/mailpit.md`).

## GitHub → ECR

`.github/workflows/aws.yml` builds and pushes images when these secrets exist:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (example `ap-south-1`)
- `ECR_API_REPO`
- `ECR_WEB_REPO`

Give me the AWS account/region and the public hostname when you have them and I will wire the live deploy.
