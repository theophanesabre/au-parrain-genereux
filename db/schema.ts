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
