function eventInput(value){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const part=name=>parts.find(p=>p.type===name).value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
function eventStatus(event){
  if(+new Date(event.starts_at)>Date.now())return ['Kommend','planned'];
  if(event.ends_at&&+new Date(event.ends_at)>Date.now())return ['Läuft gerade',''];
  return ['Vergangen','inactive'];
}
function eventTimeRange(event){
  const start=`${date(event.starts_at)} · ${time(event.starts_at)} Uhr`;
  if(!event.ends_at)return start;
  const sameDay=eventInput(event.starts_at).slice(0,10)===eventInput(event.ends_at).slice(0,10);
  return `${start} – ${sameDay?'':date(event.ends_at)+' · '}${time(event.ends_at)} Uhr`;
}
async function renderEvents(epoch){
  $('#main').innerHTML=`${pageHeading('Unsere Events.','Alle Termine für das Team. Gemeinsam geplant.','Veranstaltungen')}<div id="events-content" class="table-empty">Events werden geladen …</div>`;
  try{
    const {events}=await api('/events');if(epoch!==state.epoch)return;
    state.events=events;
    const upcoming=events.filter(e=>eventStatus(e)[0]!=='Vergangen');
    const todayCount=events.filter(e=>eventInput(e.starts_at).slice(0,10)===today()).length;
    const content=$('#events-content');content.className='';
    content.innerHTML=`<div class="stat-cards event-metrics">${[['Kommende Events',upcoming.length,'calendar','Inklusive laufender Veranstaltungen'],['Heute',todayCount,'clock','Termine am heutigen Tag'],['Alle Events',events.length,'cocktail','Die gesamte Terminübersicht']].map(([label,count,drawing,hint])=>`<div class="stat-card"><div class="metric-label">${label}${icon(drawing)}</div><strong>${count}</strong><div class="helper">${hint}</div></div>`).join('')}</div><div class="toolbar event-toolbar"><div class="event-filters"><label class="sr-only" for="event-filter">Events filtern</label><select id="event-filter">${[['upcoming','Kommend & laufend'],['all','Alle Events'],['past','Vergangen']].map(([value,label])=>`<option value="${value}" ${value===(state.eventFilter||'upcoming')?'selected':''}>${label}</option>`).join('')}</select><div class="search">${icon('search')}<input id="event-search" type="search" aria-label="Events suchen" placeholder="Event suchen …" value="${esc(state.eventSearch||'')}"></div></div><div class="event-toolbar-actions"><button class="button" data-action="refresh">${icon('clock')}Aktualisieren</button><button class="button gold" data-action="new-event">${icon('plus')}Event eintragen</button></div></div><div class="event-list-heading"><h2 class="section-title">Termine im Überblick</h2><span class="eyebrow" id="event-count"></span></div><div class="event-grid" id="event-grid"></div>`;
    $('#event-search').addEventListener('input',event=>{state.eventSearch=event.target.value;drawEvents();});
    $('#event-filter').addEventListener('change',event=>{state.eventFilter=event.target.value;drawEvents();});
    drawEvents();
  }catch(error){if(epoch===state.epoch&&$('#events-content'))$('#events-content').innerHTML=`<p class="error">${esc(error.message)}</p><button class="button" data-action="refresh">Erneut laden</button>`;}
}
function drawEvents(){
  const search=(state.eventSearch||'').toLocaleLowerCase('de-DE'),filter=state.eventFilter||'upcoming';
  const rows=state.events.filter(e=>{
    const past=eventStatus(e)[0]==='Vergangen';
    return (filter==='all'||(filter==='past'?past:!past))&&`${e.title} ${e.description} ${e.created_by_name}`.toLocaleLowerCase('de-DE').includes(search);
  }).sort((a,b)=>{
    const aPast=eventStatus(a)[0]==='Vergangen',bPast=eventStatus(b)[0]==='Vergangen';
    if(aPast!==bPast)return aPast?1:-1;
    return aPast?+new Date(b.starts_at)-+new Date(a.starts_at):+new Date(a.starts_at)-+new Date(b.starts_at);
  });
  $('#event-count').textContent=`${rows.length} ${rows.length===1?'Termin':'Termine'}`;
  $('#event-grid').innerHTML=rows.length?rows.map(event=>{
    const [label,cls]=eventStatus(event),parts=eventInput(event.starts_at).slice(0,10).split('-');
    const month=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',month:'short'}).format(new Date(event.starts_at));
    const weekday=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'long'}).format(new Date(event.starts_at));
    return `<article class="event-card ${cls==='inactive'?'event-past':''}"><div class="event-card-top"><div class="event-date" aria-label="${esc(date(event.starts_at))}"><span>${esc(month)} ${parts[0]}</span><strong>${parts[2]}</strong><small>${esc(weekday)}</small></div><div class="event-card-title"><span class="badge ${cls}">${label}</span><h2>${esc(event.title)}</h2><p class="event-time">${icon('clock')}${esc(eventTimeRange(event))}</p></div></div><p class="event-description">${esc(event.description||'Keine weiteren Informationen eingetragen.')}</p><div class="event-card-footer"><span class="event-author">${icon('user')}Eingetragen von ${esc(event.created_by_name)}</span><div class="event-card-actions"><button class="detail-button" data-action="event-details" data-id="${esc(event.id)}">Details ${icon('arrow')}</button><button class="button" data-action="edit-event" data-id="${esc(event.id)}" aria-label="${esc(event.title)} bearbeiten">${icon('edit')}Bearbeiten</button></div></div></article>`;
  }).join(''):`<div class="empty-state">${icon('calendar')}<h3>${search?'Kein passendes Event.':filter==='past'?'Noch keine vergangenen Events.':'Der nächste Abend wartet.'}</h3><p>${search?'Ändere deine Suche oder den Filter.':filter==='past'?'Vergangene Termine werden hier angezeigt.':'Trage einen Termin ein, damit das ganze Team Bescheid weiß.'}</p>${!search&&filter!=='past'?'<button class="button gold event-empty-button" data-action="new-event">'+icon('plus')+'Event eintragen</button>':''}</div>`;
}
function eventForm(id){
  const event=id?state.events.find(e=>e.id===id):null;if(id&&!event)return;
  const requestId=id||crypto.randomUUID();
  const defaultStart=eventInput(new Date(Math.ceil(Date.now()/3600000)*3600000));
  openModal(`${modalHead(id?'Event bearbeiten':'Event eintragen','Ein Termin für alle Mitarbeiter.','Events')}<form class="modal-body" id="event-form"><div class="field"><label for="event-title">Eventname</label><input id="event-title" name="title" value="${esc(event?.title||'')}" placeholder="z. B. Whiskyabend" required minlength="2" maxlength="100" autofocus></div><div class="field"><label for="event-start">Datum & Uhrzeit</label><input id="event-start" name="start" type="datetime-local" value="${event?eventInput(event.starts_at):defaultStart}" min="2020-01-01T00:00" max="2090-12-31T23:59" required></div><div class="field"><label for="event-end">Ende (optional)</label><input id="event-end" name="end" type="datetime-local" value="${event?.ends_at?eventInput(event.ends_at):''}" min="2020-01-01T00:00" max="2090-12-31T23:59"></div><div class="field"><label for="event-description">Infos für das Team (optional)</label><textarea id="event-description" name="description" rows="4" maxlength="2000" placeholder="Was ist geplant? Was muss das Team wissen?">${esc(event?.description||'')}</textarea></div><p class="helper">Alle Uhrzeiten gelten für Deutschland (Berlin).</p><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button gold" type="submit">${icon('check')}Speichern</button></div></form>`);
  $('#event-form').addEventListener('submit',async submit=>{
    submit.preventDefault();const form=submit.currentTarget;
    const body={title:form.elements.title.value,start:form.elements.start.value,end:form.elements.end.value,description:form.elements.description.value,...(event?{revision:event.revision}:{id:requestId})};
    await eventSubmit(form,()=>api('/events'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body}),'Event gespeichert.');
  });
}
function eventDetails(id){
  const event=state.events.find(e=>e.id===id);if(!event)return;
  const [label,cls]=eventStatus(event);
  openModal(`${modalHead(event.title,eventTimeRange(event),'Events')}<div class="modal-body"><span class="badge ${cls}">${label}</span><p class="event-details-description">${esc(event.description||'Keine weiteren Informationen eingetragen.')}</p><p class="helper">Eingetragen von ${esc(event.created_by_name)}<br>Zuletzt bearbeitet von ${esc(event.updated_by_name)} · ${date(event.updated_at)} · ${time(event.updated_at)} Uhr</p><div class="modal-actions"><button class="button danger" data-action="delete-event" data-id="${esc(id)}">${icon('trash')}Löschen</button><button class="button gold" data-action="edit-event" data-id="${esc(id)}">${icon('edit')}Bearbeiten</button></div></div>`);
}
function deleteEventForm(id){
  const event=state.events.find(e=>e.id===id);if(!event)return;
  openModal(`${modalHead('Event löschen',event.title,'Events')}<form class="modal-body" id="delete-event-form"><p class="helper">Dieses Event wird aus der Terminübersicht für alle Mitarbeiter entfernt.</p><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Behalten</button><button class="button danger" type="submit">${icon('trash')}Event löschen</button></div></form>`);
  $('#delete-event-form').addEventListener('submit',async submit=>{
    submit.preventDefault();await eventSubmit(submit.currentTarget,()=>api('/events/'+encodeURIComponent(id),{method:'DELETE',body:{revision:event.revision}}),'Event gelöscht.');
  });
}
async function eventSubmit(form,run,message){
  if(state.busy)return;
  state.busy=true;const controls=[...form.querySelectorAll('input,textarea,button')];controls.forEach(control=>control.disabled=true);$('.error',form).textContent='';
  try{await run();modal.close();toast(message);await renderPage();}
  catch(error){if(form.isConnected)$('.error',form).textContent=error.message;else toast(error.message,true);}
  finally{state.busy=false;controls.forEach(control=>control.disabled=false);}
}
