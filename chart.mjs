import {day,iso,today,dateLabel,number,percentLabel,money,cumulative,resolveDate,ranges,share,securitiesAtMilestone,isoWeek} from './model.mjs';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cut=(text,n)=>text.length>n?text.slice(0,n-1)+'…':text;
const months=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const letters=['J','F','M','A','M','J','J','A','S','O','N','D'];
const f=n=>Number(n.toFixed(2));
const text=(x,y,value,attrs='')=>`<text x="${f(x)}" y="${f(y)}" ${attrs}>${esc(value)}</text>`;
const line=(x1,y1,x2,y2,attrs='')=>`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" ${attrs}/>`;
const rect=(x,y,w,h,attrs='')=>`<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0,w))}" height="${f(Math.max(0,h))}" ${attrs}/>`;
const diamond=(x,y,size,attrs='')=>`<path d="M${f(x)} ${f(y-size)}l${size} ${size}l-${size} ${size}l-${size} -${size}Z" ${attrs}/>`;
const editable=(type,id,label,body,drag=false)=>`<g class="interactive${drag?' draggable':''}" data-type="${type}" data-id="${esc(id)}" role="button" tabindex="0" aria-label="${esc(label)}"><title>${esc(label)}</title>${body}</g>`;
const labelContext=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
function labelWidth(value,bold=false){if(labelContext){labelContext.font=(bold?'700':'400')+' 10px "Segoe UI",Arial,sans-serif';return labelContext.measureText(value).width;}return [...value].reduce((sum,c)=>sum+(/[ilI.,:!\s]/.test(c)?2.8:/[MW@%]/.test(c)?8:5.5),0)*(bold?1.08:1);}
function paymentLines(value,width,prefix){
  const boldExtra=labelWidth(prefix,true)-labelWidth(prefix),available=()=>width-(out.length?0:boldExtra);
  const out=[];let current='';
  for(const word of value.trim().split(/\s+/)){
    if(current&&labelWidth(current+word)>available()){out.push(current);current='';}
    for(const c of word){if(labelWidth(current+c)>available()&&current){out.push(current);current='';}current+=c;}
    current+=' ';
  }
  if(current.trim())out.push(current.trim());return out.map(line=>line.trim());
}
function segmentHits(a,b,r){
  let low=0,high=1;
  for(const [v,delta,min,max] of [[a.x,b.x-a.x,r.x1,r.x2],[a.y,b.y-a.y,r.y1,r.y2]]){
    if(Math.abs(delta)<.001){if(v<=min||v>=max)return false;continue;}
    let t1=(min-v)/delta,t2=(max-v)/delta;if(t1>t2)[t1,t2]=[t2,t1];low=Math.max(low,t1);high=Math.min(high,t2);if(low>=high)return false;
  }
  return true;
}
export function domain(p,scale='month') {
  const dates=[...p.milestones.map(m=>m.date),...ranges(p)].sort();
  const first=day(dates[0]||today()),last=day(dates.at(-1)||today());
  const a=new Date(first*86400000),b=new Date(last*86400000);
  if(scale==='week')return {start:first-(a.getUTCDay()+6)%7,end:last-(b.getUTCDay()+6)%7+7};
  const step=scale==='quarter'?3:1;
  return {start:Date.UTC(a.getUTCFullYear(),Math.floor(a.getUTCMonth()/step)*step,1)/86400000,
    end:Date.UTC(b.getUTCFullYear(),Math.floor(b.getUTCMonth()/step)*step+step,1)/86400000};
}
export function timeline(p,options={}) {
  const scale=options.scale||'month',labels=options.labels!==false,prefix=options.prefix||'live';
  const {start,end}=options.domain||domain(p,scale),left=192,right=24,header=53;
  const firstDate=new Date(start*86400000),lastDate=new Date((end-1)*86400000);
  const width=Math.max(360,options.width||1300);
  const plotW=width-left-right,x=d=>left+(d-start)/(end-start)*plotW,datedX=date=>x(day(date));
  let y=header;
  const phaseSlots=[],phaseLayout=[];
  for(const phase of [...p.phases].sort((a,b)=>a.start.localeCompare(b.start))){let slot=phaseSlots.findIndex(end=>end<phase.start);if(slot<0)slot=phaseSlots.length;phaseSlots[slot]=phase.end;phaseLayout.push({phase,slot});}
  const phaseHeight=Math.max(1,phaseSlots.length)*34+12,phaseY=y;y+=phaseHeight;
  // Later securities sit above earlier ones, forming an ascending sequence like the reference.
  const securities=p.securities.filter(s=>s.kind!=='warranty'),warranties=p.securities.filter(s=>s.kind==='warranty');
  const securityRows=[...securities.map(item=>({type:'security',item,date:resolveDate(item,'start',p)})),
    ...p.milestones.filter(m=>m.value===0).map(item=>({type:'milestone',item,date:item.date}))].sort((a,b)=>b.date.localeCompare(a.date));
  const securityY=y;y+=Math.max(1,securityRows.length)*36+12;
  const warrantyY=y;if(warranties.length)y+=warranties.length*36+12;
  const vspY=y,vspMs=p.milestones.filter(m=>m.vsp).sort((a,b)=>a.date.localeCompare(b.date));
  // VSP events on separate tracks when their labels would overlap.
  const vspSlots=[],vspLayout=[];
  for(const m of vspMs){const px=datedX(m.date),bw=Math.min(245,m.name.length*5.5+26);let slot=vspSlots.findIndex(last=>last<px-8);if(slot<0)slot=vspSlots.length;vspSlots[slot]=px+bw;vspLayout.push({m,slot});}
  y+=Math.max(1,vspSlots.length)*30+15;
  const payY=y,points=cumulative(p).filter(m=>m.value>0),payTop=y+38,payBottom=payTop+(labels?Math.max(210,Math.min(400,points.length*46)):210);
  const total=points.at(-1)?.cumulative||0,maxY=Math.max(100,Math.ceil(total/10)*10),py=value=>payBottom-value/maxY*(payBottom-payTop);
  const positions=points.map(m=>({...m,x:datedX(m.date),y:py(m.cumulative)})),segments=[];
  let previous={x:left,y:payBottom};
  for(const m of positions){segments.push({x1:previous.x,y1:previous.y,x2:m.x,y2:previous.y},{x1:m.x,y1:previous.y,x2:m.x,y2:m.y});previous=m;}
  segments.push({x1:previous.x,y1:previous.y,x2:width-right,y2:previous.y});
  const curveObstacles=segments.map(s=>({x1:Math.min(s.x1,s.x2)-4,y1:Math.min(s.y1,s.y2)-4,x2:Math.max(s.x1,s.x2)+4,y2:Math.max(s.y1,s.y2)+4}));
  const placed=[];
  if(labels){
    // Keep complete labels to the right below each corner. Stack crowded cards downwards.
    for(const m of positions){
      const prefix=percentLabel(m.percent),label=prefix+' '+m.name,maxWidth=Math.min(238,plotW-16,Math.max(112,labelWidth(label)+labelWidth(prefix,true)-labelWidth(prefix)+20));
      const minWidth=Math.min(maxWidth,Math.max(112,...label.split(/\s+/).map(word=>labelWidth(word)+20)));
      const cardObstacles=placed.map(b=>({x1:b.x-8,y1:b.y-8,x2:b.x+b.w+8,y2:b.y+b.h+8}));
      const obstacles=[...curveObstacles,...cardObstacles];
      let best;
      const widths=[maxWidth,170].map(w=>Math.max(minWidth,Math.min(maxWidth,w)));
      for(const bw of new Set(widths)){
        const lines=paymentLines(label,bw-20,prefix),bh=lines.length*14+12;
        const candidates=[m.x+12,m.x+40,m.x+80,...(positions.length<80?[m.x+140,m.x+220,...placed.filter(b=>b.x+b.w>m.x&&b.x+b.w<m.x+350).map(b=>b.x+b.w+8)]:[])].map(px=>Math.min(width-right-bw-8,Math.max(left+8,px)));
        for(const bx of new Set(candidates)){
          let by=m.y+10;
          for(let attempt=0;attempt<=obstacles.length;attempt++){
            const hits=obstacles.filter(o=>bx<o.x2&&bx+bw>o.x1&&by<o.y2&&by+bh>o.y1);
            if(!hits.length)break;
            by=Math.max(...hits.map(o=>o.y2));
          }
          const anchorX=Math.max(bx+9,Math.min(bx+bw-9,m.x)),from={x:m.x+5,y:m.y+5},to={x:anchorX,y:by};
          const crossings=obstacles.filter(o=>segmentHits(from,to,o)).length,displaced=by>m.y+10.1||Math.abs(bx-m.x-12)>.1;
          const score=(by-m.y-10)*1.5+Math.abs(bx-m.x-12)*.6+crossings*10+(maxWidth-bw)*.06;
          if(!best||score<best.score)best={x:bx,y:by,w:bw,h:bh,label,prefix,lines,anchorX,score,displaced};
        }
      }
      m.labelBox=best;placed.push(best);
    }
  }
  // Route displaced callouts around the other cards, keeping every full name readable.
  for(const m of positions)if(m.labelBox?.displaced){
    const box=m.labelBox,from={x:m.x+2,y:m.y+2};
    const cards=placed.filter(b=>b!==box).map(b=>({x1:b.x-1,y1:b.y-1,x2:b.x+b.w+1,y2:b.y+b.h+1}));
    const curves=segments.map(s=>({x1:Math.min(s.x1,s.x2)-1.25,y1:Math.min(s.y1,s.y2)-1.25,x2:Math.max(s.x1,s.x2)+1.25,y2:Math.max(s.y1,s.y2)+1.25})).filter(r=>!(from.x>r.x1&&from.x<r.x2&&from.y>r.y1&&from.y<r.y2));
    const cardObstacles=[...cards,{x1:box.x+.01,y1:box.y+.01,x2:box.x+box.w-.01,y2:box.y+box.h-.01}],routes=[];
    const ends=[{x:box.anchorX,y:box.y},...[box.x,box.x+box.w].flatMap(x=>[{x,y:box.y+9},{x,y:box.y+box.h/2},{x,y:box.y+box.h-9}])];
    const routesAt=[left+3,width-right-3,...cards.flatMap(r=>[r.x1-4,r.x2+4])];
    const rowsAt=cards.filter(r=>r.x2>Math.min(from.x,box.x)-10&&r.x1<box.x+box.w+10).flatMap(r=>[r.y1-4,r.y2+4]);
    for(const to of ends){
      routes.push([from,to],[from,{x:from.x,y:to.y},to],[from,{x:to.x,y:from.y},to]);
      for(const rx of new Set(routesAt))if(rx>=left&&rx<=width-right)routes.push([from,{x:rx,y:from.y},{x:rx,y:to.y-4},{x:to.x,y:to.y-4},to]);
      for(const ry of new Set(rowsAt))if(ry>=payY+4)routes.push([from,{x:from.x,y:ry},{x:to.x,y:ry},to]);
    }
    let best;
    for(const route of routes){let length=0,hits=0,crossings=0;for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i];length+=Math.hypot(a.x-b.x,a.y-b.y);hits+=cardObstacles.filter(r=>segmentHits(a,b,r)).length;crossings+=curves.filter(r=>segmentHits(a,b,r)).length;}const score=hits*100000+crossings*1000+length+(route.length-2)*8;if(!best||score<best.score)best={route,score};}
    box.connector=[{x:m.x,y:m.y},...best.route];
  }
  const height=Math.max(payBottom+48,...placed.map(b=>b.y+b.h+23));
  let content='',defs='';
  content+=rect(0,0,width,height,'fill="#fff"');
  for(let year=firstDate.getUTCFullYear();day(year+'-01-01')<end;year++){
    const a=x(Math.max(start,day(year+'-01-01'))),b=x(Math.min(end,day((year+1)+'-01-01')));
    content+=rect(a,0,b-a,height,`fill="${year%2?'#fff':'#fafbfe'}"`);
    content+=rect(a,0,b-a,26,'fill="#f0f2f7"');
    if((scale!=='week'||plotW/(end-start)*28<70)&&b-a>35)content+=text(a+10,18,year,'font-size="11" font-weight="700" fill="#4a566f"');
    for(let month=0;month<12;month++){
      const md=Date.UTC(year,month,1)/86400000,periodEnd=Date.UTC(year,month+(scale==='quarter'?3:1),1)/86400000;
      if(periodEnd<=start||md>=end)continue;
      const mx=x(Math.max(start,md)),nx=x(Math.min(end,periodEnd)),mw=nx-mx;
      if(scale==='week'){
        if(mw>=70)content+=text(mx+8,18,months[month]+' '+year,'font-size="11" font-weight="650" fill="#4a566f" data-period="month-group"');
        content+=line(mx,0,mx,26,'stroke="#d9dfeb"');
        continue;
      }
      if(scale==='quarter'){
        if(month%3!==0)continue;
        content+=line(mx,26,mx,height,'stroke="#dfe5ef"');
        content+=text(mx+9,44,'Q'+(Math.floor(month/3)+1),`font-size="11" fill="#748198" data-period="quarter" data-start="${iso(md)}"`);
        continue;
      }
      if(mw<11&&month%3!==0)continue;
      content+=line(mx,26,mx,height,`stroke="${month===0?'#d9dfeb':'#e9edf4'}" stroke-width="1"`);
      content+=text(mx+(mw<36?mw/2:7),44,mw>=36?months[month]:mw<11?'Q'+(Math.floor(month/3)+1):letters[month],`font-size="10" fill="#7a8599" data-period="month" data-start="${iso(md)}"${mw<36?' text-anchor="middle"':''}`);
    }
  }
  if(scale==='week'){
    const first=start-((new Date(start*86400000).getUTCDay()+6)%7);
    const weekWidth=plotW/(end-start)*7,labelEvery=Math.max(1,Math.ceil(22/weekWidth));
    for(let tick=first;tick<end;tick+=7){
      const a=x(Math.max(start,tick)),b=x(Math.min(end,tick+7)),week=isoWeek(tick);
      content+=line(a,26,a,height,'stroke="#e6eaf2"');
      if((tick-first)/7%labelEvery===0){const cx=Math.max(left+12,Math.min(width-right-12,(a+b)/2));content+=text(cx,44,(b-a>36?'KW ':'')+String(week.week).padStart(2,'0'),`font-size="9" text-anchor="middle" fill="#748198" data-period="week" data-start="${iso(tick)}" data-week-year="${week.year}"`);}
    }
  }
  content+=rect(left,payBottom+1,plotW,height-payBottom-1,'fill="#fff"');
  // Sidebar backgrounds are painted after the grid, keeping section labels readable.
  content+=rect(0,0,left,height,'fill="#fff"');
  content+=rect(0,0,left,header,'fill="#f5f6fa"');
  content+=text(18,24,'ZEITRAUM','font-size="9" font-weight="700" letter-spacing="1" fill="#8290a5"');
  const rangeLabel=firstDate.getUTCFullYear()===lastDate.getUTCFullYear()?String(firstDate.getUTCFullYear()):firstDate.getUTCFullYear()+' – '+lastDate.getUTCFullYear();
  content+=text(18,42,rangeLabel,'font-size="11" font-weight="600" fill="#4a566f"');
  content+=line(left,0,left,height,'stroke="#d9dfeb"');
  for(const border of [header,securityY,warrantyY,vspY,payY,height-1])content+=line(0,border,width,border,'stroke="#e5e9f1"');
  content+=text(18,phaseY+26,'Projektphasen','font-size="11" font-weight="650" fill="#526077"');
  content+=text(18,phaseY+41,p.phases.length+' Phasen','font-size="9" fill="#9aa3b2"');
  if(!p.phases.length)content+=text(left+15,phaseY+29,'Noch keine Projektphasen','font-size="10" fill="#a0a8b7"');
  let clip=0;
  for(const {phase:s,slot} of phaseLayout){
    const a=datedX(s.start),b=datedX(s.end)+plotW/(end-start),barY=phaseY+10+slot*34,w=Math.max(3,b-a),cid=prefix+'-phase-'+clip++;
    defs+=`<clipPath id="${cid}">${rect(a+3,barY,w-6,25,'rx="5"')}</clipPath>`;
    const grip=Math.min(10,w/2);
    content+=editable('phase',s.id,`${s.name} · ${dateLabel(s.start)} – ${dateLabel(s.end)}`,rect(a,barY,w,25,'rx="5" fill="#e8e5fb" class="focus-shape"')+(w>32?text(a+8,barY+16,cut(s.name,Math.max(3,Math.floor((w-12)/5.2))),`font-size="10" font-weight="600" fill="#685ab3" clip-path="url(#${cid})"`):'')+rect(a,barY-4,grip,33,'fill="transparent" data-edge="start" class="resize-handle"')+rect(a+w-grip,barY-4,grip,33,'fill="transparent" data-edge="end" class="resize-handle"'),true);
  }
  const securityRow=(s,rowY,milestone=false)=>{
    const aDate=milestone?s.date:resolveDate(s,'start',p),bDate=milestone?(s.securityEnd||s.date):resolveDate(s,'end',p),a=datedX(aDate),b=datedX(bDate)+plotW/(end-start),bad=bDate<aDate,w=Math.max(4,b-a),warranty=s.kind==='warranty',title=`${s.name}${warranty||milestone?'':' · '+(s.unit==='amount'?money(s.value,p.currency):percentLabel(s.value))} · ${dateLabel(aDate)} – ${dateLabel(bDate)}`,cid=prefix+'-security-'+clip++;
    defs+=`<clipPath id="${cid}">${rect(a+4,rowY+6,w-8,24,'rx="4"')}</clipPath>`;
    let bar=rect(a,rowY+6,w,24,`rx="4" fill="${bad?'#ffe1e6':warranty?'#d9e0eb':'#f8cf76'}" class="focus-shape"`);
    const label=(warranty||milestone?'':percentLabel(share(s,p))+' · ')+s.name;
    if(w>32)bar+=text(a+8,rowY+22,cut(label,Math.max(3,Math.floor((w-12)/5.1))),`font-size="10" fill="${warranty?'#52647c':'#7c5920'}" font-weight="550" clip-path="url(#${cid})"`);
    else{const after=width-right-(a+w+8),before=a-left-8,useRight=after>=before,space=useRight?after:before;bar+=text(useRight?a+w+8:a-8,rowY+22,cut(label,Math.max(3,Math.floor(space/5.5))),`font-size="10" fill="${warranty?'#52647c':'#7c5920'}" font-weight="550"${useRight?'':' text-anchor="end"'}`);}
    for(const [edge,dx] of [['start',a],['end',a+w]])bar+=rect(dx-5,rowY+1,10,34,`fill="transparent" data-edge="${edge}" class="resize-handle"`);
    if(warranty){content+=text(18,rowY+17,'Gewährleistung','font-size="11" font-weight="650" fill="#526077"');content+=text(18,rowY+30,cut(s.name,28),'font-size="9" fill="#96a0b2"');}
    content+=editable(milestone?'milestone':'security',s.id,title,bar,true);
  };
  for(let i=1;i<securityRows.length;i++)content+=line(left,securityY+5+i*36,width-right,securityY+5+i*36,'stroke="#e5e9f1"');
  securityRows.forEach(({type,item:m},i)=>{
    const rowY=securityY+5+i*36;
    securityRow(m,rowY,type==='milestone');
  });
  if(securityRows.length){content+=text(18,securityY+(warrantyY-securityY)/2-2,'Sicherheiten','font-size="11" font-weight="650" fill="#526077"');content+=text(18,securityY+(warrantyY-securityY)/2+13,'Bürgschaft / Garantie / Termine','font-size="9" fill="#96a0b2"');}
  if(!securityRows.length){content+=text(18,securityY+26,'Sicherheiten','font-size="11" font-weight="650" fill="#526077"');content+=text(left+15,securityY+28,'Noch keine Sicherheiten','font-size="10" fill="#a0a8b7"');}
  warranties.forEach((s,i)=>securityRow(s,warrantyY+5+i*36));
  content+=text(18,vspY+24,'Verzugsschadenspauschale','font-size="10" font-weight="650" fill="#526077"');
  content+=text(18,vspY+38,'VSP-Termine','font-size="9" fill="#9aa3b2"');
  for(const {m,slot} of vspLayout){const mx=datedX(m.date),my=vspY+22+slot*30,label=cut(m.name,34),flip=mx+13+label.length*5.5>width-right;content+=editable('milestone',m.id,`${m.name} · VSP · ${dateLabel(m.date)}${m.vspNote?' · '+m.vspNote:''}`,diamond(mx,my,7,'fill="#df4662" stroke="#fff" stroke-width="2" class="focus-shape"')+rect(mx-12,my-12,24,24,'fill="transparent"')+text(mx+(flip?-13:13),my+4,label,`font-size="10" font-weight="600" fill="#b84f63"${flip?' text-anchor="end"':''}`),true);}
  if(!vspMs.length)content+=text(left+15,vspY+27,'Keine VSP-Termine erfasst','font-size="10" fill="#a0a8b7"');
  const axisLeft=left-101,axisWidth=87,axisCenter=axisLeft+axisWidth/2,axisY=(payTop+payBottom)/2-10,gradient=prefix+'-payment-axis';
  defs+=`<linearGradient id="${gradient}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#eea33c"/><stop offset="1" stop-color="#fff0cf"/></linearGradient>`;
  content+=text(47,axisY,'Zahlungsverlauf (in %)',`text-anchor="middle" font-size="11" font-weight="650" fill="#526077" transform="rotate(-90 47 ${f(axisY)})"`);
  for(let pct=0;pct<=maxY;pct+=maxY>150?Math.ceil(maxY/100)*10:10){
    const ay=py(pct)-10,barWidth=axisWidth*pct/maxY;
    content+=line(left,py(pct),width-right,py(pct),`stroke="${pct===100?'#e1c5a4':'#e8ecf3'}"${pct===100?' stroke-dasharray="4 4"':''}`);
    content+=line(axisLeft-3,ay+10,left-4,ay+10,'stroke="#edf0f5"');
    if(pct>0)content+=rect(axisLeft,ay-9,barWidth,18,`rx="1" fill="url(#${gradient})" stroke="#e9ba70" stroke-width=".5" data-axis-percent="${pct}"`);
    content+=text(axisCenter,ay+4,number(pct)+' %','text-anchor="middle" font-size="10" font-weight="550" fill="#76531f"');
  }
  let d=`M${left} ${payBottom}`;
  for(const m of positions)d+=` H${f(m.x)} V${f(m.y)}`;
  d+=` H${f(width-right)}`;
  content+=`<path d="${d} V${payBottom} H${left}Z" fill="#efaa53" fill-opacity=".08"/>`;
  content+=`<path d="${d}" fill="none" stroke="#e88a36" stroke-width="2.5" stroke-linejoin="miter"/>`;
  for(const m of positions)if(m.labelBox?.connector){const d=m.labelBox.connector.map((pt,i)=>(i?'L':'M')+f(pt.x)+' '+f(pt.y)).join(' ');content+=`<path d="${d}" fill="none" stroke="#c5a37b" stroke-width="1" class="payment-connector" pointer-events="none"/>`;}
  for(const [index,m] of positions.entries()){
    const previousY=index?positions[index-1].y:payBottom;
    const title=`${m.name} · ${dateLabel(m.date)} · ${percentLabel(m.percent)} · kumuliert ${percentLabel(m.cumulative)}`;
    let body=rect(m.x-8,Math.min(previousY,m.y)-4,16,Math.abs(previousY-m.y)+8,'fill="transparent" class="payment-hit"')+line(m.x,previousY,m.x,m.y,'stroke="transparent" stroke-width="3.5" class="payment-step" pointer-events="none"');
    if(m.labelBox){
      const box=m.labelBox;
      body+=rect(box.x,box.y,box.w,box.h,'rx="5" fill="#fff8ed" stroke="#efd6b6" class="payment-label focus-shape"');
      box.lines.forEach((label,i)=>{body+=i?text(box.x+10,box.y+16+i*14,label,'font-size="10" font-weight="400" fill="#975b24" class="payment-label-text"'):`<text x="${f(box.x+10)}" y="${f(box.y+16)}" font-size="10" font-weight="400" fill="#975b24" class="payment-label-text"><tspan font-weight="700">${esc(box.prefix)}</tspan><tspan>${esc(label.slice(box.prefix.length))}</tspan></text>`;});
    }
    content+=editable('milestone',m.id,title,body,true);
  }
  if(!points.length)content+=text(left+plotW/2,payTop+104,'Erfasse eine Teilzahlung, um den Zahlungsverlauf zu sehen.','text-anchor="middle" font-size="12" fill="#98a2b2"');
  content+=text(left,height-13,'Zieltermine der Teilzahlungen','font-size="9" fill="#9aa3b2"');
  content+=text(width-right,height-13,'Gesamt '+percentLabel(total),'text-anchor="end" font-size="10" font-weight="650" fill="#bf7430"');
  return {markup:`<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}" height="${height}" viewBox="0 0 ${f(width)} ${height}" role="group" aria-label="Zahlungsplan: ${points.length} Teilzahlungen, ${percentLabel(total)} kumulierte Teilzahlungen" style="font-family:'Segoe UI',Arial,sans-serif"><defs>${defs}</defs>${content}</svg>`,content,defs,width,height,start,end,left,plotW,positions};
}
function wrapped(value,max){max=Math.max(1,max);const words=String(value||'').split(/\s+/),out=[];let line='';for(const word of words){if(line.length+word.length+1>max&&line){out.push(line);line='';}if(word.length>max){if(line){out.push(line);line='';}for(let i=0;i<word.length;i+=max)out.push(word.slice(i,i+max));}else line+=(line?' ':'')+word;}if(line)out.push(line);return out.length?out:['–'];}
export function report(p,labels=true,options={}){
  const width=Math.max(520,Math.min(4000,options.width||1480)),withList=options.withList!==false,inner=width-64;
  const chart=timeline(p,{width:inner,labels,scale:options.scale||'month',prefix:'report'});
  const subtitle=[p.reference,p.total>0?'Vertragssumme '+money(p.total,p.currency):''].filter(Boolean).join(' · '),subLines=subtitle?wrapped(subtitle,Math.floor(inner/6)):[];
  const chartY=84+subLines.length*15;let y=chartY+chart.height;
  let body=rect(0,0,width,chartY,'fill="#fff"')+text(32,32,'Trapanotto / Zahlungsplan','font-size="12" font-weight="600" fill="#6c768b"')+text(32,65,cut(p.title,Math.max(10,Math.floor(inner/14))),'font-size="25" font-weight="700" fill="#222b3b"');
  subLines.forEach((line,i)=>body+=text(32,85+i*15,line,'font-size="11" fill="#7a8598"'));
  body+=`<g transform="translate(32,${chartY})">${chart.content}</g>`;
  const table=(title,headers,weights,rows)=>{
    const sum=weights.reduce((a,b)=>a+b,0),widths=weights.map(w=>inner*w/sum);
    y+=32;body+=text(32,y,title,'font-size="16" font-weight="700" fill="#263246"');y+=16;
    const headLines=headers.map((h,i)=>wrapped(h,Math.floor((widths[i]-20)/6))),headHeight=Math.max(31,Math.max(...headLines.map(ls=>ls.length))*15+16);
    body+=rect(32,y,inner,headHeight,'rx="4" fill="#eef1f7"');
    let tx=32;headLines.forEach((ls,i)=>{ls.forEach((line,j)=>body+=text(tx+10,y+19+j*15,line,'font-size="10" font-weight="650" fill="#5b6880"'));tx+=widths[i];});y+=headHeight;
    rows.forEach((cells,index)=>{
      const lines=cells.map((s,i)=>wrapped(s,Math.floor((widths[i]-20)/6))),rh=Math.max(38,Math.max(...lines.map(a=>a.length))*16+18);
      body+=rect(32,y,inner,rh,`fill="${index%2?'#f8f9fc':'#fff'}"`);tx=32;
      lines.forEach((ls,i)=>{ls.forEach((line,j)=>body+=text(tx+10,y+22+j*16,line,`font-size="11" fill="${i===0?'#ba702d':'#40506a'}"${i===0?' font-weight="650"':''}`));tx+=widths[i];});y+=rh;
      body+=line(32,y,width-32,y,'stroke="#e6eaf2"');
    });
  };
  if(withList){
    table('Meilensteine & Teilzahlungen',['Teilzahlung','Meilenstein / Beschreibung','Zieltermin','Kumuliert','VSP','Sicherheiten / Beschreibung'],[124,374,112,95,213,498],cumulative(p).map(m=>[
      percentLabel(m.percent)+(m.amount!==null?' / '+money(m.amount,p.currency):''),m.name+(m.description?' — '+m.description:''),dateLabel(m.date),percentLabel(m.cumulative),m.vsp?('VSP'+(m.vspValue?' · '+(m.vspUnit==='amount'?money(m.vspValue,p.currency):percentLabel(m.vspValue)):'')+(m.vspNote?' · '+m.vspNote:'')):'–',securitiesAtMilestone(m.id,p)||'–'
    ]));
    if(p.phases.length)table('Projektphasen',['Phase','Beginn','Ende','Beschreibung'],[350,160,160,746],p.phases.map(s=>[s.name,dateLabel(s.start),dateLabel(s.end),s.description||'–']));
    if(p.notes){y+=28;body+=text(32,y,'Notizen','font-size="13" font-weight="700" fill="#526077"');for(const line of wrapped(p.notes,Math.floor(inner/6))){y+=17;body+=text(32,y,line,'font-size="11" fill="#66748a"');}}
  }
  y+=35;body+=text(32,y,'Zahlungsplan · Trapanotto · '+dateLabel(today()),'font-size="10" fill="#99a2b2"');y+=25;
  return {markup:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}" style="font-family:'Segoe UI',Arial,sans-serif"><defs>${chart.defs}</defs><rect width="100%" height="100%" fill="white"/>${body}</svg>`,width,height:y};
}
