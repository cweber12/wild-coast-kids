This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment variables

The site talks to Supabase and Cloudflare R2 and deploys on Vercel. To set up
credentials on a fresh clone, run the interactive wizard — it walks you through
each dashboard, fills `.env.local`, and pushes the values to Vercel:

```bash
# from Git Bash (or any POSIX shell)
bash scripts/setup-secrets-wizard.sh
```

```powershell
# from PowerShell — plain `bash` resolves to the WSL relay, so call Git Bash directly
& "C:\Program Files\Git\bin\bash.exe" scripts/setup-secrets-wizard.sh
```

The variable names (and which are secret) are documented in
[`.env.example`](.env.example). Never commit real values; `.env*` is
gitignored.

### Development server

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
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
