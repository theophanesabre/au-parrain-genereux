export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function authorize(request, env) {
  const id = request.headers.get('oai-authenticated-user-id');
  const allowed = (env.ADMIN_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!id) throw new HttpError(401, 'Connexion requise');
  if (!allowed.includes(id)) throw new HttpError(403, 'Accès réservé aux administrateurs');
  return id;
}
export function checkOrigin(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new HttpError(403, 'Origine refusée');
}
export function text(value, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, 'Texte invalide');
  return value.trim();
}
export function integer(value, max = 100000000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new HttpError(400, 'Nombre entier positif attendu');
  return value;
}
export function slug(value) {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 100) throw new HttpError(400, 'Identifiant invalide');
  return value;
}
export function imagePath(value) {
  if (value === '') return '';
  if (typeof value !== 'string' || !/^\/(?:media\/[a-f0-9-]+|images\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp))$/.test(value) || value.includes('..')) throw new HttpError(400, 'Image locale attendue');
  return value;
}
export const transitions = {draft:['confirmed','cancelled'], confirmed:['preparing','cancelled'], preparing:['ready','cancelled'], ready:['completed'], completed:[], cancelled:[]};
export function transition(from, to) {
  if (!transitions[from]?.includes(to)) throw new HttpError(409, 'Transition de commande refusée');
}
export function imageType(bytes) {
  if (bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71 && bytes[4]===13 && bytes[5]===10 && bytes[6]===26 && bytes[7]===10) return 'image/png';
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
  if (String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return 'image/webp';
  throw new HttpError(400, 'Format PNG, JPEG ou WebP requis');
}
