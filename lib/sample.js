// Fixed demo input: a fictional candidate and a fictional job post.
// /api/sample uses only this data, so the open endpoint cannot be used to run arbitrary prompts.

export const SAMPLE_VACANCY = `Senior Product Manager — Payments Platform (ExamplePay)
ExamplePay builds payment infrastructure for online merchants across Europe.
Requirements:
- 4+ years of product management in fintech or payments
- Hands-on experience with card acquiring and PSP integrations
- Experience writing API-first product requirements with engineering teams
- Fluent English
Nice to have:
- Experience with fraud and chargeback tooling
- German
Remote within Europe.`;

export const SAMPLE_PROFILE = {
  resume: `Alex Example — Product Manager
Product Manager, Acme Pay (payments app), Jan 2021 – Dec 2025: owned checkout and card payments; integrated 3 PSPs (Stripe, Adyen, Checkout.com); wrote API specs with backend team.
Business Analyst, Beta Soft (B2B banking SaaS), Jan 2019 – Dec 2020: requirements for KYC onboarding.
Tools: Jira, SQL, Figma. English C1.`,
  geography: "Europe, remote",
  domains: "fintech, payments",
  redFlags: "",
  notes: "",
};
