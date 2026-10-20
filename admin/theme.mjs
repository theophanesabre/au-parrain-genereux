// Admin-only appearance. No business setting, payment or stock is changed.
export const adminThemeCSS = `
html[data-apg-admin-theme]{--adm-alert-bg:#fff1f2;--adm-alert-text:#991b1b;--adm-alert-border:#e11d48;--adm-bg:#fff;--adm-surface:#fff;--adm-soft:#f4f4f5;--adm-text:#18181b;--adm-muted:#62626b;--adm-line:#dedee3;--adm-add:#166534;--adm-remove:#b91c1c;--adm-action-text:#fff;--adm-selected:#18181b;--adm-selected-text:#fff;color-scheme:light;background:var(--adm-bg)}
html[data-apg-admin-theme] body,html[data-apg-admin-theme] .apg-puck-editor{background:var(--adm-bg)!important;color:var(--adm-text)!important}
html[data-apg-admin-theme] :where(main,nav,header,article,.panel,dialog,.apg-workspace-surface,.apg-workspace-header,.apg-shipping-layout>form,.apg-shipping-layout>aside,.apg-shipping-simulation,.apg-media-delete-dialog,.apg-media-library){background:var(--adm-surface)!important;color:var(--adm-text)!important;border-color:var(--adm-line)!important;box-shadow:none!important}
html[data-apg-admin-theme] :where(h1,h2,h3,h4,strong,label,legend,summary,td,th){color:var(--adm-text)!important}
html[data-apg-admin-theme] :where(p,small,.muted,.apg-setting-field,.apg-shipping-settings p){color:var(--adm-muted)!important}
html[data-apg-admin-theme] :where(a){color:var(--adm-text)!important}
html[data-apg-admin-theme] :where(input,select,textarea){background:var(--adm-surface)!important;color:var(--adm-text)!important;border-color:var(--adm-line)!important;accent-color:var(--adm-text)!important}
html[data-apg-admin-theme] :where(input,textarea)::placeholder{color:var(--adm-muted)!important;opacity:1}
html[data-apg-admin-theme] :where(input:disabled,input:read-only){background:var(--adm-soft)!important;color:var(--adm-muted)!important}
html[data-apg-admin-theme] :where(button,.button,summary,.apg-admin-settings>div,.apg-admin-secondary>summary){background:var(--adm-soft)!important;color:var(--adm-text)!important;border-color:var(--adm-line)!important;box-shadow:none!important}
html[data-apg-admin-theme] :where(button[aria-current=page],button[aria-pressed=true],.primary,#save){background:var(--adm-selected)!important;color:var(--adm-selected-text)!important;border-color:var(--adm-selected)!important}
html[data-apg-admin-theme] :where(button[aria-current=page],button[aria-pressed=true]) :where(strong,small,svg){color:inherit!important}
html[data-apg-admin-theme] :where(.stock-tabs,.stock-card,.notice,.chip,#message,.message,.stock-alerts,.stock-badge,#stats,.admin-empty,.apg-shipping-simulation dl>div){background:var(--adm-soft)!important;color:var(--adm-text)!important;border-color:var(--adm-line)!important}
html[data-apg-admin-theme] .stock-card[aria-pressed=true]{background:var(--adm-soft)!important;color:var(--adm-text)!important;border-color:var(--adm-text)!important}
html[data-apg-admin-theme] .stock-card :where(strong,small){color:var(--adm-text)!important}
html[data-apg-admin-theme] :where(button[data-admin-action=add],#add,.admin-add){background:var(--adm-add)!important;color:var(--adm-action-text)!important;border-color:var(--adm-add)!important}
html[data-apg-admin-theme] :where(button[data-admin-action=remove],.admin-danger){background:var(--adm-remove)!important;color:var(--adm-action-text)!important;border-color:var(--adm-remove)!important;text-decoration:none!important}
html[data-apg-admin-theme] :where(button[data-admin-action=add],button[data-admin-action=remove]) *{color:inherit!important}
html[data-apg-admin-theme] .stock-alerts{padding:20px 24px;margin:20px 0;border:1px solid var(--adm-alert-border);border-left-width:4px;border-radius:16px}html[data-apg-admin-theme] .stock-alerts h2{font-size:22px;margin:0 0 12px}html[data-apg-admin-theme] .stock-alerts p{margin:8px 0}
html[data-apg-admin-theme] :is(.stock-alerts,.stock-badge,.chip){background:var(--adm-alert-bg)!important;color:var(--adm-alert-text)!important;border-color:var(--adm-alert-border)!important}
html[data-apg-admin-theme] .stock-alerts :is(h2,p,strong),html[data-apg-admin-theme] .stock-card .chip{color:var(--adm-alert-text)!important}
html[data-apg-admin-theme] :is(.stock-badge,.stock-card .chip){font-weight:700;border:1px solid var(--adm-alert-border);border-radius:8px;padding:5px 10px}
html[data-apg-admin-theme] .operation-choice label{border-radius:12px;padding:10px 16px;background:var(--adm-soft)}
html[data-apg-admin-theme] .operation-choice label:has(input[value=in]:checked){background:var(--adm-add)!important;color:var(--adm-action-text)!important}
html[data-apg-admin-theme] .operation-choice label:has(input[value=out]:checked){background:var(--adm-remove)!important;color:var(--adm-action-text)!important}
html[data-apg-admin-theme] .operation-choice label input{accent-color:currentColor!important}
html[data-apg-admin-theme] :where(:focus-visible){outline:3px solid var(--adm-text)!important;outline-offset:3px}
html[data-apg-admin-theme] :where(.quick-movement,td,th,dialog h2,dialog form>.actions){border-color:var(--adm-line)!important}
html[data-apg-admin-theme] dialog form>.actions{background:var(--adm-surface)!important}
html[data-apg-admin-theme] :where(.apg-admin-settings>summary:after,.apg-admin-secondary>summary:after,.apg-workspace-modules svg){color:inherit!important}
html[data-apg-admin-theme] :where(.product-photo-editor,.admin-form-group,.product-photo-selected figure,.product-photo-library button,.apg-media-item,.apg-media-toolbar){background:var(--adm-soft)!important;border-color:var(--adm-line)!important}
html[data-apg-admin-theme] .product-crop-guide{border-color:var(--adm-text)!important}
html[data-apg-admin-theme] :where(.apg-media-grid article,.apg-media-photo,.apg-media-dialog,.apg-media-failures,.apg-media-empty,.apg-shipping-simulation,.apg-media-message){background:var(--adm-surface)!important;color:var(--adm-text)!important;border-color:var(--adm-line)!important}
html[data-apg-admin-theme] :where(.apg-media-upload){background:var(--adm-add)!important;color:var(--adm-action-text)!important;border-color:var(--adm-add)!important}
html[data-apg-admin-theme] :where(.apg-media-delete){background:var(--adm-remove)!important;color:var(--adm-action-text)!important;border-color:var(--adm-remove)!important}
html[data-apg-admin-theme] :where(.apg-media-primary,.apg-shipping-settings button){background:var(--adm-selected)!important;color:var(--adm-selected-text)!important;border-color:var(--adm-selected)!important}
html[data-apg-admin-theme] :where(#form-error,.message[data-error=true]){background:var(--adm-soft)!important;color:var(--adm-text)!important;border-color:var(--adm-text)!important}
html[data-apg-admin-theme] :where(.admin-neutral-header){display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:18px;max-width:1180px;margin:auto;padding:20px 24px;border:0!important}
.admin-neutral-header>.admin-center-logo{grid-column:2;grid-row:1;width:92px;height:88px;object-fit:contain;display:block;margin:auto}
.admin-neutral-header>.admin-header-start{grid-column:1;grid-row:1;justify-self:start;font-size:14px}
.admin-neutral-header>.admin-header-end{grid-column:3;grid-row:1;justify-self:end}
body[data-admin-embedded=true]>header{display:none!important}
html[data-apg-admin-theme] body[data-workspace=true]{background:var(--adm-bg)!important}
@media(max-width:600px){html[data-apg-admin-theme] .admin-neutral-header{padding:16px;gap:10px}.admin-neutral-header>.admin-center-logo{width:78px;height:76px}.admin-neutral-header>.admin-header-start{font-size:12px}.admin-neutral-header>.admin-header-end button{font-size:12px;padding:10px}}
`;

export function adminThemeClient(){
 if(typeof window==='undefined'||typeof document==='undefined')return ()=>{};
 const root=document.documentElement;root.dataset.apgAdminTheme='light';
 try{localStorage.removeItem('apg-admin-theme');}catch{}
 function markButtons(){
  for(const button of document.querySelectorAll('button:not(.stock-card):not([data-admin-theme-toggle])')){
   if(button.dataset.adminAction)continue;const label=(button.textContent||button.getAttribute('aria-label')||'').trim();
   if(/^\+\s|^(Ajouter|Importer|Créer|Nouvel article|Nouveau produit)\b/i.test(label))button.dataset.adminAction='add';
   else if(/^(Supprimer|Retirer|Archiver)\b/i.test(label))button.dataset.adminAction='remove';
  }
 }
 markButtons();const observer=new MutationObserver(markButtons);observer.observe(document.body,{childList:true,subtree:true,characterData:true});
 return ()=>{observer.disconnect();delete root.dataset.apgAdminTheme;};
}
