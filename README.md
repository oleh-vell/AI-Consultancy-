This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### 1. Database (local Postgres in Docker)

The app is backed by Postgres — no seed data is compiled into the app, it all
lives in the database. Bring it up, apply migrations, and load the seed rows:

```bash
cp .env.local.example .env.local   # first time only
npm run db:setup                    # docker up + migrate + seed
```

`db:setup` is the one-shot. The individual steps are also available:

| Script               | What it does                                            |
| -------------------- | ------------------------------------------------------- |
| `npm run db:up`      | Start the Postgres container (host port **5434**)       |
| `npm run db:migrate` | Apply pending SQL files in `db/migrations`              |
| `npm run db:seed`    | Load `db/seed.sql` (leads, discovery script, billing)   |
| `npm run db:reset`   | Drop the schema, re-migrate, re-seed (clean slate)      |
| `npm run db:down`    | Stop the container (keeps data)                         |
| `npm run db:nuke`    | Stop the container **and delete the volume**            |

The connection string is `DATABASE_URL` in `.env.local`. See `db/README.md`
for the schema and how data flows through the app.

### 2. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
