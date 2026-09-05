// Lista completa de países (ISO 3166-1 alpha-2). La bandera se deriva del código.
export const COUNTRIES: [string, string][] = [
  ['AF','Afganistán'],['AL','Albania'],['DE','Alemania'],['AD','Andorra'],['AO','Angola'],['AG','Antigua y Barbuda'],['SA','Arabia Saudita'],['DZ','Argelia'],['AR','Argentina'],['AM','Armenia'],['AU','Australia'],['AT','Austria'],['AZ','Azerbaiyán'],
  ['BS','Bahamas'],['BD','Bangladés'],['BB','Barbados'],['BH','Baréin'],['BE','Bélgica'],['BZ','Belice'],['BJ','Benín'],['BY','Bielorrusia'],['BO','Bolivia'],['BA','Bosnia y Herzegovina'],['BW','Botsuana'],['BR','Brasil'],['BN','Brunéi'],['BG','Bulgaria'],['BF','Burkina Faso'],['BI','Burundi'],['BT','Bután'],
  ['CV','Cabo Verde'],['KH','Camboya'],['CM','Camerún'],['CA','Canadá'],['QA','Catar'],['TD','Chad'],['CL','Chile'],['CN','China'],['CY','Chipre'],['CO','Colombia'],['KM','Comoras'],['CG','Congo'],['CD','Congo (RD)'],['KP','Corea del Norte'],['KR','Corea del Sur'],['CR','Costa Rica'],['CI','Costa de Marfil'],['HR','Croacia'],['CU','Cuba'],
  ['DK','Dinamarca'],['DM','Dominica'],['EC','Ecuador'],['EG','Egipto'],['SV','El Salvador'],['AE','Emiratos Árabes Unidos'],['ER','Eritrea'],['SK','Eslovaquia'],['SI','Eslovenia'],['ES','España'],['US','Estados Unidos'],['EE','Estonia'],['SZ','Esuatini'],['ET','Etiopía'],
  ['PH','Filipinas'],['FI','Finlandia'],['FJ','Fiyi'],['FR','Francia'],['GA','Gabón'],['GM','Gambia'],['GE','Georgia'],['GH','Ghana'],['GD','Granada'],['GR','Grecia'],['GT','Guatemala'],['GN','Guinea'],['GQ','Guinea Ecuatorial'],['GW','Guinea-Bisáu'],['GY','Guyana'],
  ['HT','Haití'],['HN','Honduras'],['HK','Hong Kong'],['HU','Hungría'],['IN','India'],['ID','Indonesia'],['IQ','Irak'],['IR','Irán'],['IE','Irlanda'],['IS','Islandia'],['IL','Israel'],['IT','Italia'],['JM','Jamaica'],['JP','Japón'],['JO','Jordania'],
  ['KZ','Kazajistán'],['KE','Kenia'],['KG','Kirguistán'],['KI','Kiribati'],['XK','Kosovo'],['KW','Kuwait'],['LA','Laos'],['LS','Lesoto'],['LV','Letonia'],['LB','Líbano'],['LR','Liberia'],['LY','Libia'],['LI','Liechtenstein'],['LT','Lituania'],['LU','Luxemburgo'],['MO','Macao'],
  ['MK','Macedonia del Norte'],['MG','Madagascar'],['MY','Malasia'],['MW','Malaui'],['MV','Maldivas'],['ML','Malí'],['MT','Malta'],['MA','Marruecos'],['MU','Mauricio'],['MR','Mauritania'],['MX','México'],['FM','Micronesia'],['MD','Moldavia'],['MC','Mónaco'],['MN','Mongolia'],['ME','Montenegro'],['MZ','Mozambique'],['MM','Myanmar'],
  ['NA','Namibia'],['NR','Nauru'],['NP','Nepal'],['NI','Nicaragua'],['NE','Níger'],['NG','Nigeria'],['NO','Noruega'],['NZ','Nueva Zelanda'],['OM','Omán'],['NL','Países Bajos'],['PK','Pakistán'],['PW','Palaos'],['PS','Palestina'],['PA','Panamá'],['PG','Papúa Nueva Guinea'],['PY','Paraguay'],['PE','Perú'],['PL','Polonia'],['PT','Portugal'],['PR','Puerto Rico'],['GB','Reino Unido'],
  ['CF','República Centroafricana'],['CZ','República Checa'],['DO','República Dominicana'],['RW','Ruanda'],['RO','Rumanía'],['RU','Rusia'],['WS','Samoa'],['KN','San Cristóbal y Nieves'],['SM','San Marino'],['VC','San Vicente y las Granadinas'],['LC','Santa Lucía'],['ST','Santo Tomé y Príncipe'],['SN','Senegal'],['RS','Serbia'],['SC','Seychelles'],['SL','Sierra Leona'],['SG','Singapur'],['SY','Siria'],['SO','Somalia'],['LK','Sri Lanka'],['ZA','Sudáfrica'],['SD','Sudán'],['SS','Sudán del Sur'],['SE','Suecia'],['CH','Suiza'],['SR','Surinam'],
  ['TH','Tailandia'],['TW','Taiwán'],['TZ','Tanzania'],['TJ','Tayikistán'],['TL','Timor Oriental'],['TG','Togo'],['TO','Tonga'],['TT','Trinidad y Tobago'],['TN','Túnez'],['TM','Turkmenistán'],['TR','Turquía'],['TV','Tuvalu'],['UA','Ucrania'],['UG','Uganda'],['UY','Uruguay'],['UZ','Uzbekistán'],['VU','Vanuatu'],['VA','Vaticano'],['VE','Venezuela'],['VN','Vietnam'],['YE','Yemen'],['DJ','Yibuti'],['ZM','Zambia'],['ZW','Zimbabue'],
];
// Bandera emoji desde el código ISO de 2 letras.
export function flagOf(code: string): string {
  if (!code || code.length !== 2) return '🏳️';
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)));
}
export function countryName(code: string): string {
  const f = COUNTRIES.find((c) => c[0] === code);
  return f ? f[1] : code;
}
// Nombre en inglés vía Intl (Node 18+ y navegadores lo soportan). Si no lo
// reconoce, cae al nombre en español para no quedar vacío.
export function countryNameEn(code: string): string {
  try {
    const n = new (Intl as any).DisplayNames(['en'], { type: 'region' }).of(String(code || '').toUpperCase());
    if (n && n.toUpperCase() !== String(code || '').toUpperCase()) return n;
  } catch { /* Intl.DisplayNames no disponible */ }
  return countryName(code);
}
// Normaliza cualquier valor a un código ISO. Acepta ya-código ("PR"), o un nombre
// guardado antes como texto libre ("Puerto Rico"). Devuelve '' si no lo reconoce.
export function countryCode(input: string | null | undefined): string {
  const v = (input || '').trim();
  if (!v) return '';
  if (v.length === 2 && COUNTRIES.some((c) => c[0] === v.toUpperCase())) return v.toUpperCase();
  const byName = COUNTRIES.find((c) => c[1].toLowerCase() === v.toLowerCase());
  return byName ? byName[0] : '';
}
