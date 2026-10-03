# Supabase organization provisioning and invitations

## One-time project setup

1. Run the complete, updated `platform_schema.sql` in the Supabase SQL Editor. It installs the atomic `provision_org` RPC and the service-role-only `link_org_user_auth` RPC.
2. Resend requires a verified sending domain before SMTP sending. Add a domain or subdomain you control in Resend, publish the SPF and DKIM DNS records it provides at your DNS provider, and wait until Resend marks the domain verified. Add a DMARC record as well, starting with a monitoring policy if the domain does not already have one. A Gmail address can be the recipient for testing, but cannot be used as the verified sender domain.
3. In Supabase **Authentication → SMTP Settings**, enable custom SMTP and enter the Resend values:

   | Setting | Value |
   | --- | --- |
   | Host | `smtp.resend.com` |
   | Port | `465` (implicit TLS) or `587` (STARTTLS) |
   | Username | `resend` |
   | Password | Your Resend API key with email-sending permission; enter it only in the Supabase dashboard |
   | Sender email | A sender on the verified domain, such as `auth@your-domain.example` |
   | Sender name | `Finage OS` |

   For a limited test before domain verification, Resend's documented sample sender is `onboarding@resend.dev`. Do not use it for production; replace it with an address on your verified domain before onboarding real users. The SMTP password must be a Resend API key. If changing providers, replace the existing stored password in Supabase rather than assuming it is already correct.

   In **Authentication → Email Templates → Magic Link**, use a code-based message containing `{{ .Token }}` (not only `{{ .ConfirmationURL }}`), for example:

   ```html
   <p>Your Finage OS setup code is <strong>{{ .Token }}</strong>.</p>
   <p>Enter this code on the Finage OS sign-in screen. You will be asked to set a personal password.</p>
   ```

   Under **Authentication → URL Configuration**, set the Site URL to `https://finage-os.vercel.app`. Add `https://finage-os.vercel.app/**` to Redirect URLs. If Vercel preview deployments need auth callbacks, add a narrowly scoped preview pattern for this project as well. Add local URLs only for development: this repository's dev server uses `http://localhost:4173/`; add `http://localhost:3000/` only if you use that port locally. The Vercel app hostname is separate from the Resend sender domain, which must be a domain you control and verify for production email.
4. Install the Supabase CLI and link this project to the intended Supabase project:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

5. Deploy the function:

   ```sh
   supabase functions deploy provision-organization
   ```

   Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Never put the service-role key in browser code or commit it to this repository.

## Provisioning behavior

The platform superuser submits organization, owner, branch, role, GL, and initial staff details from the Setup Wizard. The Edge Function verifies the signed-in user against `platform_superusers`, calls the atomic PostgreSQL RPC, creates pending Auth accounts, and links each Auth user ID to the seeded tenant user row. It then sends a one-time email code to each pending account. After code verification, new users must set a personal password before entering the app. Already-confirmed Auth accounts are linked without resetting their existing password.

If database provisioning succeeds but code delivery fails, the organization remains provisioned and the wizard reports the affected email and status. The user can request another code from the app's **Use an email code** sign-in option; SMTP and the Magic Link template must be configured first.
