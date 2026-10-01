import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase Edge Function environment is not configured." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authResult, error: authError } = await userClient.auth.getUser();
  const caller = authResult.user;
  if (authError || !caller) return jsonResponse({ error: "Invalid or expired session." }, 401);

  const { data: platformUser, error: platformError } = await adminClient
    .from("platform_superusers")
    .select("id")
    .eq("id", caller.id)
    .eq("is_active", true)
    .maybeSingle();
  if (platformError) return jsonResponse({ error: `Could not verify platform access: ${platformError.message}` }, 500);
  if (!platformUser) return jsonResponse({ error: "Platform superuser access required." }, 403);

  let body: { action?: string; orgId?: string; email?: string; organization?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  if (body.action === "correct-owner-email") {
    const orgId = String(body.orgId || "");
    const newEmail = String(body.email || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{1,50}$/.test(orgId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return jsonResponse({ error: "A valid organization ID and corrected owner email are required." }, 400);
    }

    const { data: organization, error: orgError } = await adminClient
      .from("organizations")
      .select("id, name, schema_name, superuser_email, status")
      .eq("id", orgId)
      .eq("status", "active")
      .maybeSingle();
    if (orgError) return jsonResponse({ error: `Could not load organization: ${orgError.message}` }, 500);
    if (!organization) return jsonResponse({ error: "Active organization not found." }, 404);

    let authUser: { id: string } | null = null;
    let correctedExistingOwner = false;
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(newEmail, {
      data: { full_name: `${organization.name} Administrator`, organization_id: orgId },
    });
    if (!inviteError && inviteData.user) {
      authUser = { id: inviteData.user.id };
    } else if (inviteError?.message.toLowerCase().includes("already") && inviteError.message.toLowerCase().includes("registered")) {
      const { data: users, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) return jsonResponse({ error: `Could not resolve existing Auth account: ${listError.message}` }, 500);
      const existing = users.users.find((user) => user.email?.toLowerCase() === newEmail);
      if (existing) authUser = { id: existing.id };
    } else if (inviteError?.message.toLowerCase().includes("rate limit")) {
      const { data: users, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) return jsonResponse({ error: `Invitation was rate-limited and the current owner account could not be checked: ${listError.message}` }, 429);
      const existingOwner = users.users.find((user) => user.email?.toLowerCase() === organization.superuser_email?.toLowerCase());
      if (!existingOwner || existingOwner.email_confirmed_at) {
        return jsonResponse({ error: `Invitation email rate limit exceeded. The existing owner Auth account is missing or already confirmed, so its email was not changed. Retry after the email rate limit resets.` }, 429);
      }

      const { data: updatedAuth, error: authUpdateError } = await adminClient.auth.admin.updateUserById(existingOwner.id, {
        email: newEmail,
        email_confirm: true,
        user_metadata: { ...existingOwner.user_metadata, full_name: `${organization.name} Administrator`, organization_id: orgId },
      });
      if (authUpdateError || !updatedAuth.user) {
        return jsonResponse({ error: `Invitation was rate-limited and the unconfirmed Auth account could not be corrected: ${authUpdateError?.message || "Auth user was not returned."}` }, 502);
      }
      authUser = { id: updatedAuth.user.id };
      correctedExistingOwner = true;
      inviteError.message = "Email delivery was rate-limited. The existing unconfirmed owner account was corrected; use password reset after the email limit clears to set access.";
    }
    if (!authUser) return jsonResponse({ error: `Owner invitation failed: ${inviteError?.message || "Auth user was not returned."}` }, 502);

    const { data: updated, error: updateError } = await adminClient.rpc("update_org_owner_email", {
      p_org_id: orgId,
      p_expected_email: organization.superuser_email,
      p_new_email: newEmail,
      p_auth_uid: authUser.id,
    });
    if (updateError || updated !== true) {
      return jsonResponse({ error: `Owner account was invited/resolved, but the tenant record was not updated: ${updateError?.message || "RPC returned false."}` }, 409);
    }

    return jsonResponse({
      success: true,
      orgId,
      schemaName: organization.schema_name,
      ownerEmail: newEmail,
      invitationStatus: correctedExistingOwner
        ? "email_corrected_invitation_rate_limited"
        : inviteError ? "existing_account_linked" : "invited",
      message: correctedExistingOwner
        ? inviteError.message
        : inviteError ? "Existing Auth account linked; no new invitation was sent." : "Owner invitation sent.",
    });
  }

  if (body.action === "set-owner-temporary-password") {
    const orgId = String(body.orgId || "");
    if (!/^[a-z0-9_]{1,50}$/.test(orgId)) {
      return jsonResponse({ error: "A valid organization ID is required." }, 400);
    }
    const { data: organization, error: orgError } = await adminClient
      .from("organizations")
      .select("id, name, schema_name, superuser_email, status")
      .eq("id", orgId)
      .eq("status", "active")
      .maybeSingle();
    if (orgError) return jsonResponse({ error: `Could not load organization: ${orgError.message}` }, 500);
    if (!organization?.schema_name) return jsonResponse({ error: "Active organization not found." }, 404);

    const { data: owner, error: ownerError } = await adminClient
      .schema(organization.schema_name)
      .from("users")
      .select("id, email, auth_uid, status")
      .eq("id", "USR-000")
      .maybeSingle();
    if (ownerError) return jsonResponse({ error: `Could not load tenant owner: ${ownerError.message}` }, 500);
    if (!owner || owner.status !== "Active" || !owner.auth_uid || owner.email.toLowerCase() !== organization.superuser_email.toLowerCase()) {
      return jsonResponse({ error: "The active owner record is not linked to an Auth account. Correct/link the owner email first." }, 409);
    }

    const randomBytes = crypto.getRandomValues(new Uint8Array(24));
    const temporaryPassword = `Fn!${Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}a7`;
    const { data: authUser, error: passwordError } = await adminClient.auth.admin.updateUserById(owner.auth_uid, {
      password: temporaryPassword,
      user_metadata: { password_change_required: true, organization_id: orgId },
    });
    if (passwordError || !authUser.user) {
      return jsonResponse({ error: `Could not set the one-time owner password: ${passwordError?.message || "Auth user not returned."}` }, 502);
    }

    return jsonResponse({
      success: true,
      orgId,
      ownerEmail: owner.email,
      temporaryPassword,
      message: "One-time password created. It must be changed immediately after the owner signs in.",
    });
  }

  const organization = body.organization;
  if (!organization || typeof organization !== "object") {
    return jsonResponse({ error: "Organization configuration is required." }, 400);
  }
  const orgId = String(organization.id || "");
  const orgName = String(organization.name || "");
  const ownerEmail = String(organization.superuserEmail || "").trim().toLowerCase();
  const ownerName = String(organization.ownerName || `${orgName} Administrator`).trim();
  const staff = Array.isArray(organization.staffUsers) ? organization.staffUsers as Array<Record<string, unknown>> : [];
  if (!/^[a-z0-9_]{1,50}$/.test(orgId) || !orgName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return jsonResponse({ error: "Organization ID, legal name, and valid owner email are required." }, 400);
  }

  const inviteTargets = [
    { email: ownerEmail, name: ownerName },
    ...staff.map((user) => ({ email: String(user.email || "").trim().toLowerCase(), name: String(user.name || "Staff member") })),
  ];
  const emailSet = new Set<string>();
  for (const target of inviteTargets) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email)) return jsonResponse({ error: `Invalid invitation email: ${target.email || "(blank)"}` }, 400);
    if (emailSet.has(target.email)) return jsonResponse({ error: `Invitation email is repeated: ${target.email}` }, 400);
    emailSet.add(target.email);
  }

  const { data: provisioned, error: provisionError } = await userClient.rpc("provision_org", {
    p_org_id: orgId,
    p_org_data: { ...organization, ownerName, superuserEmail: ownerEmail },
  });
  if (provisionError) return jsonResponse({ error: `Organization provisioning failed: ${provisionError.message}` }, 400);

  const schemaName = String(provisioned?.schema_name || "");
  const invitations: Array<{ email: string; status: string; message?: string }> = [];
  for (const target of inviteTargets) {
    let authUser: { id: string } | null = null;
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      target.email,
      {
        data: { full_name: target.name, organization_id: orgId },
      },
    );

    if (!inviteError && inviteData.user) {
      authUser = { id: inviteData.user.id };
    } else if (inviteError?.message.toLowerCase().includes("already") && inviteError.message.toLowerCase().includes("registered")) {
      const { data: users, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (!listError) {
        const existing = users.users.find((user) => user.email?.toLowerCase() === target.email);
        if (existing) authUser = { id: existing.id };
      }
    }

    if (authUser) {
      const { data: linked, error: linkError } = await adminClient.rpc("link_org_user_auth", {
        p_org_id: orgId,
        p_email: target.email,
        p_auth_uid: authUser.id,
      });
      if (linkError || linked !== true) {
        invitations.push({ email: target.email, status: "link_failed", message: linkError?.message || "Tenant user row was not linked." });
      } else {
        invitations.push({ email: target.email, status: inviteError ? "existing_account_linked" : "invited", ...(inviteError ? { message: "Existing Auth account linked; no new invite was sent." } : {}) });
      }
    } else {
      invitations.push({ email: target.email, status: "invite_failed", message: inviteError?.message || "Could not resolve Auth user." });
    }
  }

  return jsonResponse({ success: true, orgId, schemaName, invitations });
});
