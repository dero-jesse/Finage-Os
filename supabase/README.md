# Supabase organization provisioning and invitations

## One-time project setup

1. Run the complete, updated `platform_schema.sql` in the Supabase SQL Editor. It installs the atomic `provision_org` RPC and the service-role-only `link_org_user_auth` RPC.
2. Configure Supabase Auth email delivery with production SMTP in **Authentication → SMTP Settings**. Also allow the deployed app URL under **Authentication → URL Configuration → Redirect URLs**.
3. Install the Supabase CLI and link this project to the intended Supabase project:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Set the app URL used by invitation links and deploy the function:

   ```sh
   supabase secrets set SITE_URL=https://your-app.example.com
   supabase functions deploy provision-organization
   ```

   Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Never put the service-role key in browser code or commit it to this repository.

## Provisioning behavior

The platform superuser submits organization, owner, branch, role, GL, and initial staff details from the Setup Wizard. The Edge Function verifies the signed-in user against `platform_superusers`, calls the atomic PostgreSQL RPC, sends an Auth invitation to the organization owner and each initial staff member, then links each Auth user ID to the seeded tenant user row. Existing Auth accounts are linked without sending a duplicate invitation.

If database provisioning succeeds but an invitation fails, the organization remains provisioned and the wizard reports the affected email and status. Configure SMTP and retry that invitation from Supabase Auth or add a dedicated resend-invitation action before production use.
