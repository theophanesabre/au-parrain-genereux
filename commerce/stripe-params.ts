import type Stripe from 'stripe';
type Attempt={id:string;expires_at:number;delivery:string;shipping_cents:number;shipping_label?:string};
type Item={name:string;price_cents:number;quantity:number};
// Type-check the request against the installed SDK's current API contract.
export function buildCheckoutParams(attempt:Attempt,items:Item[],countries:string[],origin:string,preview:boolean):Stripe.Checkout.SessionCreateParams{
 const tag=attempt.id.replace(/-/g,'').slice(0,8).split('').map(char=>String.fromCharCode(97+parseInt(char,16))).join('');
 const parameters:Stripe.Checkout.SessionCreateParams={mode:'payment',integration_identifier:'au-parrain-genereux-'+tag,locale:'fr',client_reference_id:attempt.id,metadata:{apg_attempt:attempt.id},payment_intent_data:{metadata:{apg_attempt:attempt.id}},expires_at:attempt.expires_at,success_url:origin+'/paiement?session_id={CHECKOUT_SESSION_ID}'+(preview?'&apercu=1':''),cancel_url:origin+'/panier?paiement=annule'+(preview?'&apercu=1':''),billing_address_collection:'required',phone_number_collection:{enabled:true},line_items:items.map(item=>({price_data:{currency:'eur',unit_amount:item.price_cents,product_data:{name:item.name}},quantity:item.quantity}))};
 if(attempt.delivery==='shipping'){parameters.shipping_address_collection={allowed_countries:countries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[]};parameters.shipping_options=[{shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:attempt.shipping_cents,currency:'eur'},display_name:(attempt.shipping_label||'Expédition')+(attempt.shipping_cents===0?' — offerte':'')}}];}
 return parameters;
}
