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

async function sendSetupCode(mailClient: ReturnType<typeof createClient>, email: string) {
  const { error } = await mailClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  return error
    ? { status: "otp_failed", message: error.message }
    : { status: "otp_sent", message: "Email setup code sent." };
}

async function createOrFindAuthUser(
  adminClient: ReturnType<typeof createClient>,
  mailClient: ReturnType<typeof createClient>,
  email: string,
  name: string,
  orgId: string,
  sendCode = true,
) {
  const metadata = { full_name: name, organization_id: orgId, password_change_required: true };
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: metadata,
  });
  let authUser = created.user;

  if (!authUser && createError?.message.toLowerCase().includes("already")) {
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return { user: null, status: "account_lookup_failed", message: listError.message, created: false };
    authUser = users.users.find((user) => user.email?.toLowerCase() === email) || null;
  } else if (createError) {
    return { user: null, status: "account_create_failed", message: createError.message, created: false };
  }

  if (!authUser) return { user: null, status: "account_create_failed", message: "Auth user was not returned.", created: false };
  const wasCreated = !!created.user;
  if (authUser.email_confirmed_at) {
    return { user: authUser, status: "existing_account_linked", message: "Existing confirmed account linked; no setup code was sent.", created: wasCreated };
  }

  const { error: metadataError } = await adminClient.auth.admin.updateUserById(authUser.id, {
    user_metadata: { ...authUser.user_metadata, ...metadata },
  });
  if (metadataError) return { user: authUser, status: "otp_failed", message: metadataError.message, created: wasCreated };
  if (!sendCode) return { user: authUser, status: "otp_pending", message: "Email setup code pending.", created: wasCreated };
  return { user: authUser, ...await sendSetupCode(mailClient, email), created: wasCreated };
}

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
  const mailClient = createClient(supabaseUrl, anonKey, {
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

  let body: {
    action?: string;
    orgId?: string;
    email?: string;
    name?: string;
    roles?: string[];
    branchId?: string;
    branchName?: string;
    singleApprovalLimit?: number;
    dailyApprovalLimit?: number;
    organization?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  if (body.action === "create-tenant-user") {
    const orgId = String(body.orgId || "");
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const roleIds = Array.isArray(body.roles) ? [...new Set(body.roles.map(String))] : [];
    const branchId = String(body.branchId || "");
    const branchName = String(body.branchName || "");
    const singleApprovalLimit = Number(body.singleApprovalLimit) || 0;
    const dailyApprovalLimit = Number(body.dailyApprovalLimit) || 0;
    if (!/^[a-z0-9_]{1,50}$/.test(orgId) || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !branchId || !roleIds.length) {
      return jsonResponse({ error: "Organization, name, email, branch, and at least one role are required." }, 400);
    }
    if (singleApprovalLimit < 0 || dailyApprovalLimit < 0) return jsonResponse({ error: "Approval limits cannot be negative." }, 400);

    const { data: organization, error: orgError } = await adminClient
      .from("organizations")
      .select("id, schema_name, status")
      .eq("id", orgId)
      .eq("status", "active")
      .maybeSingle();
    if (orgError) return jsonResponse({ error: `Could not load organization: ${orgError.message}` }, 500);
    if (!organization?.schema_name) return jsonResponse({ error: "Active organization not found." }, 404);

    let auditUserId = caller.id;
    let auditUserName = caller.email || "Platform superuser";
    if (!platformUser) {
      const { data: actor, error: actorError } = await adminClient
        .schema(organization.schema_name)
        .from("users")
        .select("id, name, roles, status")
        .eq("auth_uid", caller.id)
        .maybeSingle();
      if (actorError) return jsonResponse({ error: `Could not verify organization permissions: ${actorError.message}` }, 500);
      if (!actor || actor.status !== "Active") return jsonResponse({ error: "Active organization user required." }, 403);
      auditUserId = actor.id;
      auditUserName = actor.name;

      const actorRoleIds = Array.isArray(actor.roles) ? actor.roles.map(String) : [];
      const { data: actorRoles, error: actorRolesError } = await adminClient
        .schema(organization.schema_name)
        .from("roles")
        .select("permissions")
        .in("id", actorRoleIds);
      if (actorRolesError) return jsonResponse({ error: `Could not verify user-management permission: ${actorRolesError.message}` }, 500);
      const permissions = (actorRoles || []).flatMap((role) => Array.isArray(role.permissions) ? role.permissions : []);
      if (!permissions.includes("MANAGE_USERS") && !permissions.includes("READ_ALL_MODULES")) {
        return jsonResponse({ error: "Manage-users permission required." }, 403);
      }
    }

    const { data: roles, error: rolesError } = await adminClient
      .schema(organization.schema_name)
      .from("roles")
      .select("id")
      .in("id", roleIds);
    if (rolesError) return jsonResponse({ error: `Could not validate assigned roles: ${rolesError.message}` }, 500);
    if ((roles || []).length !== roleIds.length) return jsonResponse({ error: "One or more assigned roles do not exist in this organization." }, 400);
    const { data: branch, error: branchError } = await adminClient
      .schema(organization.schema_name)
      .from("branches")
      .select("id, name")
      .eq("id", branchId)
      .maybeSingle();
    if (branchError) return jsonResponse({ error: `Could not validate branch: ${branchError.message}` }, 500);
    if (!branch) return jsonResponse({ error: "Selected branch does not exist in this organization." }, 400);

    const { data: duplicate, error: duplicateError } = await adminClient
      .schema(organization.schema_name)
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (duplicateError) return jsonResponse({ error: `Could not check existing organization user: ${duplicateError.message}` }, 500);
    if (duplicate) return jsonResponse({ error: "An organization user with this email already exists." }, 409);

    const setup = await createOrFindAuthUser(adminClient, mailClient, email, name, orgId, false);
    if (!setup.user) return jsonResponse({ error: `Auth account setup failed: ${setup.message}` }, 502);
    const newUserId = `USR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error: insertError } = await adminClient
      .schema(organization.schema_name)
      .from("users")
      .insert([{
        id: newUserId,
        name,
        email,
        roles: roleIds,
        branchId,
        branchName: branch.name || branchName,
        singleApprovalLimit,
        dailyApprovalLimit,
        status: "Active",
        mfaEnabled: true,
        lastLogin: new Date().toISOString(),
        auth_uid: setup.user.id,
      }]);
    if (insertError) {
      if (setup.created) await adminClient.auth.admin.deleteUser(setup.user.id);
      return jsonResponse({ error: `Could not add the organization user: ${insertError.message}` }, 409);
    }

    const { error: auditError } = await adminClient
      .schema(organization.schema_name)
      .from("audit_trail")
      .insert([{
        id: `AUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        userId: auditUserId,
        userName: auditUserName,
        action: "NEW_SYSTEM_USER_CREATED",
        module: "User Administration (RBAC)",
        entityId: newUserId,
        description: `Created user ${name} with ${roleIds.length} role(s).`,
      }]);
    if (auditError) console.warn("Could not record tenant user creation audit event:", auditError.message);

    let status = setup.status;
    let message = setup.message;
    if (setup.status === "otp_pending") {
      const setupCode = await sendSetupCode(mailClient, email);
      status = setupCode.status;
      message = setupCode.message;
    }
    return jsonResponse({ success: true, userId: newUserId, status, message });
  }

  if (!platformUser) return jsonResponse({ error: "Platform superuser access required." }, 403);

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

    const setup = await createOrFindAuthUser(
      adminClient,
      mailClient,
      newEmail,
      `${organization.name} Administrator`,
      orgId,
      false,
    );
    if (!setup.user) return jsonResponse({ error: `Owner account setup failed: ${setup.message}` }, 502);

    const { data: updated, error: updateError } = await adminClient.rpc("update_org_owner_email", {
      p_org_id: orgId,
      p_expected_email: organization.superuser_email,
      p_new_email: newEmail,
      p_auth_uid: setup.user.id,
    });
    if (updateError || updated !== true) {
      return jsonResponse({ error: `Owner account was prepared, but the tenant record was not updated: ${updateError?.message || "RPC returned false."}` }, 409);
    }
    if (setup.status === "otp_pending") Object.assign(setup, await sendSetupCode(mailClient, newEmail));

    return jsonResponse({
      success: true,
      orgId,
      schemaName: organization.schema_name,
      ownerEmail: newEmail,
      invitationStatus: setup.status,
      message: setup.message,
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

    const { data: authResult, error: authError } = await adminClient.auth.admin.getUserById(owner.auth_uid);
    if (authError || !authResult.user) return jsonResponse({ error: `Could not load the owner Auth account: ${authError?.message || "Auth user not returned."}` }, 502);
    const { error: metadataError } = await adminClient.auth.admin.updateUserById(owner.auth_uid, {
      user_metadata: {
        ...authResult.user.user_metadata,
        organization_id: orgId,
        password_change_required: true,
      },
    });
    if (metadataError) return jsonResponse({ error: `Could not mark owner for password setup: ${metadataError.message}` }, 502);
    const setupCode = await sendSetupCode(mailClient, owner.email);
    if (setupCode.status !== "otp_sent") return jsonResponse({ error: `Could not send owner setup code: ${setupCode.message}` }, 502);

    return jsonResponse({
      success: true,
      orgId,
      ownerEmail: owner.email,
      message: "Email setup code sent. The owner must set a personal password after verification.",
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
    const setup = await createOrFindAuthUser(adminClient, mailClient, target.email, target.name, orgId, false);
    if (setup.user) {
      const { data: linked, error: linkError } = await adminClient.rpc("link_org_user_auth", {
        p_org_id: orgId,
        p_email: target.email,
        p_auth_uid: setup.user.id,
      });
      if (linkError || linked !== true) {
        invitations.push({ email: target.email, status: "link_failed", message: linkError?.message || "Tenant user row was not linked." });
      } else {
        if (setup.status === "otp_pending") Object.assign(setup, await sendSetupCode(mailClient, target.email));
        invitations.push({ email: target.email, status: setup.status, ...(setup.message ? { message: setup.message } : {}) });
      }
    } else {
      invitations.push({ email: target.email, status: setup.status, message: setup.message || "Could not resolve Auth user." });
    }
  }

  return jsonResponse({ success: true, orgId, schemaName, invitations });
});
