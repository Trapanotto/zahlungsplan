// Calendar dates are UTC day numbers, so dragging is independent of daylight saving time.
export const DAY = 86400000;
export const FORMAT = 'trapanotto-zahlungsplan';
export const uid = () => crypto.randomUUID();
export const copy = value => JSON.parse(JSON.stringify(value));
export const day = date => Date.parse(date + 'T00:00:00Z') / DAY;
export const iso = number => new Date(Math.round(number) * DAY).toISOString().slice(0, 10);
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export function validDate(value) {
  return typeof value === 'string' && /^(20\d{2}|2100)-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(day(value)) && iso(day(value)) === value;
}
export const dateLabel = date => validDate(date) ? date.split('-').reverse().join('.') : '–';
export const number = (n, decimals = 2) => new Intl.NumberFormat('de-CH', {maximumFractionDigits: decimals}).format(n);
export const percentLabel = n => number(n) + ' %';
export const money = (n, currency = 'CHF') => new Intl.NumberFormat('de-CH', {style:'currency',currency,maximumFractionDigits:2}).format(n);
export const KINDS = {
  advance:'Anzahlungsbürgschaft', performance:'Vertragserfüllungsbürgschaft',
  warrantyBond:'Gewährleistungsbürgschaft', warranty:'Gewährleistungsfrist', other:'Sonstige Sicherheit'
};
export const sortedMilestones = p => p.milestones.map((m,i)=>({...m,_order:i})).sort((a,b)=>a.date.localeCompare(b.date)||a._order-b._order);
export const share = (item, p) => item.unit === 'amount' ? (p.total > 0 ? item.value / p.total * 100 : 0) : item.value;
export const amount = (item, p) => item.unit === 'amount' ? item.value : (p.total > 0 ? p.total * item.value / 100 : null);
export function cumulative(p) {
  let total = 0;
  return sortedMilestones(p).map((m,i)=>({...m, index:i+1, percent:share(m,p), cumulative:(total += share(m,p)), amount:amount(m,p)}));
}
export function resolveDate(item, edge, p) {
  return p.milestones.find(m=>m.id === item[edge+'Milestone'])?.date || item[edge];
}
export function ranges(p) {
  return [...p.securities,...p.phases].flatMap(s=>[resolveDate(s,'start',p),resolveDate(s,'end',p)]).concat(p.milestones.filter(m=>m.value===0).map(m=>m.securityEnd||m.date));
}
export const milestoneSecurities = (milestoneId,p) => p.securities.filter(s=>s.startMilestone===milestoneId);
export function securitySummary(s,p) {
  return (s.kind==='warranty'?'':(s.unit==='amount'?money(s.value,p.currency):percentLabel(s.value))+' ')+s.name+' · bis '+dateLabel(resolveDate(s,'end',p))+(s.description?' · '+s.description:'');
}
export function securitiesAtMilestone(milestoneId,p) {
  const milestone=p.milestones.find(m=>m.id===milestoneId),own=milestone?.value===0?[milestone.name+' · bis '+dateLabel(milestone.securityEnd||milestone.date)]:[];
  return own.concat(p.securities.filter(s=>s.startMilestone===milestoneId||s.endMilestone===milestoneId).map(s=>s.startMilestone===milestoneId?securitySummary(s,p):'Ende: '+s.name)).join('; ');
}
export function isoWeek(dayNumber) {
  const date=new Date(dayNumber*DAY),thursday=dayNumber+3-((date.getUTCDay()+6)%7);
  const year=new Date(thursday*DAY).getUTCFullYear();
  return {year,week:Math.ceil((thursday-day(year+'-01-01')+1)/7)};
}
export function warnings(p) {
  const out = [], sum=cumulative(p).at(-1)?.cumulative || 0;
  if(p.milestones.length && Math.abs(sum-100)>.005) out.push(sum>100 ? `Die Teilzahlungen ergeben ${percentLabel(sum)} – ${percentLabel(sum-100)} über 100 %.` : `Noch ${percentLabel(100-sum)} der Vertragssumme sind nicht zugeordnet.`);
  for(const s of [...p.securities,...p.phases]) if(resolveDate(s,'end',p)<resolveDate(s,'start',p)) out.push(`„${s.name}“: Das Laufzeitende liegt vor dem Beginn. Bitte Termine prüfen.`);
  for(const m of p.milestones)if(m.value===0&&m.securityEnd&&m.securityEnd<m.date)out.push(`„${m.name}“: Das Laufzeitende liegt vor dem Zieltermin. Bitte Termine prüfen.`);
  return out;
}
export function blank() {
  return {format:FORMAT,version:1,title:'Neuer Zahlungsplan',reference:'',total:0,currency:'CHF',notes:'',milestones:[],securities:[],phases:[],demo:false};
}
export function example() {
  const p=blank();Object.assign(p,{title:'Beispiel-Zahlungsplan',reference:'Beispielprojekt · Neubau',demo:true});
  const rows=[
    ['Bestellabsichtserklärung','2026-07-31',0,'Start Realisierungsplanung'],
    ['Nach Vertragsunterzeichnung (MS 01)','2026-08-14',20,''],
    ['Beginn Montage Stahlbau','2027-03-01',25,''],
    ['Beginn Montage Palettenfördertechnik','2027-10-04',20,''],
    ['Abschluss Einheben RBG','2028-01-12',15,''],
    ['Abschluss Inbetriebnahme Palettenfördertechnik','2028-04-06',10,''],
    ['Bereitschaft zum Start des Produktivbetriebs','2028-07-06',5,'Bestands-Anbindung (Go-Live Bestandsanlage). Start Gewährleistung; Übergang von Nutzen und Gefahr.'],
    ['Nach Abnahme','2028-09-06',5,'Ablösung der Vertragserfüllungsbürgschaft durch eine Gewährleistungsbürgschaft.']
  ];
  p.milestones=rows.map((r,i)=>({id:'ms-'+(i+1),name:r[0],date:r[1],value:r[2],unit:'percent',description:r[3],vsp:i===6,vspValue:0,vspUnit:'percent',vspNote:i===6?'Go-Live – VSP gemäss Vereinbarung':'',...(r[2]===0?{securityEnd:r[1]}:{})}));
  p.securities=[
    {id:'sec-1',name:'Anzahlungsbürgschaft',kind:'advance',value:20,unit:'percent',start:'2026-08-14',end:'2027-03-01',startMilestone:'ms-2',endMilestone:'ms-3',description:'Bis Montagebeginn Stahlbau'},
    {id:'sec-2',name:'Vertragserfüllungsbürgschaft',kind:'performance',value:10,unit:'percent',start:'2027-03-01',end:'2028-09-06',startMilestone:'ms-3',endMilestone:'ms-8',description:'Bis Abnahme'},
    {id:'sec-3',name:'Gewährleistungsbürgschaft',kind:'warrantyBond',value:5,unit:'percent',start:'2028-09-06',end:'2031-07-06',startMilestone:'ms-8',endMilestone:'',description:'Bis Ende Gewährleistung'},
    {id:'sec-4',name:'36 Monate Gewährleistung',kind:'warranty',value:0,unit:'percent',start:'2028-07-06',end:'2031-07-06',startMilestone:'ms-7',endMilestone:'',description:'Gewährleistungsfrist ab Go-Live'}
  ];
  p.phases=[
    ['Planung','2026-07-31','2026-09-30'],['Anlagenbau','2026-10-01','2027-02-28'],['Montage','2027-03-01','2028-03-31'],
    ['Inbetriebnahme','2028-04-01','2028-06-05'],['Hochlauf','2028-06-06','2028-07-05'],['Produktivbetrieb','2028-07-06','2031-07-06']
  ].map((r,i)=>({id:'phase-'+i,name:r[0],start:r[1],end:r[2],description:''}));
  return p;
}
const text=(v,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
function numeric(v,label,max=1e14){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)throw Error(`${label}: ungültiger Wert.`);return v;}
function date(v,label){if(!validDate(v))throw Error(`${label}: ungültiges Datum (2000–2100).`);return v;}
function identity(v,ids){const id=text(v,100);if(!id||ids.has(id))throw Error('Fehlende oder doppelte Eintrags-ID.');ids.add(id);return id;}
export function normalize(raw) {
  if(!raw||raw.format!==FORMAT||raw.version!==1)throw Error('Keine unterstützte Zahlungsplan-Datei (Version 1).');
  if(!Array.isArray(raw.milestones)||!Array.isArray(raw.securities)||!Array.isArray(raw.phases))throw Error('Die Datei enthält keine gültigen Planungsdaten.');
  if(raw.milestones.length>500||raw.securities.length>200||raw.phases.length>100)throw Error('Maximal 500 Meilensteine, 200 Sicherheiten und 100 Phasen werden unterstützt.');
  const p=blank(),ids=new Set();
  p.title=text(raw.title,150)||'Zahlungsplan';p.reference=text(raw.reference,300);p.notes=text(raw.notes,5000);p.demo=raw.demo===true;
  p.currency=['CHF','EUR','USD','GBP'].includes(raw.currency)?raw.currency:'CHF';p.total=numeric(raw.total,'Vertragssumme');
  const val=(r)=>({unit:r.unit==='amount'?'amount':'percent',value:numeric(r.value,'Teilzahlung / Sicherheit',r.unit==='amount'?1e14:100)});
  p.milestones=raw.milestones.map(m=>({id:identity(m.id,ids),name:text(m.name,180)||'Meilenstein',date:date(m.date,'Zieltermin'),...val(m),description:text(m.description),vsp:m.vsp===true,vspValue:numeric(m.vspValue??0,'VSP',m.vspUnit==='amount'?1e14:100),vspUnit:m.vspUnit==='amount'?'amount':'percent',vspNote:text(m.vspNote),...(m.value===0||m.securityEnd?{securityEnd:date(m.securityEnd||m.date,'Laufzeitende')}:{})}));
  const refs=new Set(p.milestones.map(m=>m.id));
  p.securities=raw.securities.map(s=>{
    for(const key of ['startMilestone','endMilestone'])if(s[key]&&!refs.has(s[key]))throw Error('Eine Sicherheit verweist auf einen fehlenden Meilenstein.');
    return {id:identity(s.id,ids),name:text(s.name,180)||'Sicherheit',kind:Object.hasOwn(KINDS,s.kind)?s.kind:'other',...val(s),start:date(s.start,'Beginn'),end:date(s.end,'Laufzeitende'),startMilestone:text(s.startMilestone,100),endMilestone:text(s.endMilestone,100),description:text(s.description)};
  });
  p.phases=raw.phases.map(s=>({id:identity(s.id,ids),name:text(s.name,180)||'Phase',start:date(s.start,'Phasenbeginn'),end:date(s.end,'Phasenende'),description:text(s.description)}));
  if(p.total<=0&&[...p.milestones,...p.securities].some(m=>m.unit==='amount'&&m.value>0))throw Error('Für Teilzahlungen oder Sicherheiten als Geldbetrag ist eine Vertragssumme erforderlich.');
  // Preserve old standalone securities and their dates when moving them into milestones.
  for(const security of p.securities)if(!security.startMilestone){
    let owner=p.milestones.find(m=>m.date===security.start);
    if(!owner){
      if(p.milestones.length>=500)throw Error('Für die Zuordnung der Sicherheiten sind zusätzliche Meilensteine erforderlich (maximal 500).');
      owner={id:uid(),name:('Beginn '+security.name).slice(0,180),date:security.start,securityEnd:security.start,value:0,unit:'percent',description:'',vsp:false,vspValue:0,vspUnit:'percent',vspNote:''};
      p.milestones.push(owner);
    }
    security.startMilestone=owner.id;
  }
  return p;
}
export function fromGantt(raw) {
  if(!raw||!Array.isArray(raw.phases))throw Error('Keine unterstützte Gantt-Datei.');
  const p=blank();p.title=text(raw.title,150)||'Gantt-Zahlungsplan';
  for(const phase of raw.phases){
    const acts=(phase.activities||[]).filter(a=>validDate(a.start)&&validDate(a.end));
    for(const a of acts.filter(a=>a.milestone))p.milestones.push({id:uid(),name:text(a.name,180)||'Meilenstein',date:a.start,value:0,unit:'percent',description:'',vsp:false,vspValue:0,vspUnit:'percent',vspNote:''});
    if(acts.length)p.phases.push({id:uid(),name:text(phase.name,180)||'Phase',start:acts.map(a=>a.start).sort()[0],end:acts.map(a=>a.end).sort().at(-1),description:''});
  }
  return normalize(p);
}
