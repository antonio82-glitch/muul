/**
 * Múul — Database schema
 * 14 tablas. Cada una con un propósito específico.
 *
 * Convenciones:
 * - PKs: uuid generado en la base
 * - Timestamps: timestamptz (siempre con TZ)
 * - Dinero: bigint en cents (nunca float)
 * - PostGIS: tipo custom `geography(Point, 4326)`
 *
 * IMPORTANTE: las RLS policies viven en `migrations/0001_rls.sql`,
 * no en este schema. Drizzle no las maneja.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  bigint,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  primaryKey,
  unique,
  customType,
  index,
} from "drizzle-orm/pg-core";

// ─── PostGIS geography type ─────────────────────────────────
// Drizzle no tiene PostGIS nativo. Custom type que se mapea a
// `geography(Point, 4326)` y acepta { lng, lat } en JS.
export const geography = customType<{
  data: { lng: number; lat: number };
  driverData: string;
}>({
  dataType() {
    return "geography(Point, 4326)";
  },
  toDriver(value) {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value) {
    // Postgres devuelve "0101000020E6100000..." (WKB hex)
    // En queries usamos ST_X / ST_Y para extraer; aquí dejamos null-safe.
    return { lng: 0, lat: 0 };
  },
});

// ─── Enums (como text + check constraint en la app) ─────────
export const userRoles = ["customer", "merchant_owner", "merchant_staff", "admin"] as const;
export const merchantStatus = ["pending", "kyc_required", "active", "suspended"] as const;
export const listingType = ["product", "service"] as const;
export const listingStatus = ["draft", "live", "archived"] as const;
export const orderStatus = ["pending", "paid", "fulfilling", "completed", "refunded", "cancelled"] as const;
export const bookingStatus = ["confirmed", "redeemed", "no_show", "cancelled"] as const;
export const notificationChannel = ["email", "whatsapp", "push", "sms"] as const;
export const currency = ["MXN", "USD", "EUR"] as const;

// ─── 01 · users ─────────────────────────────────────────────
// Espejo de la tabla `auth.users` de Supabase. El id coincide con
// el UUID que Supabase Auth emite. Nunca insertes aquí desde la app
// directamente — usa un trigger en SQL (ver migración 0002).
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    role: text("role", { enum: userRoles }).notNull().default("customer"),
    locale: text("locale", { enum: ["es", "en"] }).notNull().default("es"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
  }),
);

// ─── 02 · categories ────────────────────────────────────────
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  nameEs: text("name_es").notNull(),
  nameEn: text("name_en").notNull(),
  parentId: uuid("parent_id"),
  iconKey: text("icon_key"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── 03 · merchants ─────────────────────────────────────────
export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    descriptionEn: text("description_en"),
    categoryId: uuid("category_id").references(() => categories.id),
    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),

    // Ubicación física (geo + dirección legible)
    address: text("address"),
    city: text("city"),
    location: geography("location"),

    // Contacto
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    whatsapp: text("whatsapp"),

    // Stripe Connect
    stripeAccountId: text("stripe_account_id").unique(),
    stripeOnboarded: boolean("stripe_onboarded").notNull().default(false),
    stripePayoutsEnabled: boolean("stripe_payouts_enabled").notNull().default(false),

    // Comisión específica por comercio (override del default)
    commissionPct: numeric("commission_pct", { precision: 4, scale: 3 }).notNull().default("0.080"),

    status: text("status", { enum: merchantStatus }).notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: index("merchants_slug_idx").on(t.slug),
    statusIdx: index("merchants_status_idx").on(t.status),
    locationIdx: index("merchants_location_idx").using("gist", t.location),
  }),
);

// ─── 04 · merchant_users ────────────────────────────────────
// Relación muchos-a-muchos: un usuario puede administrar varios
// comercios y un comercio puede tener varios admins.
export const merchantUsers = pgTable(
  "merchant_users",
  {
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "manager", "staff"] }).notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.merchantId, t.userId] }),
  }),
);

// ─── 05 · listings (parent) ─────────────────────────────────
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    type: text("type", { enum: listingType }).notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    titleEn: text("title_en"),
    description: text("description"),
    descriptionEn: text("description_en"),
    priceCents: bigint("price_cents", { mode: "number" }).notNull(),
    currency: text("currency", { enum: currency }).notNull().default("MXN"),
    images: text("images").array().notNull().default(sql`'{}'::text[]`),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    status: text("status", { enum: listingStatus }).notNull().default("draft"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantSlugUq: unique("listings_merchant_slug_uq").on(t.merchantId, t.slug),
    statusIdx: index("listings_status_idx").on(t.status),
    typeIdx: index("listings_type_idx").on(t.type),
  }),
);

// ─── 06 · products (subtype) ────────────────────────────────
export const products = pgTable("products", {
  listingId: uuid("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  sku: text("sku"),
  inventoryQty: integer("inventory_qty").notNull().default(0),
  weightG: integer("weight_g"),
  variants: jsonb("variants").$type<Array<{ name: string; options: string[] }>>().default([]),
  shippable: boolean("shippable").notNull().default(true),
});

// ─── 07 · services (subtype) ────────────────────────────────
export const services = pgTable("services", {
  listingId: uuid("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  durationMin: integer("duration_min").notNull(),
  capacity: integer("capacity").notNull().default(1),
  advanceHours: integer("advance_hours").notNull().default(2),
  // Reglas semanales: { mon: [{open: "09:00", close: "18:00"}], ... }
  schedule: jsonb("schedule").$type<Record<string, Array<{ open: string; close: string }>>>().default({}),
  meetingPoint: text("meeting_point"),
});

// ─── 08 · availability_slots ────────────────────────────────
// Slots concretos que se generan a partir del schedule del servicio.
// Una boutique no usa esta tabla; un spa o tour, sí.
export const availabilitySlots = pgTable(
  "availability_slots",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    serviceListingId: uuid("service_listing_id")
      .notNull()
      .references(() => services.listingId, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    capacityRemaining: integer("capacity_remaining").notNull(),
    priceCentsOverride: bigint("price_cents_override", { mode: "number" }),
  },
  (t) => ({
    serviceTimeIdx: index("slots_service_time_idx").on(t.serviceListingId, t.startsAt),
  }),
);

// ─── 09 · orders ────────────────────────────────────────────
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    customerId: uuid("customer_id").references(() => users.id),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),
    status: text("status", { enum: orderStatus }).notNull().default("pending"),
    currency: text("currency", { enum: currency }).notNull(),

    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull(),
    feeCents: bigint("fee_cents", { mode: "number" }).notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),

    // Stripe
    paymentIntentId: text("payment_intent_id").unique(),
    paymentMethod: text("payment_method"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    escrowReleasedAt: timestamp("escrow_released_at", { withTimezone: true }),

    // Contacto del comprador (snapshot, por si no es usuario registrado)
    customerEmail: text("customer_email").notNull(),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),

    notes: text("notes"),
    metadata: jsonb("metadata").default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantStatusIdx: index("orders_merchant_status_idx").on(t.merchantId, t.status),
    customerIdx: index("orders_customer_idx").on(t.customerId),
  }),
);

// ─── 10 · order_items ───────────────────────────────────────
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id),
  // Snapshot del listing al momento de comprar (precio puede cambiar después)
  titleSnapshot: text("title_snapshot").notNull(),
  qty: integer("qty").notNull().default(1),
  unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
  variantSelected: jsonb("variant_selected"),
  bookingId: uuid("booking_id"),
});

// ─── 11 · bookings ──────────────────────────────────────────
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => availabilitySlots.id),
    orderItemId: uuid("order_item_id").references(() => orderItems.id),
    customerId: uuid("customer_id").references(() => users.id),
    partySize: integer("party_size").notNull().default(1),
    status: text("status", { enum: bookingStatus }).notNull().default("confirmed"),
    qrToken: text("qr_token").notNull().unique(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slotIdx: index("bookings_slot_idx").on(t.slotId),
    qrIdx: index("bookings_qr_idx").on(t.qrToken),
  }),
);

// ─── 12 · reviews ───────────────────────────────────────────
// Solo se pueden crear si la orden está en status "completed".
// Reglas en RLS, no en la app.
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id)
      .unique(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),
    authorId: uuid("author_id").references(() => users.id),
    rating: integer("rating").notNull(),
    body: text("body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantIdx: index("reviews_merchant_idx").on(t.merchantId),
  }),
);

// ─── 13 · pickup_points ─────────────────────────────────────
export const pickupPoints = pgTable(
  "pickup_points",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    address: text("address").notNull(),
    location: geography("location").notNull(),
    hours: jsonb("hours").$type<Record<string, Array<{ open: string; close: string }>>>().default({}),
    instructions: text("instructions"),
    active: boolean("active").notNull().default(true),
  },
  (t) => ({
    locationIdx: index("pickup_location_idx").using("gist", t.location),
  }),
);

// ─── 14 · notifications ─────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  channel: text("channel", { enum: notificationChannel }).notNull(),
  template: text("template").notNull(),
  payload: jsonb("payload").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Type exports ───────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Category = typeof categories.$inferSelect;
