import * as M from './model.mjs';
import {esc,domain,timeline,report} from './chart.mjs';
const $=id=>document.getElementById(id),KEY='trapanotto:zahlungsplan:v1',VIEW='trapanotto:zahlungsplan:view';
const icon=name=>`<i data-lucide="${name}"></i>`,icons=()=>window.lucide?.createIcons();
const phone=matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<600;
document.documentElement.classList.toggle('phone-screen',phone);
let p=M.example(),history=[],future=[],view={scale:'month',labels:true,tab:'milestones'},chartGeometry,drag=null,ignoreClickUntil=0,editing=null,toastTimer,exportData=null,migrationRaw=null,renamedExample=false;
try{const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);p=M.normalize(saved);if(['Palettenfördertechnik','Palettenfördetechnik'].includes(p.title)){p.title='Beispiel-Zahlungsplan';renamedExample=true;}if(saved.securities?.some(s=>!s.startMilestone))migrationRaw=raw;}const v=JSON.parse(localStorage.getItem(VIEW)||'{}');if(['week','month','quarter'].includes(v.scale))view.scale=v.scale;if(typeof v.labels==='boolean')view.labels=v.labels;}
catch{$('storageAlert').hidden=false;$('storageAlert').textContent='Der gespeicherte Plan konnte nicht geladen werden. Die gespeicherten Daten bleiben zunächst unverändert. Öffne eine gesicherte Datei oder starte bewusst einen neuen Plan.';}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(p));$('saveStatus').textContent='Lokal in diesem Browser gespeichert';$('storageAlert').hidden=true;}catch{$('storageAlert').hidden=false;$('storageAlert').textContent='Der Browser konnte den Plan nicht speichern. Bitte sichere deine Änderungen über „Speichern“ als Datei.';$('saveStatus').textContent='Änderungen noch nicht gesichert';}}
function saveView(){try{localStorage.setItem(VIEW,JSON.stringify({scale:view.scale,labels:view.labels}));}catch{}}
function commit(next,message='',keepDemo=false){const clean=M.normalize(next);if(!keepDemo)clean.demo=false;history.push(M.copy(p));if(history.length>50)history.shift();future=[];p=clean;persist();render();if(message)toast(message);}
function undo(){if(!history.length)return;future.push(M.copy(p));p=history.pop();persist();render();toast('Änderung rückgängig gemacht');}
function redo(){if(!future.length)return;history.push(M.copy(p));p=future.pop();persist();render();toast('Änderung wiederhergestellt');}
const titleMeasure=document.createElement('canvas').getContext('2d');
function fitProjectTitle(){const input=$('projectTitle'),style=getComputedStyle(input);titleMeasure.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;input.style.width=Math.ceil(titleMeasure.measureText(input.value||input.placeholder).width+20)+'px';}
function render(){
  $('projectTitle').value=p.title;fitProjectTitle();
  document.title=p.title+' · Zahlungsplan';
  const warnings=M.warnings(p);$('warnings').hidden=!warnings.length;$('warnings').innerHTML=warnings.map(w=>'<p>'+esc(w)+'</p>').join('');
  $('undoBtn').disabled=!history.length;$('redoBtn').disabled=!future.length;
  for(const s of ['milestone','phase'])$(s+'Count').textContent=p[{milestone:'milestones',phase:'phases'}[s]].length;
  renderChart();renderTable();icons();
}
function renderChart(project=p,fixedDomain){const container=$('chartScroll');chartGeometry=timeline(project,{width:container.clientWidth||1300,scale:view.scale,labels:view.labels,domain:fixedDomain});$('chart').innerHTML=chartGeometry.markup;for(const b of document.querySelectorAll('[data-scale]')){const active=b.dataset.scale===view.scale;b.classList.toggle('on',active);b.setAttribute('aria-pressed',active);} $('labelsBtn').setAttribute('aria-pressed',view.labels);}
const editName=(type,item)=>`<button class="entry-name" data-edit="${type}" data-id="${esc(item.id)}">${esc(item.name)}</button>`;
const rowActions=(type,item)=>`<td class="row-actions"><button class="btn icon-only subtle" data-edit="${type}" data-id="${esc(item.id)}" aria-label="${esc(item.name)} bearbeiten">${icon('pencil')}</button><button class="btn icon-only subtle danger" data-delete="${type}" data-id="${esc(item.id)}" aria-label="${esc(item.name)} löschen">${icon('trash-2')}</button></td>`;
function renderTable(){
  for(const b of document.querySelectorAll('[data-tab]')){const selected=b.dataset.tab===view.tab;b.setAttribute('aria-selected',selected);b.tabIndex=selected?0:-1;}
  $('recordContent').setAttribute('aria-labelledby','tab-'+view.tab);
  const type={milestones:'milestone',phases:'phase'}[view.tab],label={milestone:'Meilenstein',phase:'Phase'}[type];
  $('addRecordBtn').innerHTML=icon('plus')+'<span>'+label+'</span>';
  if(!p[view.tab].length){$('recordContent').innerHTML=`<div class="empty"><h3>Noch keine ${view.tab==='milestones'?'Meilensteine':view.tab==='securities'?'Sicherheiten':'Projektphasen'}</h3><p>${type==='milestone'?'Erfasse Teilzahlungen mit ihren Zielterminen.':type==='security'?'Plane Bürgschaften und Gewährleistungsfristen mit einem Laufzeitende.':'Ergänze die zeitlichen Abschnitte deines Projekts.'}</p><button class="btn primary" data-add="${type}">${icon('plus')}${label} erfassen</button></div>`;icons();return;}
  let head='',rows='';
  if(type==='milestone'){
    head='<th>Teilzahlung</th><th>Meilenstein</th><th>Zieltermin</th><th>Kumuliert</th><th>VSP</th><th>Sicherheiten / Beschreibung</th><th><span class="secondary">Aktionen</span></th>';
    rows=M.cumulative(p).map(m=>{
      const own=m.value===0?`<div class="security-ref"><b>${esc(m.name)}</b><div class="secondary">Laufzeit bis ${M.dateLabel(m.securityEnd||m.date)}</div></div>`:'';
      const refs=own+p.securities.filter(s=>s.startMilestone===m.id||s.endMilestone===m.id).map(s=>s.startMilestone===m.id?`<div class="security-ref"><button class="entry-name security-name" data-edit="security" data-id="${esc(s.id)}">${s.kind==='warranty'?'':esc(s.unit==='amount'?M.money(s.value,p.currency):M.percentLabel(s.value))+' '}${esc(s.name)}</button><div class="secondary">Laufzeit bis ${M.dateLabel(M.resolveDate(s,'end',p))}${s.description?' · '+esc(s.description):''}</div></div>`:`<div class="security-ref secondary">Ende: ${esc(s.name)}</div>`).join('');
      return `<tr data-row-id="${esc(m.id)}"><td><div class="payment-value">${M.percentLabel(m.percent)}</div>${m.amount!==null?`<div class="secondary">${M.money(m.amount,p.currency)}</div>`:''}</td><td>${editName(type,m)}${m.description?'<div class="secondary row-description">'+esc(m.description)+'</div>':''}</td><td class="date-cell">${M.dateLabel(m.date)}</td><td class="cumulative">${M.percentLabel(m.cumulative)}<div class="mini-track"><i style="width:${Math.min(100,m.cumulative)}%"></i></div></td><td>${m.vsp?'<span class="vsp-badge">VSP'+(m.vspValue?' · '+(m.vspUnit==='amount'?M.money(m.vspValue,p.currency):M.percentLabel(m.vspValue)):'')+'</span>'+(m.vspNote?'<div class="secondary">'+esc(m.vspNote)+'</div>':''):'<span class="secondary">–</span>'}</td><td>${refs||'<span class="secondary">–</span>'}</td>${rowActions(type,m)}</tr>`;
    }).join('');
  }else{
    head='<th>#</th><th>Projektphase</th><th>Beginn</th><th>Ende</th><th>Dauer</th><th>Aktionen</th>';
    rows=[...p.phases].sort((a,b)=>a.start.localeCompare(b.start)).map((s,i)=>`<tr data-row-id="${esc(s.id)}"><td class="num-cell">${i+1}</td><td>${editName(type,s)}${s.description?'<div class="secondary">'+esc(s.description)+'</div>':''}</td><td>${M.dateLabel(s.start)}</td><td>${M.dateLabel(s.end)}</td><td>${M.number(M.day(s.end)-M.day(s.start)+1)} Tage</td>${rowActions(type,s)}</tr>`).join('');
  }
  const columns=type==='milestone'?['90px','24%','110px','90px','14%','auto','92px']:['44px','auto','110px','110px','90px','92px'];
  $('recordContent').innerHTML=`<div class="table-scroll"><table><colgroup>${columns.map(width=>`<col style="width:${width}">`).join('')}</colgroup><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;const headings=[...$('recordContent').querySelectorAll('th')].map(th=>th.textContent);for(const row of $('recordContent').querySelectorAll('tbody tr'))[...row.cells].forEach((cell,i)=>cell.dataset.label=headings[i]);icons();
}
const field=(name,label,value='',type='text',full=false,extra='')=>`<div class="field${full?' full':''}"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const area=(name,label,value='',full=true)=>`<div class="field${full?' full':''}"><label for="f-${name}">${label}</label><textarea id="f-${name}" name="${name}" maxlength="${name==='notes'?5000:2000}" rows="2">${esc(value)}</textarea></div>`;
const pair=(prefix,label,value,unit,totalRequired=true)=>`<div class="field"><label for="f-${prefix}Value">${label}</label><div class="value-pair"><input id="f-${prefix}Value" name="${prefix}Value" type="number" min="0" max="${unit==='amount'?1e14:100}" step="0.01" required value="${value}"><select id="f-${prefix}Unit" name="${prefix}Unit" aria-label="Einheit ${label}"><option value="percent"${unit!=='amount'?' selected':''}>Prozent (%)</option><option value="amount"${unit==='amount'?' selected':''}${totalRequired&&p.total<=0?' disabled':''}>${p.currency}</option></select></div><small id="f-${prefix}Hint">${totalRequired&&p.total<=0?'Für Geldbeträge zuerst eine Vertragssumme hinterlegen.':'Prozentwerte beziehen sich auf die Vertragssumme.'}</small></div>`;
const select=(name,label,options,value,full=false)=>`<div class="field${full?' full':''}"><label for="f-${name}">${label}</label><select name="${name}" id="f-${name}">${Object.entries(options).map(([v,l])=>`<option value="${esc(v)}"${v===value?' selected':''}>${esc(l)}</option>`).join('')}</select></div>`;
function milestoneOptions(){return {'':'Festes Datum',...Object.fromEntries(M.sortedMilestones(p).map(m=>[m.id,m.name+' · '+M.dateLabel(m.date)]))};}
function openEditor(type,id){
  if(type==='security'){
    const security=p.securities.find(s=>s.id===id);if(!security)return;
    openEditor('milestone',security.startMilestone);
    requestAnimationFrame(()=>document.querySelector(`.security-card[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({block:'center'}));
    return;
  }
  const list={milestone:'milestones',security:'securities',phase:'phases'}[type],item=id?p[list]?.find(x=>x.id===id):null;if(id&&!item)return;
  editing={type,id:id||M.uid(),securities:type==='milestone'?M.copy(M.milestoneSecurities(id,p)):[]};$('formError').hidden=true;$('deleteEntryBtn').hidden=!item;$('dialogEyebrow').textContent=type==='project'?'Projekt & Berechnung':item?'Eintrag bearbeiten':'Neuer Eintrag';
  $('editor').classList.toggle('milestone-editor',type==='milestone');
  $('dialogTitle').textContent={project:'Projektdaten',milestone:'Meilenstein & Sicherheiten',phase:'Projektphase'}[type];
  let html='',start=M.today();
  if(type==='project'){
    html=field('title','Projektname',p.title,'text',true,'required maxlength="150"')+field('reference','Projekt / Referenz',p.reference,'text',true,'maxlength="300"')+field('total','Vertragssumme (optional)',p.total||'','number',false,'min="0" max="100000000000000" step="0.01"')+select('currency','Währung',{CHF:'CHF – Schweizer Franken',EUR:'EUR – Euro',USD:'USD – US-Dollar',GBP:'GBP – Britisches Pfund'},p.currency)+`<p class="form-note full">Mit einer Vertragssumme werden Prozentwerte und Geldbeträge automatisch umgerechnet. Eine Änderung der Währung ändert nur die Bezeichnung, nicht die Beträge.</p>`+area('notes','Projektnotizen',p.notes);
  }else if(type==='milestone'){
    const last=M.sortedMilestones(p).at(-1)?.date;start=last?M.iso(Math.min(M.day(last)+30,M.day('2100-12-31'))):start;
    const m=item||{name:'',date:start,value:Math.round(Math.max(0,100-(M.cumulative(p).at(-1)?.cumulative||0))*100)/100,unit:'percent',description:'',vsp:false,vspValue:0,vspUnit:'percent',vspNote:''};
    editing.lastDate=m.date;
    html=field('name','Meilenstein',m.name,'text',true,'required maxlength="180" placeholder="z. B. Nach Vertragsunterzeichnung"')+field('date','Zieltermin',m.date,'date',false,'required min="2000-01-01" max="2100-12-31"')+pair('payment','Teilzahlungswert',m.value,m.unit)+`<div id="nonPaymentSecurity" class="full">${field('securityEnd','Laufzeitende des Sicherheitsbalkens',m.securityEnd||m.date,'date',false,'required min="2000-01-01" max="2100-12-31"')}<p class="form-note">Ohne Teilzahlung wird dieser Meilenstein als Sicherheit dargestellt. Beginn ist der Zieltermin.</p></div>`+area('description','Beschreibung / Vereinbarung',m.description)+`<label class="checkbox-field full"><input type="checkbox" id="f-vsp" name="vsp"${m.vsp?' checked':''}>Meilenstein mit Verzugsschadenspauschale (VSP)</label><div class="fieldset" id="vspFields"${m.vsp?'':' hidden'}>${pair('vsp','Vereinbarte Pauschale (optional)',m.vspValue,m.vspUnit,false)}<p class="form-note">VSP wird separat markiert und nicht zur Teilzahlung addiert. Bedingungen kannst du unten festhalten.</p>${area('vspNote','VSP-Bedingungen / Beschreibung',m.vspNote)}</div><section class="security-section full"><div class="security-section-head"><div><h3>Sicherheiten & Gewährleistung</h3><p>Beginnen am Zieltermin dieses Meilensteins.</p></div><button type="button" class="btn compact" id="addSecurityBtn">${icon('plus')}Sicherheit</button></div><div id="securityEditors"></div></section>`;
  }else{
    const s=item||{name:'',start,end:start,description:''};html=field('name','Projektphase',s.name,'text',true,'required maxlength="180"')+field('start','Beginn',s.start,'date',false,'required min="2000-01-01" max="2100-12-31"')+field('end','Ende',s.end,'date',false,'required min="2000-01-01" max="2100-12-31"')+area('description','Beschreibung',s.description);
  }
  $('formFields').innerHTML=html;if(type==='milestone')renderSecurityEditors();syncForm();icons();$('editor').showModal();
}
function readSecurityDrafts(){
  if(editing?.type!=='milestone')return;
  editing.securities=editing.securities.map((s,i)=>{
    const get=key=>$(`f-s${i}${key}`)?.value??s[key],kind=get('kind');
    return {...s,name:get('name').trim(),kind,value:kind==='warranty'?0:Number(get('Value')),unit:kind==='warranty'?'percent':get('Unit'),start:$('f-date').value,startMilestone:editing.id,endMilestone:get('endMilestone'),end:get('end'),description:get('description')};
  });
}
function renderSecurityEditors(){
  if(!$('securityEditors'))return;
  $('securityEditors').innerHTML=editing.securities.length?editing.securities.map((s,i)=>{
    const prefix='s'+i;
    return `<div class="security-card" data-id="${esc(s.id)}" data-index="${i}" data-kind="${esc(s.kind)}"><div class="security-card-head"><strong>Sicherheit ${i+1}</strong><button class="btn icon-only subtle danger" type="button" data-security-remove="${i}" aria-label="Sicherheit ${i+1} entfernen">${icon('trash-2')}</button></div><div class="form-fields">${field(prefix+'name','Bezeichnung',s.name,'text',true,'required maxlength="180"')}${select(prefix+'kind','Art',M.KINDS,s.kind)}${pair(prefix,'Wert der Sicherheit',s.value,s.unit)}${select(prefix+'endMilestone','Laufzeitende',milestoneOptions(),s.endMilestone)}${field(prefix+'end','Enddatum',M.resolveDate(s,'end',p),'date',false,'required min="2000-01-01" max="2100-12-31"')}<div class="duration-tools full"><span class="security-start-date"></span><div>${[12,24,36].map(months=>`<button type="button" class="btn compact" data-months="${months}" data-security-index="${i}">+${months} Monate</button>`).join('')}</div></div>${area(prefix+'description','Beschreibung / Bedingungen',s.description)}</div></div>`;
  }).join(''):'<p class="security-empty">Für diesen Meilenstein ist noch keine Sicherheit erfasst.</p>';
  icons();syncSecurityCards();
}
function syncSecurityCards(){
  if(editing?.type!=='milestone'||!$('f-date'))return;
  for(const card of document.querySelectorAll('.security-card')){
    const i=card.dataset.index,get=key=>$(`f-s${i}${key}`),kind=get('kind').value,warranty=kind==='warranty';
    if(card.dataset.kind!==kind&&get('name').value===M.KINDS[card.dataset.kind])get('name').value=M.KINDS[kind];card.dataset.kind=kind;
    const endId=get('endMilestone').value,m=p.milestones.find(m=>m.id===endId);get('end').disabled=!!m;
    if(m)get('end').value=m.id===editing.id?$('f-date').value:m.date;
    get('Value').disabled=warranty;get('Unit').disabled=warranty;get('Value').max=get('Unit').value==='amount'?1e14:100;
    get('Hint').textContent=warranty?'Gewährleistungsfrist ohne Sicherheitsbetrag.':p.total>0?'Entspricht '+(get('Unit').value==='amount'?M.percentLabel(Number(get('Value').value)/p.total*100):M.money(Number(get('Value').value)*p.total/100,p.currency)):'Für Geldbeträge zuerst eine Vertragssumme hinterlegen.';
    card.querySelector('.security-start-date').textContent='Beginn: '+M.dateLabel($('f-date').value)+' · mit diesem Meilenstein';
  }
}
function syncForm(){
  if($('nonPaymentSecurity')){const visible=Number($('f-paymentValue').value)===0,end=$('f-securityEnd'),date=$('f-date').value;if(end.value===editing.lastDate)end.value=date;editing.lastDate=date;end.disabled=!visible;$('nonPaymentSecurity').hidden=!visible;}

  if($('f-vsp')){$('vspFields').hidden=!$('f-vsp').checked;for(const input of $('vspFields').querySelectorAll('input,select,textarea'))input.disabled=!$('f-vsp').checked;}
  for(const prefix of ['payment','vsp'])if($('f-'+prefix+'Unit')){
    const unit=$('f-'+prefix+'Unit').value,value=Number($('f-'+prefix+'Value').value);$('f-'+prefix+'Value').max=unit==='amount'?1e14:100;
    if(p.total>0)$('f-'+prefix+'Hint').textContent='Entspricht '+(unit==='amount'?M.percentLabel(value/p.total*100):M.money(value*p.total/100,p.currency));
  }
  syncSecurityCards();
}
$('editForm').addEventListener('input',syncForm);$('editForm').addEventListener('change',syncForm);
$('editForm').addEventListener('submit',e=>{
  e.preventDefault();const f=new FormData(e.currentTarget),val=name=>String(f.get(name)||'').trim(),num=name=>Number(f.get(name)||0),next=M.copy(p),{type,id}=editing;
  try{
    if(type==='project'){Object.assign(next,{title:val('title'),reference:val('reference'),total:num('total'),currency:val('currency'),notes:val('notes')});}
    else{
      let item={id,name:val('name'),description:val('description')};
      if(!item.name)throw Error('Bitte eine Bezeichnung eingeben.');
      if(type==='milestone'){
        Object.assign(item,{date:val('date'),value:num('paymentValue'),unit:val('paymentUnit'),vsp:f.has('vsp'),vspValue:num('vspValue'),vspUnit:val('vspUnit')||'percent',vspNote:val('vspNote')});
        if(item.value===0){item.securityEnd=val('securityEnd')||item.date;if(item.securityEnd<item.date)throw Error('Das Laufzeitende darf nicht vor dem Zieltermin liegen.');}
        readSecurityDrafts();
        for(const security of editing.securities){
          if(!security.name)throw Error('Bitte für jede Sicherheit eine Bezeichnung eingeben.');
          if(!M.validDate(security.end))throw Error('Bitte ein gültiges Laufzeitende für „'+security.name+'“ eingeben.');
          if(security.end<item.date)throw Error('Das Laufzeitende von „'+security.name+'“ darf nicht vor dem Meilenstein liegen.');
        }
        next.securities=[...next.securities.filter(s=>s.startMilestone!==id),...M.copy(editing.securities)];
      }else Object.assign(item,{start:val('start'),end:val('end')});
      if(item.start&&item.end<item.start)throw Error('Das Laufzeitende darf nicht vor dem Beginn liegen.');
      const list=next[{milestone:'milestones',security:'securities',phase:'phases'}[type]],i=list.findIndex(x=>x.id===id);if(i<0)list.push(item);else list[i]=item;
    }
    if(!next.title)throw Error('Bitte einen Projektnamen eingeben.');
    commit(next);$('editor').close();
  }catch(err){$('formError').hidden=false;$('formError').textContent=err.message;}
});
function ask(title,description,ok='Bestätigen'){
  $('confirmTitle').textContent=title;$('confirmText').textContent=description;$('confirmOk').textContent=ok;$('confirmDialog').showModal();
  return new Promise(resolve=>{const close=value=>{$('confirmDialog').close();resolve(value);};$('confirmOk').onclick=()=>close(true);$('confirmCancel').onclick=()=>close(false);$('confirmDialog').oncancel=e=>{e.preventDefault();close(false);};});
}
async function deleteEntry(type,id){
  const list={milestone:'milestones',security:'securities',phase:'phases'}[type],item=p[list].find(x=>x.id===id);if(!item)return;
  const owned=type==='milestone'?M.milestoneSecurities(id,p).length:0,ending=type==='milestone'?p.securities.filter(s=>s.endMilestone===id&&s.startMilestone!==id).length:0;
  if(!await ask('Eintrag löschen?',`„${item.name}“ wird entfernt.${owned?' Die '+owned+' zugehörigen Sicherheiten werden ebenfalls entfernt.':''}${ending?' Hier endende Sicherheiten anderer Meilensteine behalten ihr Enddatum.':''} Du kannst die Änderung rückgängig machen.`,'Löschen'))return;
  const next=M.copy(p);if(type==='milestone'){next.securities=next.securities.filter(s=>s.startMilestone!==id);for(const s of next.securities)if(s.endMilestone===id){s.end=item.date;s.endMilestone='';}}
  next[list]=next[list].filter(x=>x.id!==id);commit(next,'Eintrag gelöscht');if($('editor').open)$('editor').close();
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.close)$(b.dataset.close).close();
  if(b.dataset.add)openEditor(b.dataset.add);
  if(b.dataset.edit)openEditor(b.dataset.edit,b.dataset.id);
  if(b.dataset.delete)deleteEntry(b.dataset.delete,b.dataset.id);
  if(b.dataset.tab){view.tab=b.dataset.tab;renderTable();}
  if(b.dataset.scale){view.scale=b.dataset.scale;saveView();renderChart();}
  if(b.id==='addSecurityBtn'){
    readSecurityDrafts();const start=$('f-date').value||M.today();editing.securities.push({id:M.uid(),name:'Anzahlungsbürgschaft',kind:'advance',value:0,unit:'percent',start,startMilestone:editing.id,end:M.iso(Math.min(M.day(start)+365,M.day('2100-12-31'))),endMilestone:'',description:''});renderSecurityEditors();$('securityEditors').lastElementChild?.scrollIntoView({block:'center'});
  }
  if(b.dataset.securityRemove!==undefined){readSecurityDrafts();editing.securities.splice(Number(b.dataset.securityRemove),1);renderSecurityEditors();}
  if(b.dataset.months){const start=$('f-date').value;if(!M.validDate(start))return;const d=new Date(start+'T00:00:00Z'),desired=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+Number(b.dataset.months));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(desired,last));const end=d.toISOString().slice(0,10);if(!M.validDate(end)){toast('Das Laufzeitende muss spätestens im Jahr 2100 liegen.');return;}const prefix='f-s'+b.dataset.securityIndex;$(prefix+'endMilestone').value='';$(prefix+'end').disabled=false;$(prefix+'end').value=end;}
  if(b.dataset.new){$('newDialog').close();if(p.milestones.length||p.securities.length||p.phases.length){if(!await ask('Aktuellen Plan ersetzen?','Speichere den aktuellen Plan bei Bedarf vorher als Datei. Du kannst den Wechsel auch rückgängig machen.','Neuen Plan starten'))return;}commit(b.dataset.new==='example'?M.example():M.blank(),'Neuer Plan geöffnet',true);if(b.dataset.new==='blank')openEditor('project');}
});
$('deleteEntryBtn').onclick=()=>deleteEntry(editing.type,editing.id);
function saveProjectTitle(){
  const title=$('projectTitle').value.trim();
  if(title&&title!==p.title){const next=M.copy(p);next.title=title;commit(next);}
  else $('projectTitle').value=p.title;
  fitProjectTitle();
}
$('projectTitle').oninput=fitProjectTitle;
$('projectTitle').onchange=saveProjectTitle;
$('projectTitle').onkeydown=e=>{
  if(e.key==='Enter'){e.preventDefault();saveProjectTitle();e.currentTarget.blur();}
  if(e.key==='Escape'){e.preventDefault();e.currentTarget.value=p.title;fitProjectTitle();e.currentTarget.blur();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProjectTitle();saveFile();}
};
$('projectBtn').onclick=()=>openEditor('project');$('addRecordBtn').onclick=()=>openEditor({milestones:'milestone',phases:'phase'}[view.tab]);
$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('newBtn').onclick=()=>$('newDialog').showModal();
$('labelsBtn').onclick=()=>{view.labels=!view.labels;saveView();renderChart();};

function filename(ext){return (p.title.normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').slice(0,100)||'Zahlungsplan')+'.'+ext;}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function saveFile(){download(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),filename('zahlungsplan.json'));toast('Zahlungsplan als Datei gespeichert');}
$('saveBtn').onclick=saveFile;$('loadBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
    if(file.size>5*1024*1024)throw Error('Die Datei ist zu gross (maximal 5 MB).');
    const source=await file.text();let raw;
    if(source.trimStart().startsWith('<')){
      // Extract only the inert project JSON; imported HTML or scripts are never executed.
      const match=source.match(/<script\b[^>]*\bid=["']embedded-project["'][^>]*>([\s\S]*?)<\/script>/i);
      if(!match)throw Error('Die HTML-Datei enthält kein gespeichertes Gantt-Projekt.');raw=JSON.parse(match[1]);
    }else raw=JSON.parse(source);
    const gantt=!raw.format&&!raw.milestones&&Array.isArray(raw.phases),loaded=gantt?M.fromGantt(raw):M.normalize(raw);
    if(!await ask('Datei öffnen?',`„${loaded.title}“ ersetzt den aktuellen Plan.${gantt?' Gantt-Meilensteine und Phasen werden übernommen. Die Teilzahlungen kannst du anschliessend ergänzen.':' Speichere den bisherigen Plan bei Bedarf vorher als Datei.'}`,'Öffnen'))return;
    commit(loaded,gantt?'Gantt-Meilensteine und Projektphasen importiert':'Zahlungsplan geladen',true);
  }catch(err){toast(err instanceof SyntaxError?'Die Datei enthält keine gültigen Planungsdaten.':err.message);}
};

// Dragging a linked edge changes its milestone so the relationship stays intact.
function moveMilestone(project,id,date,moveEnd=true){const m=project.milestones.find(m=>m.id===id);if(!m)return;const delta=M.day(date)-M.day(m.date);if(m.securityEnd&&moveEnd)m.securityEnd=M.iso(Math.min(M.day('2100-12-31'),M.day(m.securityEnd)+delta));m.date=date;}
$('chart').addEventListener('pointerdown',e=>{
  if(e.button!==0)return;const g=e.target.closest('[data-type][data-id]');if(!g)return;
  const type=g.dataset.type,id=g.dataset.id,edge=e.target.dataset.edge;
  const list={milestone:'milestones',security:'securities',phase:'phases'}[type],item=p[list]?.find(s=>s.id===id);if(!item)return;
  const date=type==='milestone'?(edge==='end'?(item.securityEnd||item.date):item.date):M.resolveDate(item,edge||'start',p);
  e.preventDefault();const bounds=$('chart').querySelector('svg').getBoundingClientRect();
  drag={type,id,edge,startX:e.clientX,startY:e.clientY,date,original:M.copy(p),next:M.copy(p),geometry:{...chartGeometry},ratio:chartGeometry.width/bounds.width,moved:false,pointer:e.pointerId};
});
window.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;const dx=e.clientX-drag.startX;if(Math.abs(dx)<4&&!drag.moved)return;
  drag.moved=true;e.preventDefault();const {geometry:g}=drag,delta=Math.round(dx*drag.ratio/g.plotW*(g.end-g.start));
  const limited=n=>M.iso(Math.max(M.day('2000-01-01'),Math.min(M.day('2100-12-31'),n)));
  let date=limited(M.day(drag.date)+delta);
  const next=M.copy(drag.original),item=next[{milestone:'milestones',security:'securities',phase:'phases'}[drag.type]].find(s=>s.id===drag.id);
  if(drag.type==='milestone'){
    if(drag.edge==='end')item.securityEnd=date<item.date?item.date:date;
    else if(drag.edge==='start'){if(date>(item.securityEnd||item.date))date=item.securityEnd||item.date;moveMilestone(next,item.id,date,false);}
    else moveMilestone(next,item.id,date);
  }else if(drag.edge){
    const other=M.resolveDate(item,drag.edge==='end'?'start':'end',next);if(drag.edge==='end'&&date<other)date=other;if(drag.edge==='start'&&date>other)date=other;
    if(drag.type==='security'&&item[drag.edge+'Milestone'])moveMilestone(next,item[drag.edge+'Milestone'],date);
    else item[drag.edge]=date;
  }else{
    const start=M.resolveDate(item,'start',next),end=M.resolveDate(item,'end',next),shift=Math.max(M.day('2000-01-01')-M.day(start),Math.min(M.day('2100-12-31')-M.day(end),delta));
    if(drag.type==='phase'){item.start=limited(M.day(start)+shift);item.end=limited(M.day(end)+shift);}
    else{const moved=new Set();for(const edge of ['start','end']){const id=item[edge+'Milestone'];if(id){if(!moved.has(id)){moveMilestone(next,id,limited(M.day(M.resolveDate(item,edge,drag.original))+shift));moved.add(id);}}else item[edge]=limited(M.day(item[edge])+shift);}}
  }
  drag.next=next;const range=domain(next,view.scale);renderChart(next,{start:Math.min(g.start,range.start),end:Math.max(g.end,range.end)});$('saveStatus').textContent='Termin: '+M.dateLabel(date);
},{passive:false});
window.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointer)return;const current=drag;drag=null;if(current.moved){ignoreClickUntil=performance.now()+350;commit(current.next,'Termin aktualisiert');}});
function cancelDrag(){if(!drag)return;drag=null;render();$('saveStatus').textContent='Verschieben abgebrochen';}
window.addEventListener('pointercancel',cancelDrag);window.addEventListener('blur',cancelDrag);
$('chart').addEventListener('click',e=>{if(performance.now()<ignoreClickUntil)return;const g=e.target.closest('[data-type][data-id]');if(g)openEditor(g.dataset.type,g.dataset.id);});
$('chart').addEventListener('keydown',e=>{
  const g=e.target.closest('[data-type][data-id]');if(!g)return;
  if(['Enter',' '].includes(e.key)){e.preventDefault();openEditor(g.dataset.type,g.dataset.id);}
  if(g.dataset.type==='milestone'&&['ArrowLeft','ArrowRight'].includes(e.key)){
    e.preventDefault();const next=M.copy(p),m=next.milestones.find(m=>m.id===g.dataset.id),delta=(e.key==='ArrowRight'?1:-1)*(e.shiftKey?7:1);const date=M.iso(M.day(m.date)+delta);if(!M.validDate(date))return;moveMilestone(next,m.id,date);commit(next);$('chart').querySelector(`[data-id="${CSS.escape(m.id)}"]`)?.focus();
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&drag){e.preventDefault();cancelDrag();return;}
  if(e.target.closest('input,textarea,select,dialog'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveFile();}
  if(e.target.matches('[role=tab]')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')],i=tabs.indexOf(e.target),next=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];view.tab=next.dataset.tab;renderTable();next.focus();}
});

const exportCfg={withList:true,width:1100,height:620,scale:1},exportStage=$('exportStage'),exportFrame=$('exportFrame');
let exportRevision=0,exportTimer,exportDrag=null,printing=false;
const minExportWidth=()=>exportCfg.withList?780:520;
const clampExportWidth=width=>Math.max(minExportWidth(),Math.min(4000,Math.round(Number(width)||1100)));
function fitExportFrame(){
  exportCfg.scale=Math.min(1,Math.max(1,exportStage.clientWidth-58)/exportCfg.width,Math.max(1,exportStage.clientHeight-34)/exportCfg.height);
  exportFrame.style.width=Math.round(exportCfg.width*exportCfg.scale)+'px';exportFrame.style.height=Math.round(exportCfg.height*exportCfg.scale)+'px';
  $('exportWidth').value=exportCfg.width;$('exportWidth').min=minExportWidth();$('exportResize').setAttribute('aria-valuemin',minExportWidth());$('exportResize').setAttribute('aria-valuenow',exportCfg.width);
}
function queueExport(delay=70){clearTimeout(exportTimer);exportTimer=setTimeout(renderExport,delay);}
async function renderExport(){
  if(!$('exportDialog').open)return;
  const revision=++exportRevision,project=M.copy(p),cfg={...exportCfg,scale:view.scale},data=report(project,view.labels,cfg),url=URL.createObjectURL(new Blob([data.markup],{type:'image/svg+xml;charset=utf-8'}));
  for(const id of ['pngBtn','svgBtn','printBtn'])$(id).disabled=true;
  $('exportStatus').textContent='Vorschau wird erstellt …';
  try{
    const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Die Vorschau konnte nicht erstellt werden.'));img.src=url;});
    if(revision!==exportRevision||!$('exportDialog').open){URL.revokeObjectURL(url);return;}
    const old=exportData?.url;exportData={...data,url,project,labels:view.labels,withList:cfg.withList,scale:cfg.scale};exportCfg.height=data.height;
    $('exportPreview').src=url;fitExportFrame();if(old)URL.revokeObjectURL(old);
    $('exportStatus').textContent=`${data.width} × ${data.height} px · Breite am rechten Griff ziehen`;
    for(const id of ['pngBtn','svgBtn','printBtn'])$(id).disabled=false;
  }catch(err){URL.revokeObjectURL(url);if(revision===exportRevision)$('exportStatus').textContent=err.message;}
}
function openExport(print=false){
  $('exportTitle').textContent=print?'Druckvorschau':'PNG Vorschau';$('printBtn').classList.toggle('primary',print);$('pngBtn').classList.toggle('primary',!print);
  exportCfg.width=clampExportWidth(exportCfg.width);$('exportDialog').showModal();fitExportFrame();renderExport();
}
$('exportBtn').onclick=()=>openExport();$('printOpenBtn').onclick=()=>openExport(true);
$('exportMode').onclick=e=>{const button=e.target.closest('[data-list]');if(!button)return;exportCfg.withList=button.dataset.list==='1';exportCfg.width=clampExportWidth(exportCfg.width);for(const b of $('exportMode').querySelectorAll('button')){const on=(b.dataset.list==='1')===exportCfg.withList;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);}fitExportFrame();queueExport();};
$('exportWidth').onchange=()=>{exportCfg.width=clampExportWidth($('exportWidth').value);fitExportFrame();queueExport();};
$('exportResize').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();exportCfg.width=clampExportWidth(e.key==='Home'?minExportWidth():e.key==='End'?4000:exportCfg.width+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?200:50));fitExportFrame();queueExport();};
$('exportResize').onpointerdown=e=>{
  if(e.button!==0)return;e.preventDefault();const start={x:e.clientX,width:exportCfg.width,scale:exportCfg.scale,pointer:e.pointerId};exportDrag={...start,next:start.width};$('exportResize').setPointerCapture(e.pointerId);
  const guide=$('exportGuide');guide.hidden=false;guide.style.left=exportFrame.offsetLeft+'px';guide.style.top=exportFrame.offsetTop+'px';guide.style.width=exportFrame.offsetWidth+'px';guide.style.height=exportFrame.offsetHeight+'px';
};
window.addEventListener('pointermove',e=>{if(!exportDrag||e.pointerId!==exportDrag.pointer)return;exportDrag.next=clampExportWidth(exportDrag.width+(e.clientX-exportDrag.x)/exportDrag.scale);$('exportGuide').style.width=Math.min(exportStage.clientWidth-40,exportDrag.next*exportDrag.scale)+'px';$('exportWidth').value=exportDrag.next;});
function finishExportResize(e){if(!exportDrag||e.pointerId!==exportDrag.pointer)return;exportCfg.width=e.type==='pointercancel'?exportDrag.width:exportDrag.next;exportDrag=null;$('exportGuide').hidden=true;fitExportFrame();queueExport(0);}
window.addEventListener('pointerup',finishExportResize);window.addEventListener('pointercancel',finishExportResize);
$('exportDialog').addEventListener('close',()=>{exportRevision++;clearTimeout(exportTimer);exportDrag=null;$('exportGuide').hidden=true;});
new ResizeObserver(()=>{if($('exportDialog').open&&!exportDrag)fitExportFrame();}).observe(exportStage);
$('svgBtn').onclick=()=>{if(exportData)download(new Blob([exportData.markup],{type:'image/svg+xml'}),filename('svg'));};
$('pngBtn').onclick=async()=>{
  if(!exportData)return;const data=exportData;$('pngBtn').disabled=true;
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=data.url;});const scale=Math.min(2,16000/data.width,16000/data.height,Math.sqrt(60000000/(data.width*data.height))),canvas=document.createElement('canvas');canvas.width=Math.round(data.width*scale);canvas.height=Math.round(data.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw Error('PNG konnte nicht erstellt werden.');download(png,filename('png'));}
  catch{$('exportStatus').textContent='PNG konnte nicht erstellt werden. Bitte erneut versuchen.';}finally{$('pngBtn').disabled=false;}
};
function preparePrint(data){
  let holder=$('printReport');if(!holder){holder=document.createElement('div');holder.id='printReport';holder.hidden=true;document.body.append(holder);}
  let style=$('printPageStyle');if(!style){style=document.createElement('style');style.id='printPageStyle';document.head.append(style);}
  const landscape=data.width>=data.height,pageW=landscape?400:277,pageH=landscape?276:399,factor=Math.min(pageW/data.width,pageH/data.height);
  style.textContent=`@page{size:A3 ${landscape?'landscape':'portrait'};margin:10mm}@media print{#printReport>svg{width:${data.width*factor}mm;height:${data.height*factor}mm;max-width:100%;display:block;margin:auto}}`;
  holder.innerHTML=data.markup;
}
function printReport(){if(!exportData)return;preparePrint(exportData);printing=true;$('exportDialog').close();try{window.print();}finally{printing=false;}}
$('printBtn').onclick=printReport;
window.addEventListener('beforeprint',()=>{if(!printing)preparePrint($('exportDialog').open&&exportData?exportData:report(p,view.labels,{...exportCfg,scale:view.scale}));});
let resizeTimer,lastWidth=0;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)<1)return;lastWidth=width;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!drag)renderChart();},100);}).observe($('chartScroll'));
render();document.addEventListener('DOMContentLoaded',icons,{once:true});
if(migrationRaw){try{if(!localStorage.getItem(KEY+':before-merge'))localStorage.setItem(KEY+':before-merge',migrationRaw);persist();toast('Bestehende Sicherheiten wurden an Meilensteine gekoppelt. Bisherige Werte und Termine bleiben erhalten.');}catch{$('storageAlert').hidden=false;$('storageAlert').textContent='Die Sicherheiten wurden im geöffneten Plan zugeordnet. Bitte sichere den Plan als Datei; der Browser konnte ihn nicht speichern.';}}

if(renamedExample&&!migrationRaw)persist();
