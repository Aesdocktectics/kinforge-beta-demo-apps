import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(), email: text("email").notNull(), name: text("name").notNull(),
  password: text("password").notNull(), recoveryHash: text("recovery_hash").notNull(),
  createdAt: integer("created_at").notNull(),
  termsAcceptedAt: integer("terms_accepted_at"),
  termsVersion: text("terms_version"),
  privacyAcceptedAt: integer("privacy_accepted_at"),
  privacyVersion: text("privacy_version")
}, t => [uniqueIndex("accounts_email").on(t.email)]);
export const sessions = sqliteTable("sessions", {
  hash: text("hash").primaryKey(), userId: text("user_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull()
}, t => [index("sessions_user").on(t.userId)]);
export const authCodes = sqliteTable("auth_codes", {
  hash: text("hash").primaryKey(), accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(), expiresAt: integer("expires_at").notNull(), usedAt: integer("used_at"), createdAt: integer("created_at").notNull()
}, t => [index("auth_codes_account").on(t.accountId, t.purpose, t.expiresAt)]);
export const libraries = sqliteTable("libraries", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(() => accounts.id),
  name: text("name").notNull(), revision: integer("revision").notNull().default(0),
  objectKey: text("object_key"), updatedAt: integer("updated_at").notNull()
}, t => [uniqueIndex("libraries_owner").on(t.ownerId)]);
export const members = sqliteTable("library_members", {
  libraryId: text("library_id").notNull().references(() => libraries.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  role: text("role").notNull()
}, t => [primaryKey({ columns: [t.libraryId, t.userId] }), index("members_user").on(t.userId)]);
export const invitations = sqliteTable("library_invitations", {
  hash: text("hash").primaryKey(), libraryId: text("library_id").notNull().references(() => libraries.id, { onDelete: "cascade" }),
  role: text("role").notNull(), expiresAt: integer("expires_at").notNull(), usedBy: text("used_by")
}, t => [index("invitations_library").on(t.libraryId)]);
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull()
});

export const driveConnections = sqliteTable("drive_connections", {
  id: text("id").primaryKey(), libraryId: text("library_id").notNull().references(() => libraries.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), credentials: text("credentials").notNull(),
  folderId: text("folder_id"), manifestId: text("manifest_id"), manifestHash: text("manifest_hash"),
  syncedRevision: integer("synced_revision").notNull().default(-1), enabled: integer("enabled").notNull().default(1),
  status: text("status").notNull().default("pending"), error: text("error"), lastSync: integer("last_sync"),
  lease: text("lease"), leaseUntil: integer("lease_until").notNull().default(0),
  retryAt: integer("retry_at").notNull().default(0), createdAt: integer("created_at").notNull()
}, t => [uniqueIndex("drive_connections_library_provider").on(t.libraryId, t.provider)]);
export const driveAuthorizations = sqliteTable("drive_authorizations", {
  hash: text("hash").primaryKey(), libraryId: text("library_id").notNull().references(() => libraries.id, { onDelete: "cascade" }),
  sessionHash: text("session_hash").notNull(), provider: text("provider").notNull(), verifier: text("verifier").notNull(),
  browserHash: text("browser_hash"), phase: text("phase").notNull().default("start"), expiresAt: integer("expires_at").notNull()
});
export const driveFiles = sqliteTable("drive_files", {
  connectionId: text("connection_id").notNull().references(() => driveConnections.id, { onDelete: "cascade" }),
  path: text("path").notNull(), remoteId: text("remote_id").notNull(), hash: text("hash").notNull(), remoteVersion: text("remote_version").notNull().default("")
}, t => [primaryKey({ columns: [t.connectionId, t.path] })]);
export const libraryExports = sqliteTable("library_exports", {
  id: text("id").primaryKey(), libraryId: text("library_id").notNull().references(() => libraries.id, { onDelete: "cascade" }),
  name: text("name").notNull(), category: text("category").notNull(), mime: text("mime").notNull(),
  objectKey: text("object_key").notNull(), hash: text("hash").notNull(), size: integer("size").notNull(),
  createdAt: integer("created_at").notNull()
}, t => [index("library_exports_library").on(t.libraryId, t.createdAt)]);

export const paymentEvents = sqliteTable("payment_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerEventId: text("provider_event_id"),
  source: text("source").notNull().default("manual"),
  status: text("status").notNull(),
  product: text("product").notNull(),
  tier: text("tier"),
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  currency: text("currency").notNull(),
  amount: integer("amount").notNull(),
  fee: integer("fee").notNull().default(0),
  net: integer("net").notNull(),
  paidAt: integer("paid_at").notNull(),
  createdAt: integer("created_at").notNull()
}, t => [
  index("payment_events_paid").on(t.paidAt),
  index("payment_events_currency").on(t.currency, t.paidAt),
  uniqueIndex("payment_events_provider_event").on(t.provider, t.providerEventId)
]);

export const specialAccessCodes = sqliteTable("special_access_codes", {
  hash: text("hash").primaryKey(),
  label: text("label").notNull(),
  recipientEmail: text("recipient_email"),
  note: text("note"),
  createdBy: text("created_by").notNull().references(() => accounts.id),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at"),
  maxUses: integer("max_uses").notNull().default(1),
  useCount: integer("use_count").notNull().default(0),
  revokedAt: integer("revoked_at"),
  lastRedeemedBy: text("last_redeemed_by").references(() => accounts.id),
  lastRedeemedAt: integer("last_redeemed_at")
}, t => [
  index("special_access_codes_created").on(t.createdAt),
  index("special_access_codes_recipient").on(t.recipientEmail)
]);

export const newsletterSubscribers = sqliteTable("newsletter_subscribers", {
  accountId: text("account_id").primaryKey().references(() => accounts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  status: text("status").notNull().default("subscribed"),
  source: text("source").notNull().default("account"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
}, t => [
  index("newsletter_subscribers_status").on(t.status, t.updatedAt),
  index("newsletter_subscribers_email").on(t.email)
]);

export const newsletterReleases = sqliteTable("newsletter_releases", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  summary: text("summary"),
  status: text("status").notNull(),
  objectKey: text("object_key").notNull(),
  attachmentCount: integer("attachment_count").notNull().default(0),
  size: integer("size").notNull().default(0),
  createdBy: text("created_by").notNull().references(() => accounts.id),
  createdAt: integer("created_at").notNull(),
  releasedAt: integer("released_at"),
  recipientCount: integer("recipient_count").notNull().default(0),
  deliveryStatus: text("delivery_status").notNull().default("published-only-email-not-configured")
}, t => [
  index("newsletter_releases_created").on(t.createdAt),
  index("newsletter_releases_status").on(t.status, t.createdAt)
]);

export const supportTickets = sqliteTable("support_tickets", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  subject: text("subject").notNull(),
  name: text("name"),
  email: text("email"),
  message: text("message").notNull(),
  device: text("device"),
  treeTitle: text("tree_title"),
  proof: text("proof"),
  permissionToReply: integer("permission_to_reply").notNull().default(1),
  diagnostics: text("diagnostics"),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  deliveryStatus: text("delivery_status").notNull().default("serene-relay-not-configured"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  lastReplyAt: integer("last_reply_at")
}, t => [
  index("support_tickets_status").on(t.status, t.updatedAt),
  index("support_tickets_email").on(t.email),
  index("support_tickets_created").on(t.createdAt)
]);

export const supportReplies = sqliteTable("support_replies", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => accounts.id),
  authorEmail: text("author_email").notNull(),
  message: text("message").notNull(),
  deliveryStatus: text("delivery_status").notNull().default("stored-only"),
  createdAt: integer("created_at").notNull()
}, t => [
  index("support_replies_ticket").on(t.ticketId, t.createdAt)
]);
