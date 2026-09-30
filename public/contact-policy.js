// Shared display and server-side consent contract. Never trust client-supplied wording.
export const CONSENT_VERSION='turespana-imex-2026-09-29-v1';
export const TERMS_URL='https://www.spain.info/en/conditions-use-information/';
export const PRIVACY_URL='https://www.tourspain.es/es/proteccion-datos/';
export const CONSENT_TEXT='By checking this box, you agree to receive marketing/promotional messages from Turespaña. Msg freq varies. Msg & data rates may apply. Reply HELP for help. Reply STOP to opt out. View our TERMS & Privacy.';
export function normalizeName(value){return typeof value==='string'?value.trim().replace(/\s+/gu,' '):'';}
export function validName(value){const name=normalizeName(value);return name.length>=1&&name.length<=120&&!/[<>\u0000-\u001f\u007f]/u.test(name);}
export function consentLabelMarkup(){return 'By checking this box, you agree to receive marketing/promotional messages from Turespaña. Msg freq varies. Msg &amp; data rates may apply. Reply HELP for help. Reply STOP to opt out. View our <a href="'+TERMS_URL+'" target="_blank" rel="noopener noreferrer">TERMS</a> &amp; <a href="'+PRIVACY_URL+'" target="_blank" rel="noopener noreferrer" lang="es">Privacy</a>.';}
