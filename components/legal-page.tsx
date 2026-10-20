import type { ReactNode } from 'react';
import { SiteHeader, SiteFooter } from './site-chrome';
import { prelaunchEnabled } from '@/site/prelaunch.mjs';
import { LEGAL_VERSION } from '@/site/legal.mjs';
export function LegalPage({title,children,draft=false}:{title:string;children:ReactNode;draft?:boolean}){return <main className="inner-page apg-legal-page"><SiteHeader/><article className="apg-legal-document"><p className="apg-legal-kicker">Au Parrain Généreux</p><h1>{title}</h1><p className="apg-legal-date">Version {LEGAL_VERSION} · Mise à jour le 20 octobre 2026</p>{draft&&prelaunchEnabled?<aside className="apg-legal-notice"><strong>Vente en ligne en préparation.</strong> Les ventes ne sont pas ouvertes au public.</aside>:null}{children}</article><SiteFooter/></main>;}
