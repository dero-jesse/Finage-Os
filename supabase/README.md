# Supabase organization provisioning and invitations

## One-time project setup

1. Run the complete, updated `platform_schema.sql` in the Supabase SQL Editor. It installs the atomic `provision_org` RPC and the service-role-only `link_org_user_auth` RPC.
2. Configure Supabase Auth email delivery with production SMTP in **Authentication → SMTP Settings**. In **Authentication → Email Templates → Magic Link**, use a code-based message containing `{{ .Token }}` (not only `{{ .ConfirmationURL }}`), for example:

   ```html
   <p>Your Finage OS setup code is <strong>{{ .Token }}</strong>.</p>
   <p>Enter this code on the Finage OS sign-in screen. You will be asked to set a personal password.</p>
   ```

   Also allow the deployed app URL under **Authentication → URL Configuration → Redirect URLs**. For local development, allow `http://localhost:4173/` (or the exact local origin and port you use).
3. Install the Supabase CLI and link this project to the intended Supabase project:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Deploy the function:

   ```sh
   supabase functions deploy provision-organization
   ```

   Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Never put the service-role key in browser code or commit it to this repository.

## Provisioning behavior

The platform superuser submits organization, owner, branch, role, GL, and initial staff details from the Setup Wizard. The Edge Function verifies the signed-in user against `platform_superusers`, calls the atomic PostgreSQL RPC, creates pending Auth accounts, and links each Auth user ID to the seeded tenant user row. It then sends a one-time email code to each pending account. After code verification, new users must set a personal password before entering the app. Already-confirmed Auth accounts are linked without resetting their existing password.

If database provisioning succeeds but code delivery fails, the organization remains provisioned and the wizard reports the affected email and status. The user can request another code from the app's **Use an email code** sign-in option; SMTP and the Magic Link template must be configured first.
