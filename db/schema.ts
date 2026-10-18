import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const products = sqliteTable('products', {
  id: text('id').primaryKey(), name: text('name').notNull(), description: text('description').notNull(),
  photoCrops: text('photo_crops').notNull().default('{}'), images: text('images').notNull().default('[]'), archived: integer('archived').notNull().default(0),
  weight: text('weight').notNull().default(''), conservation: text('conservation').notNull().default(''),
  ingredients: text('ingredients').notNull().default(''), allergens: text('allergens').notNull().default(''),
  priceCents: integer('price_cents').notNull(), stock: integer('stock').notNull().default(0),
  image: text('image').notNull().default(''), published: integer('published').notNull().default(0),
  version: integer('version').notNull().default(1),
});
export const pages = sqliteTable('pages', {
  id: text('id').primaryKey(), title: text('title').notNull(), body: text('body').notNull(),
  published: integer('published').notNull().default(0), version: integer('version').notNull().default(1),
});
export const images = sqliteTable('images', {
  id: text('id').primaryKey(), alt: text('alt').notNull(), type: text('type').notNull(), size: integer('size').notNull(),
});
export const orders = sqliteTable('orders', {
  paymentStatus:text('payment_status').notNull().default('unpaid'),stripeSessionId:text('stripe_session_id').unique(),stripePaymentIntent:text('stripe_payment_intent'),paymentMode:text('payment_mode'),delivery:text('delivery'),shippingAddress:text('shipping_address'),shippingCents:integer('shipping_cents').notNull().default(0),
  id: text('id').primaryKey(), customer: text('customer').notNull(), contact: text('contact').notNull(),
  items: text('items').notNull(), totalCents: integer('total_cents').notNull(),
  status: text('status').notNull().default('draft'), createdAt: text('created_at').notNull(),
  version: integer('version').notNull().default(1),
});
export const audit = sqliteTable('audit', {
  id: text('id').primaryKey(), actor: text('actor').notNull(), action: text('action').notNull(),
  target: text('target').notNull(), createdAt: text('created_at').notNull(),
});

export const adminAccess = sqliteTable('admin_access', {
  slot: integer('slot').primaryKey(), userId: text('user_id').notNull(), createdAt: text('created_at').notNull(),
});

export const imageReplacements = sqliteTable('image_replacements', {
  original: text('original').primaryKey(), imageId: text('image_id').notNull().references(() => images.id),
});

export const highlights = sqliteTable('highlights', {
  id: text('id').primaryKey(), placement: text('placement').notNull(), kicker: text('kicker').notNull().default(''),
  title: text('title').notNull(), description: text('description').notNull().default(''),
  image: text('image').notNull(), alt: text('alt').notNull(), imageFit: text('image_fit').notNull().default('cover'),
  buttonLabel: text('button_label').notNull(), href: text('href').notNull(), position: integer('position').notNull().default(0),
  published: integer('published').notNull().default(0), version: integer('version').notNull().default(1),
});

export const siteSettings = sqliteTable('site_settings', {
  id: text('id').primaryKey(), body: text('body').notNull(), version: integer('version').notNull().default(1),
});

export const puckPages = sqliteTable('puck_pages', {
  path: text('path').primaryKey(), published: text('published'), draft: text('draft'),
  version: integer('version').notNull().default(1),
});

export const paymentSettings=sqliteTable('payment_settings',{
 id:text('id').primaryKey(),secret:text('secret').notNull(),webhookSecret:text('webhook_secret').notNull(),
 accountId:text('account_id').notNull(),endpointId:text('endpoint_id').notNull(),mode:text('mode').notNull(),
 enabled:integer('enabled').notNull().default(0),shippingCents:integer('shipping_cents'),countries:text('countries').notNull().default('[]'),version:integer('version').notNull().default(1),
});
export const checkoutAttempts=sqliteTable('checkout_attempts',{
 id:text('id').primaryKey(),params:text('params').notNull(),requester:text('requester').notNull(),sessionId:text('session_id').unique(),fingerprint:text('fingerprint').notNull(),items:text('items').notNull(),
 totalCents:integer('total_cents').notNull(),shippingCents:integer('shipping_cents').notNull(),delivery:text('delivery').notNull(),mode:text('mode').notNull(),
 status:text('status').notNull().default('creating'),createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull(),
});
export const stripeRefunds=sqliteTable('stripe_refunds',{
 paymentIntent:text('payment_intent').primaryKey(),createdAt:text('created_at').notNull(),
});
