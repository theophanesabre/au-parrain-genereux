import '@puckeditor/core/no-external.css';
import './editor.css';
import { PuckEditor } from '@/components/puck/editor';
export const dynamic='force-dynamic';
export const metadata={title:'Gestion du site · Au Parrain Généreux',robots:{index:false,follow:false}};
export default function EditorPage(){return <PuckEditor/>;}
