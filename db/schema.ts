import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const products = sqliteTable('products', {
  id: text('id').primaryKey(), name: text('name').notNull(), description: text('description').notNull(),
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
