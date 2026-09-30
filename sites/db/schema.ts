import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const kioskContacts=sqliteTable('kiosk_contacts',{
 id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull(),
 destinationId:text('destination_id').notNull(),marketingOptIn:integer('marketing_opt_in').notNull().default(0),
 consentAt:text('consent_at'),consentVersion:text('consent_version').notNull(),consentText:text('consent_text').notNull(),
 termsUrl:text('terms_url').notNull(),privacyUrl:text('privacy_url').notNull(),createdAt:text('created_at').notNull(),
 client:text('client').notNull(),event:text('event').notNull(),source:text('source').notNull(),portraitHash:text('portrait_hash').notNull()
});
