const durationText=seconds=>{const value=Math.max(0,Math.floor(Number(seconds)||0));return [Math.floor(value/3600),Math.floor(value/60)%60,value%60].map(n=>String(n).padStart(2,'0')).join(':');};
function renderTimeclock(){
  const target=$('#timeclock-widget');if(!target)return;
  const clock=state.timeclock,active=clock?.active_shift;
  target.className='timeclock-widget'+(active?' clock-active':'');
  target.innerHTML=clock?`<div class="clock-copy"><span>${active?'Im Dienst · '+esc(active.job):'Nicht im Dienst'}</span><strong id="clock-elapsed">${active?durationText((+new Date(clock.server_now)-+new Date(active.started_at))/1000):'Stempeluhr'}</strong></div><button class="button ${active?'':'gold'}" data-action="${active?'clock-out':'clock-in'}" ${state.clockBusy?'disabled':''}>${icon(active?'logout':'clock')}${active?'Ausstempeln':'Einstempeln'}</button>`:'<span>Stempeluhr wird geladen …</span>';
  tickTimeclock();
}
function tickTimeclock(){
  const clock=state.timeclock,target=$('#clock-elapsed');if(!target||!clock?.active_shift)return;
  target.textContent=durationText((+new Date(clock.server_now)-+new Date(clock.active_shift.started_at)+Date.now()-clock.received_at)/1000);
}
async function refreshTimeclock(){
  const employeeId=state.employee?.id;if(!employeeId)return;
  const result=await api('/timeclock');if(state.employee?.id!==employeeId)return;
  state.timeclock={...result,received_at:Date.now()};renderTimeclock();
}
function clockInForm(){
  if(!state.timeclock||state.clockBusy)return;
  const jobs=state.timeclock.jobs;
  openModal(`${modalHead('Einstempeln','Wähle, als welcher Rang du diese Schicht arbeitest.','Stempeluhr')}<form class="modal-body" id="clock-in-form"><div class="field"><label for="clock-job">Arbeitsrang dieser Schicht</label><select id="clock-job" name="job" required>${jobs.map(item=>`<option value="${esc(item.job)}">${esc(item.job)} · ${money(item.hourly_rate_cents,'USD')} / Stunde</option>`).join('')}</select></div><p class="helper">Es läuft immer nur eine Schicht gleichzeitig. Der Stundenlohn gilt für den ausgewählten Rang und wird sekundengenau anteilig berechnet. Schichten bleiben bei Abmeldung und Seitenneuladen bestehen.</p><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button gold" type="submit">${icon('clock')}Jetzt einstempeln</button></div></form>`);
  const requestId=crypto.randomUUID();
  $('#clock-in-form').addEventListener('submit',async event=>{
    event.preventDefault();if(state.clockBusy)return;const form=event.currentTarget;state.clockBusy=true;$('button[type=submit]',form).disabled=true;
    try{await api('/timeclock/in',{method:'POST',body:{id:requestId,job:form.elements.job.value}});modal.close();await refreshTimeclock();toast('Eingestempelt. Deine Schicht läuft.');if(state.view==='payroll')await renderPage();}
    catch(error){if(form.isConnected){$('.error',form).textContent=error.message;$('button[type=submit]',form).disabled=false;}await refreshTimeclock().catch(()=>{});}
    finally{state.clockBusy=false;renderTimeclock();}
  });
}
async function clockOut(){
  const active=state.timeclock?.active_shift;if(!active||state.clockBusy)return;
  state.clockBusy=true;renderTimeclock();
  const request=state.clockOutPending||{id:crypto.randomUUID(),shift_id:active.id};state.clockOutPending=request;
  try{const {shift}=await api('/timeclock/out',{method:'POST',body:request});state.clockOutPending=null;await refreshTimeclock();toast('Ausgestempelt · '+money(shift.amount_cents,'USD')+' Lohn vorgemerkt.');if(state.view==='payroll')await renderPage();}
  catch(error){if(error.status>=400)state.clockOutPending=null;toast(error.message,true);await refreshTimeclock().catch(()=>{});}
  finally{state.clockBusy=false;renderTimeclock();}
}
function shiftTable(shifts){return shifts.length?`<div class="table-scroll"><table><thead><tr><th>Beginn</th><th>Ende</th><th>Arbeitsrang</th><th>Zeit</th><th class="right">Stundenlohn</th><th class="right">Verdient</th></tr></thead><tbody>${shifts.map(shift=>`<tr><td>${date(shift.started_at)} · ${time(shift.started_at)}</td><td>${shift.ended_at?date(shift.ended_at)+' · '+time(shift.ended_at):'<span class="badge">Im Dienst</span>'}</td><td>${esc(shift.job)}</td><td>${shift.ended_at?durationText(shift.worked_seconds):'Läuft'}</td><td class="right">${money(shift.hourly_rate_cents,'USD')}</td><td class="right">${shift.ended_at?money(shift.amount_cents,'USD'):'Nach dem Ausstempeln'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="table-empty">Noch keine Schicht erfasst.</div>';}
function payrollDetailMarkup(data){
  const p=data.employee;
  return `<div class="payroll-person-totals"><div><span>Offener Lohn</span><strong>${money(p.pending_cents,'USD')}</strong></div><div><span>Bereits ausgezahlt</span><strong>${money(p.paid_cents,'USD')}</strong></div><div><span>Verdient gesamt</span><strong>${money(p.earned_cents,'USD')}</strong></div></div>${p.active_shift?'<p class="payroll-notice">Eine Schicht läuft. Ihr Lohn wird nach dem Ausstempeln ergänzt.</p>':''}<section class="panel movement-panel"><div class="panel-heading"><h2>Arbeitszeiten</h2><span class="eyebrow">Letzte 100 Schichten</span></div>${shiftTable(data.shifts)}</section><section class="panel movement-panel"><div class="panel-heading"><h2>Lohnpositionen</h2><span class="eyebrow">Letzte 100 Positionen</span></div>${data.credits.length?`<div class="table-scroll"><table><thead><tr><th>Datum</th><th>Art</th><th class="right">Betrag</th><th>Status</th></tr></thead><tbody>${data.credits.map(c=>`<tr><td>${date(c.created_at)} · ${time(c.created_at)}</td><td>${({work:'Arbeitszeit',delivery:'Lieferlohn',delivery_reversal:'Verrechnung Lieferstorno'})[c.kind]}</td><td class="right">${money(c.amount_cents,'USD')}</td><td><span class="badge ${c.voided_at?'void':c.payout_id?'':'planned'}">${c.voided_at?'Storniert':c.payout_id?'Ausgezahlt':'Offen'}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="table-empty">Noch keine Lohnpositionen.</div>'}</section><section class="panel movement-panel"><div class="panel-heading"><h2>Auszahlungen</h2><span class="eyebrow">Letzte 100 Auszahlungen</span></div>${data.payouts.length?`<div class="table-scroll"><table><thead><tr><th>Datum</th><th class="right">Betrag</th><th>Ausgezahlt von</th></tr></thead><tbody>${data.payouts.map(payout=>`<tr><td>${date(payout.created_at)} · ${time(payout.created_at)}</td><td class="right">${money(payout.amount_cents,'USD')}</td><td>${esc(payout.recorded_by_name)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="table-empty">Noch kein Lohn ausgezahlt.</div>'}</section>`;
}
async function renderPayroll(epoch){
  $('#main').innerHTML=`${pageHeading('Der Lohn.','Arbeitszeit, Lieferlohn und Auszahlungen.','Löhne & Arbeitszeit')}<div id="payroll-content" class="table-empty">Löhne werden geladen …</div>`;
  try{
    if(!can('payroll_admin')){
      const data=await api('/payroll/me');if(epoch!==state.epoch)return;
      $('#payroll-content').className='';$('#payroll-content').innerHTML=payrollDetailMarkup(data);return;
    }
    const data=await api('/payroll');if(epoch!==state.epoch)return;state.payrollEmployees=data.employees;
    const total=data.employees.reduce((sum,p)=>sum+Math.max(0,Number(p.pending_cents)),0);
    $('#payroll-content').className='';$('#payroll-content').innerHTML=`<div class="stat-cards payroll-metrics">${[['Offener Lohn gesamt',total,'Abgeschlossene Schichten + Lieferlohn'],['Bankguthaben',data.bank_cents,'Auszahlungen belasten ausschließlich die Bank'],['Aktuell im Dienst',data.employees.filter(p=>p.active_shift).length,'Laufende Schichten werden nach Ende abgerechnet']].map(([label,value,hint],index)=>`<div class="stat-card"><div class="metric-label">${label}${icon(index===2?'clock':'coin')}</div><strong>${index===2?value:money(value,'USD')}</strong><p class="helper">${hint}</p></div>`).join('')}</div><div class="toolbar"><div class="search">${icon('search')}<input id="payroll-search" type="search" aria-label="Löhne nach Mitarbeiter suchen" placeholder="Mitarbeiter suchen …" value="${esc(state.payrollSearch||'')}"></div><label class="filter-check"><input type="checkbox" id="payroll-only-open" ${state.payrollOnlyOpen?'checked':''}>Nur offene Löhne</label><button class="button" data-action="refresh">${icon('clock')}Aktualisieren</button></div><section class="panel"><div class="panel-heading"><h2>Team & Löhne</h2><span class="eyebrow">Dollar ($)</span></div><div id="payroll-team"></div></section><p class="helper payroll-caption">Lohn auszahlen verbucht eine Bankausgabe. Laufende Schichten sind noch nicht auszahlbar. Negative Beträge aus Lieferstornos werden mit künftigem Lohn verrechnet. Auszahlungen benötigen das Recht „Löhne verwalten & auszahlen“. Diese Bankausgabe wird protokolliert.</p><div id="payroll-detail"></div>`;
    const draw=()=>{
      const search=(state.payrollSearch||'').toLowerCase();const rows=data.employees.filter(p=>p.name.toLowerCase().includes(search)&&(!state.payrollOnlyOpen||Number(p.pending_cents)>0));
      $('#payroll-team').innerHTML=rows.length?`<div class="table-scroll"><table><thead><tr><th>Mitarbeiter</th><th>Dienst</th><th class="right">Offener Lohn</th><th class="right">Ausgezahlt</th><th></th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${esc(p.name)}</strong><small class="wallet-target-label">${esc(employeeRanks(p).join(' + '))}${p.removed_at?' · entfernt':!p.active?' · deaktiviert':''}</small></td><td>${p.active_shift?'<span class="badge">'+esc(p.active_shift.job)+'</span>':'<span class="muted">Ausgestempelt</span>'}</td><td class="right">${money(p.pending_cents,'USD')}</td><td class="right">${money(p.paid_cents,'USD')}</td><td class="payroll-row-actions"><button class="detail-button" data-action="payroll-details" data-id="${esc(p.id)}">Details</button>${p.active_shift?'<button class="button" data-action="payroll-end-shift" data-id="'+esc(p.id)+'">Schicht beenden</button>':''}<button class="button gold" data-action="payroll-payout" data-id="${esc(p.id)}" ${Number(p.pending_cents)<=0?'disabled':''}>Lohn auszahlen</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="table-empty">Keine passenden Mitarbeiter.</div>';
    };
    $('#payroll-search').addEventListener('input',event=>{state.payrollSearch=event.target.value;draw();});$('#payroll-only-open').addEventListener('change',event=>{state.payrollOnlyOpen=event.target.checked;draw();});draw();
  }catch(error){if(epoch===state.epoch&&$('#payroll-content'))$('#payroll-content').innerHTML=`<p class="error">${esc(error.message)}</p><button class="button" data-action="refresh">Erneut laden</button>`;}
}
async function payrollDetails(id){
  const data=await api('/payroll/'+encodeURIComponent(id));if(state.view!=='payroll'||!$('#payroll-detail'))return;
  $('#payroll-detail').innerHTML=`<div class="payroll-detail-heading"><h2>${esc(data.employee.name)}</h2><button class="detail-button" data-action="close-payroll-details">Schließen ${icon('close')}</button></div>${payrollDetailMarkup(data)}`;
  $('#payroll-detail').scrollIntoView({behavior:'smooth',block:'start'});
}
function payrollPayoutForm(id){
  if(state.operationPending)return resumeOperation();const employee=state.payrollEmployees?.find(p=>p.id===id);if(!employee)return;
  openModal(`${modalHead('Lohn auszahlen',employee.name,'Löhne')}<form class="modal-body" id="payroll-payout-form"><div class="payroll-payout-amount">${money(employee.pending_cents,'USD')}</div><p class="helper">Dieser Betrag wird vom Bankkonto der Bar abgezogen und als ausgezahlter Lohn erfasst. Erst bestätigen, wenn die Lohnzahlung erfolgen soll.</p><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button gold" type="submit">${icon('check')}Lohn auszahlen</button></div></form>`);
  operationForm($('#payroll-payout-form'),'/payroll/payout',()=>({employee_id:id,expected_snapshot:employee.snapshot}));
}
function payrollEndShift(id){
  if(state.operationPending)return resumeOperation();const employee=state.payrollEmployees?.find(p=>p.id===id);if(!employee?.active_shift)return;
  openModal(`${modalHead('Schicht beenden',employee.name,'Stempeluhr')}<form class="modal-body" id="payroll-end-form"><p class="helper">Die Arbeitszeit wird bis jetzt erfasst und als offener Lohn vorgemerkt. Es wird noch kein Geld ausgezahlt.</p><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button gold" type="submit">Jetzt ausstempeln</button></div></form>`);
  operationForm($('#payroll-end-form'),'/timeclock/out',()=>({shift_id:employee.active_shift.id}));
}
setInterval(()=>{if(state.employee&&!document.hidden)tickTimeclock();},1000);
