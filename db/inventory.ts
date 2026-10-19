// Declarative models for the dedicated laboratory ledger. Trigger invariants live
// in migration 0033; Drizzle cannot express transactional ledger triggers.
import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const productionUsers=sqliteTable('sp_users',{
 userId:text('user_id').primaryKey(),name:text('name').notNull(),role:text('role',{enum:['laboratory','shop']}).notNull(),
 active:integer('active').notNull().default(1),version:integer('version').notNull().default(1),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),
});
export const productionReferences=sqliteTable('sp_references',{
 id:text('id').primaryKey(),name:text('name').notNull(),category:text('category',{enum:['raw','finished']}).notNull(),unit:text('unit',{enum:['kg','g','piece','sac','carton','litre']}).notNull(),threshold:integer('threshold'),archived:integer('archived').notNull().default(0),version:integer('version').notNull().default(1),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),
},t=>[index('sp_reference_search').on(t.category,t.archived,t.name)]);
export const productionBalances=sqliteTable('sp_balances',{
 referenceId:text('reference_id').primaryKey().references(()=>productionReferences.id),quantity:integer('quantity').notNull().default(0),
});
export const productionLots=sqliteTable('sp_lots',{
 id:text('id').primaryKey(),referenceId:text('reference_id').notNull().references(()=>productionReferences.id),code:text('code').notNull(),supplier:text('supplier').notNull().default(''),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),
},t=>[uniqueIndex('sp_lot_reference_code').on(t.referenceId,t.code)]);
export const productionMovements=sqliteTable('sp_movements',{
 destination:text('destination',{enum:['','shop']}).notNull().default(''),id:text('id').primaryKey(),requestKey:text('request_key').notNull().unique(),payload:text('payload').notNull(),referenceId:text('reference_id').notNull().references(()=>productionReferences.id),referenceName:text('reference_name').notNull(),category:text('category',{enum:['raw','finished']}).notNull(),unit:text('unit').notNull(),kind:text('kind',{enum:['raw_in','raw_out','production_in','production_out','correction']}).notNull(),direction:integer('direction').notNull(),quantity:integer('quantity').notNull(),beforeQuantity:integer('before_quantity').notNull(),afterQuantity:integer('after_quantity').notNull(),actor:text('actor').notNull(),actorName:text('actor_name').notNull(),actorRole:text('actor_role',{enum:['admin','laboratory','shop']}).notNull(),createdAt:text('created_at').notNull(),occurredOn:text('occurred_on').notNull(),lotId:text('lot_id').references(()=>productionLots.id),lotCode:text('lot_code').notNull().default(''),supplier:text('supplier').notNull().default(''),comment:text('comment').notNull().default(''),correctionOf:text('correction_of').unique(),
},t=>[index('sp_movement_date').on(t.createdAt,t.id),index('sp_movement_reference').on(t.referenceId,t.createdAt),index('sp_movement_kind').on(t.kind,t.occurredOn),index('sp_movement_actor').on(t.actor,t.createdAt),index('sp_movement_lot').on(t.lotId,t.createdAt)]);
export const productionAccessAudit=sqliteTable('sp_access_audit',{
 id:text('id').primaryKey(),actor:text('actor').notNull(),target:text('target').notNull(),details:text('details').notNull(),createdAt:text('created_at').notNull(),
});

export const shopBalances=sqliteTable('sp_shop_balances',{
 referenceId:text('reference_id').primaryKey().references(()=>productionReferences.id),quantity:integer('quantity').notNull().default(0),
});
export const shopMovements=sqliteTable('sp_shop_movements',{
 id:text('id').primaryKey(),requestKey:text('request_key').notNull().unique(),payload:text('payload').notNull(),referenceId:text('reference_id').notNull().references(()=>productionReferences.id),referenceName:text('reference_name').notNull(),unit:text('unit').notNull(),kind:text('kind').notNull(),direction:integer('direction').notNull(),quantity:integer('quantity').notNull(),beforeQuantity:integer('before_quantity').notNull(),afterQuantity:integer('after_quantity').notNull(),originId:text('origin_id').unique().references(()=>productionMovements.id),correctionOf:text('correction_of').unique(),webProductId:text('web_product_id'),webProductName:text('web_product_name').notNull().default(''),actor:text('actor').notNull(),actorName:text('actor_name').notNull(),createdAt:text('created_at').notNull(),lotCode:text('lot_code').notNull().default(''),comment:text('comment').notNull().default(''),
},t=>[index('sp_shop_ref_date').on(t.referenceId,t.createdAt),index('sp_shop_date').on(t.createdAt)]);
