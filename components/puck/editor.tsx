'use client';
import { ConsumerRequests } from '../consumer-requests';
import { ShippingSettings } from './shipping-settings';
import { MediaLibrary } from './media-library';
import { useEffect, useRef, useState } from 'react';
import { adminThemeCSS, adminThemeClient } from '@/admin/theme.mjs';

const sections = [
  ['products', 'Articles'], ['recipes', 'Recettes'], ['highlights', 'Nouveautés'],
  ['images', 'Images'], ['orders', 'Commandes'], ['shipping', 'Livraisons'],
  ['withdrawals', 'Rétractations'], ['audit', 'Historique'], ['inventory', 'Stocks'],
] as const;
type Section = typeof sections[number][0];
const modules = [
  { id: 'products', label: 'Articles', detail: 'Catalogue en ligne', entry: 'products', sections: ['products', 'recipes', 'highlights'], icon: 'box' },
  { id: 'inventory', label: 'Stocks', detail: 'Laboratoire, magasin et web', entry: 'inventory', sections: ['inventory'], icon: 'stock' },
  { id: 'orders', label: 'Commandes', detail: 'Préparation et suivi', entry: 'orders', sections: ['orders', 'shipping', 'withdrawals', 'audit'], icon: 'bag' },
  { id: 'images', label: 'Images', detail: 'Photos de la maison', entry: 'images', sections: ['images'], icon: 'image' },
] as const;

function ModuleIcon({ name }: { name: typeof modules[number]['icon'] }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'box' ? <><path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10"/><path d="m7.5 5 9 4"/></> :
      name === 'stock' ? <><path d="M4 5h16M4 12h16M4 19h16M8 3v4m8 3v4m-8 3v4"/></> :
        name === 'bag' ? <><path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></> :
          <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-7 5 8"/></>}
  </svg>;
}

export function AdminWorkspace() {
  const [section, setSection] = useState<Section>('products');
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  const [item, setItem] = useState('');
  const manager = useRef<HTMLIFrameElement>(null);

  useEffect(() => adminThemeClient(), []);
  useEffect(() => {
    const query = new URLSearchParams(location.search), selected = query.get('section');
    if (sections.some(([key]) => key === selected)) setSection(selected as Section);
    else history.replaceState(null, '', '/admin/puck?section=products');
    setItem(query.get('item') || '');
  }, []);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== manager.current?.contentWindow) return;
      if (event.data?.type === 'apg-manager-dirty') setDirty(Boolean(event.data.dirty));
      if (event.data?.type === 'apg-manager-saved') setDirty(false);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  function navigate(next: Section) {
    if (next === section) return;
    if (dirty && !window.confirm('Des modifications ne sont pas enregistrées. Les abandonner pour changer de rubrique ?')) return;
    setDirty(false); setItem(''); setSection(next); setRevision(value => value + 1);
    history.replaceState(null, '', '/admin/puck?section=' + next);
  }
  const active = modules.find(module => (module.sections as readonly string[]).includes(section))!;
  const sectionLabel = sections.find(([key]) => key === section)?.[1];

  return <div className="apg-puck-editor apg-simple-admin">
    <style>{adminThemeCSS}</style>
    <header className="apg-workspace-header">
      <a className="apg-admin-centered-brand" href="/admin" aria-label="Accueil de l’administration"><img src="/images/logo-medaillon-orange-transparent.webp" alt="Au Parrain Généreux"/></a>
      <h1 className="apg-admin-accessible-title">Administration</h1>
      <div className="apg-admin-header-actions">
        <details className="apg-admin-settings">
          <summary>Réglages</summary>
          <div><a href="/admin/paiements">Paiements Stripe</a><a href="/admin/notifications">Emails & SMS</a><a href="/admin/catalogue">Catalogue & ballotins</a><a href="/signout-with-chatgpt?return_to=%2Fadmin">Déconnexion</a></div>
        </details>
      </div>
    </header>
    <nav className="apg-workspace-modules" aria-label="Modules de l’administration">
      {modules.map(module => <button type="button" key={module.id} aria-current={active.id === module.id ? 'page' : undefined} onClick={() => navigate(module.entry)}>
        <ModuleIcon name={module.icon}/><span><strong>{module.label}</strong><small>{module.detail}</small></span>
      </button>)}
    </nav>
    <section className="apg-workspace-surface" aria-label={active.label}>
      {dirty ? <span className="apg-admin-unsaved" role="status">Modifications non enregistrées</span> : null}
      {section === 'inventory' ? <iframe className="apg-management-frame" title="Stocks" src="/admin/stocks?embedded=1"/> :
        section === 'withdrawals' ? <ConsumerRequests/> :
          section === 'shipping' ? <ShippingSettings onDirty={setDirty}/> :
            section === 'images' ? <MediaLibrary onSaved={() => {}}/> :
              <iframe ref={manager} key={section + ':' + revision} className="apg-management-frame" title={sectionLabel} src={'/admin?workspace=1&tab=' + section + '&item=' + encodeURIComponent(item)}/>}
    </section>
  </div>;
}
