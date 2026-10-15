function employeeRanks(employee){return employee.roles?.length?employee.roles:[employee.role||'Barkeeper'];}
function employeeRole(employee){return [employeeRanks(employee).join(' + '),employee.department].filter(Boolean).join(' · ');}
function updateEmployeeHeader(employee){
  const changed=JSON.stringify(state.employee?.permissions)!==JSON.stringify(employee.permissions);
  state.employee=employee;
  const role=$('.user-role');if(role)role.textContent=employeeRole(employee);
  if(changed&&employee.permissions)syncRoleNavigation();
}
async function renderEmployees(epoch){
  $('#main').innerHTML=`${pageHeading('Das Team.','Rollen vergeben, Abteilungen eintragen und Anmeldungen verwalten.','Mitarbeiter')}<div id="employees-content" class="table-empty">Mitarbeiter werden geladen …</div>`;
  try{
    const {employees,jobs,permission_options}=await api('/employees?include_removed=true');if(epoch!==state.epoch)return;
    state.employees=employees;
    state.employeeJobs=jobs;state.permissionOptions=permission_options;
    const visible=employees.filter(e=>!e.removed_at),active=visible.filter(e=>e.active),signed=active.filter(e=>e.session_count>0);
    const content=$('#employees-content');content.className='';
    content.innerHTML=`<div class="stat-cards employee-metrics">${[['Im Team',active.length,'user','Aktive Mitarbeiter'],['Angemeldet',signed.length,'check','Mit mindestens einer gültigen Anmeldung'],['Deaktiviert',visible.length-active.length,'lock','Anmeldung mit diesem Namen gesperrt']].map(([label,value,i,hint])=>`<div class="stat-card"><div class="metric-label">${label}${icon(i)}</div><strong>${value}</strong><div class="helper">${hint}</div></div>`).join('')}</div><div class="toolbar employee-toolbar"><div class="search">${icon('search')}<input id="employee-search" type="search" aria-label="Mitarbeiter suchen" placeholder="Name, Rolle oder Abteilung suchen …" value="${esc(state.employeeSearch||'')}"></div><select id="employee-filter" aria-label="Mitarbeiter filtern">${[['all','Alle Mitarbeiter'],['active','Aktive Mitarbeiter'],['signed','Angemeldete Mitarbeiter'],['inactive','Deaktivierte Mitarbeiter'],['removed','Entfernte Mitarbeiter']].map(([value,label])=>`<option value="${value}" ${value===(state.employeeFilter||'all')?'selected':''}>${label}</option>`).join('')}</select><button class="button" data-action="refresh">${icon('clock')}Aktualisieren</button></div><section class="panel"><div class="panel-heading"><h2 id="employee-list-heading">Mitarbeiterliste</h2><span id="employee-count" class="eyebrow"></span></div><div id="employee-list" class="employee-list"></div></section><p class="employee-note helper">„Rauswerfen“ entfernt die Person aus der Mitarbeiterliste und sperrt ihre Anmeldung. Über den Filter „Entfernte Mitarbeiter“ kannst du sie wiederherstellen. „Deaktivieren“ sperrt die Anmeldung und behält die Person in der Liste. Umsätze, Buchungen und Bargeld bleiben erhalten.</p>`;
    $('#employee-search').addEventListener('input',event=>{state.employeeSearch=event.target.value;renderEmployeeList();});
    $('#employee-filter').addEventListener('change',event=>{state.employeeFilter=event.target.value;renderEmployeeList();});
    renderEmployeeList();
  }catch(error){if(epoch===state.epoch&&$('#employees-content'))$('#employees-content').innerHTML=`<p class="error">${esc(error.message)}</p><button class="button" data-action="refresh">Erneut laden</button>`;}
}
function renderEmployeeList(){
  const search=(state.employeeSearch||'').trim().toLocaleLowerCase('de-DE'),filter=state.employeeFilter||'all';
  const source=state.employees.filter(e=>filter==='removed'?!!e.removed_at:!e.removed_at);
  const employees=source.filter(e=>`${e.name} ${employeeRanks(e).join(' ')} ${e.department}`.toLocaleLowerCase('de-DE').includes(search)&&(filter==='all'||filter==='removed'||filter==='active'&&e.active||filter==='signed'&&e.active&&e.session_count>0||filter==='inactive'&&!e.active));
  $('#employee-list-heading').textContent=filter==='removed'?'Entfernte Mitarbeiter':'Mitarbeiterliste';
  $('#employee-count').textContent=`${employees.length} von ${source.length}`;
  $('#employee-list').innerHTML=employees.length?employees.map(e=>{
    const removed=!!e.removed_at,self=e.id===state.employee.id;
    return `<article class="employee-card ${e.active&&!removed?'':'employee-disabled'}"><div class="employee-card-heading"><span class="avatar">${esc(initials(e.name))}</span><div><h3>${esc(e.name)}${self?'<span class="you-tag">DU</span>':''}</h3><span class="badge ${e.active&&!removed?(e.session_count?'':'inactive'):'void'}">${removed?'Entfernt':e.active?(e.session_count?'Angemeldet':'Abgemeldet'):'Deaktiviert'}</span></div></div>
      <dl class="employee-info"><div><dt>Ränge</dt><dd>${esc(employeeRanks(e).join(' + '))}</dd></div><div><dt>Zugriffsrechte</dt><dd>${e.permissions.manage?'Vollzugriff':e.custom_permissions?'Individuell festgelegt':'Aus Rängen'}</dd></div><div><dt>Abteilung</dt><dd class="${e.department?'':'muted'}">${esc(e.department||'Noch nicht eingetragen')}</dd></div><div><dt>Letzte Anmeldung</dt><dd>${e.last_login_at?date(e.last_login_at)+' · '+time(e.last_login_at):'Noch nicht erfasst'}</dd></div><div><dt>Gültige Anmeldungen</dt><dd>${e.session_count}</dd></div><div><dt>Bar auf der Hand</dt><dd>${money(e.cash_cents,'USD')}</dd></div>${removed?`<div><dt>Entfernt am</dt><dd>${date(e.removed_at)} · ${time(e.removed_at)}</dd></div>`:''}</dl>
      <div class="employee-card-actions">${removed?`<button class="button gold" data-action="restore-employee" data-id="${esc(e.id)}">${icon('check')}Wiederherstellen</button>`:`<button class="button" data-action="edit-employee" data-id="${esc(e.id)}">${icon('edit')}Rolle & Abteilung</button>${can('manage')?`<button class="button" data-action="edit-employee-permissions" data-id="${esc(e.id)}">${icon('lock')}Zugriffsrechte</button>`:''}<button class="button danger" data-action="kick-employee" data-id="${esc(e.id)}" ${self?'disabled title="Ein anderer Mitarbeiter kann dich aus der Liste entfernen."':''}>${icon('trash')}Rauswerfen</button><div class="employee-access-actions">${e.active?`${e.session_count?`<button class="button" data-action="end-employee-sessions" data-id="${esc(e.id)}">${icon('logout')}Anmeldungen beenden</button>`:''}<button class="button" data-action="deactivate-employee" data-id="${esc(e.id)}" ${self?'disabled title="Ein anderer Mitarbeiter kann dich deaktivieren."':''}>${icon('lock')}Deaktivieren</button>`:`<button class="button gold" data-action="activate-employee" data-id="${esc(e.id)}">${icon('check')}Wieder aktivieren</button>`}</div>`}</div></article>`;
  }).join(''):'<div class="table-empty">'+(filter==='removed'&&!search?'Keine entfernten Mitarbeiter.':'Kein Mitarbeiter passt zu diesem Filter.')+'</div>';
}
function employeeForm(id){
  const employee=state.employees?.find(e=>e.id===id);if(!employee)return;
  const roles=state.employeeJobs;
  openModal(`${modalHead(employee.name,'Wähle einen oder mehrere Ränge.','Mitarbeiter bearbeiten')}<form class="modal-body" id="employee-form"><fieldset class="employee-rank-fields"><legend>Ränge</legend>${roles.map(role=>`<label class="employee-rank-option"><input type="checkbox" name="roles" value="${esc(role)}" ${employeeRanks(employee).includes(role)?'checked':''} ${!can('manage')&&['Inhaber','Manager'].includes(role)?'disabled':''}><span>${esc(role)}</span></label>`).join('')}</fieldset><p class="helper" id="employee-job-permissions"></p><div class="field"><label for="employee-department">Abteilung</label><input id="employee-department" name="department" value="${esc(employee.department)}" maxlength="80" placeholder="z. B. Bar & Empfang"><p class="helper">Frei eintragbar und unabhängig von den Rängen.</p></div><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button gold" type="submit">${icon('check')}Speichern</button></div></form>`);
  const form=$('#employee-form'),selected=()=>[...form.querySelectorAll('input[name=roles]:checked')].map(input=>input.value);
  const hint=()=>{
    const ranks=selected();form.querySelector('input[name=roles]:not(:disabled)')?.setCustomValidity(ranks.length?'':'Bitte mindestens einen Rang auswählen.');
    if(employee.custom_permissions){$('#employee-job-permissions').textContent='Individuelle Zugriffsrechte bleiben bei Rangänderungen erhalten. Die Ränge bestimmen weiterhin den Stundenlohn.';return;}
    $('#employee-job-permissions').textContent=ranks.some(role=>['Inhaber','Manager'].includes(role))?'Vollzugriff auf alle Seiten und Funktionen.':ranks.some(role=>['Barkeeper Leitung','Security Leitung'].includes(role))?'Vollzugriff auf Kasse, Eintritt, Lager, Einkauf, VIP, Events, Mitarbeiter, Sortiment und Statistiken.':ranks.some(role=>role.startsWith('Security'))&&ranks.some(role=>role.startsWith('Barkeeper'))?'Zugriff auf Kasse und Eintritt.':ranks.some(role=>role.startsWith('Security'))?'Zugriff auf Eintrittsbuchungen.':'Zugriff auf die Kasse.';
  };
  form.addEventListener('change',hint);hint();
  employeeSubmit(form,`/employees/${encodeURIComponent(id)}`,'PUT',()=>({roles:selected(),department:form.elements.department.value}),'Ränge und Abteilung gespeichert.');
}
function employeePermissionsForm(id){
  if(!can('manage'))return;
  const employee=state.employees?.find(person=>person.id===id);if(!employee)return;
  const options=state.permissionOptions,management=employee.permissions.manage,individual=employee.custom_permissions!==null;
  openModal(`${modalHead('Zugriffsrechte',employee.name,'Mitarbeiter')}<form class="modal-body" id="employee-permissions-form"><p class="helper permission-intro">Haken geben Zugriff auf den Bereich einschließlich Bearbeiten und Buchen. Ränge und Stundenlohn bleiben davon unabhängig. Nur Inhaber und Manager können Zugriffsrechte vergeben.</p>${management?'<p class="payroll-notice">Inhaber und Manager haben immer Vollzugriff.</p>':`<label class="filter-check permission-mode"><input id="individual-permissions" type="checkbox" ${individual?'checked':''}>Individuelle Rechte festlegen</label><p class="helper" id="permission-mode-hint"></p><div class="permission-tools"><button type="button" class="detail-button" id="select-all-permissions">Alle auswählen</button><button type="button" class="detail-button" id="clear-all-permissions">Alle abwählen</button></div>`}<fieldset class="permission-options"><legend>Freigegebene Bereiche</legend>${options.map(option=>`<label class="permission-option"><input type="checkbox" name="permission" value="${esc(option.key)}" ${employee.permissions[option.key]?'checked':''} ${management||!individual?'disabled':''}><span><strong>${esc(option.label)}</strong><small>${esc(option.description)}</small></span></label>`).join('')}</fieldset><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">${management?'Schließen':'Abbrechen'}</button>${management?'':'<button class="button gold" type="submit">'+icon('check')+'Rechte speichern</button>'}</div></form>`);
  if(management)return;
  const form=$('#employee-permissions-form'),mode=$('#individual-permissions'),inputs=[...form.querySelectorAll('input[name=permission]')];
  const sync=()=>{
    inputs.forEach(input=>{input.disabled=!mode.checked;if(!mode.checked)input.checked=!!employee.permission_defaults[input.value];});
    $('#permission-mode-hint').textContent=mode.checked?'Nur die angehakten Bereiche werden freigegeben. Auch eine leere Auswahl ist möglich; die Stempeluhr bleibt verfügbar.':'Es gelten die Rechte der zugewiesenen Ränge. Zum Ändern „Individuelle Rechte festlegen“ aktivieren.';
  };
  mode.addEventListener('change',sync);sync();
  $('#select-all-permissions').addEventListener('click',()=>{mode.checked=true;sync();inputs.forEach(input=>input.checked=true);});
  $('#clear-all-permissions').addEventListener('click',()=>{mode.checked=true;sync();inputs.forEach(input=>input.checked=false);});
  form.addEventListener('change',event=>{
    if(event.target.name!=='permission')return;
    const own=inputs.find(input=>input.value==='payroll'),team=inputs.find(input=>input.value==='payroll_admin');
    if(event.target===team&&team.checked)own.checked=true;
    if(event.target===own&&!own.checked)team.checked=false;
  });
  employeeSubmit(form,`/employees/${encodeURIComponent(id)}/permissions`,'PUT',()=>({permissions:mode.checked?Object.fromEntries(inputs.map(input=>[input.value,input.checked])):null}),'Zugriffsrechte gespeichert.');
}
function employeeAccessForm(kind,id){
  const employee=state.employees?.find(e=>e.id===id);if(!employee)return;
  if(id===state.employee.id&&(state.busy||state.pending||state.operationPending)){toast('Bitte zuerst den offenen Buchungsstatus prüfen.',true);return;}
  const kick=kind==='kick',sessions=kind==='sessions',restore=kind==='restore',activate=kind==='activate';
  const title=kick?'Mitarbeiter aus der Liste entfernen':sessions?'Alle Anmeldungen beenden':restore?'Mitarbeiter wiederherstellen':activate?'Mitarbeiter wieder aktivieren':'Mitarbeiter deaktivieren';
  const explanation=kick?`${employee.name} verschwindet aus der Mitarbeiterliste. Alle Anmeldungen werden beendet und die Anmeldung mit diesem Namen wird gesperrt. Über „Entfernte Mitarbeiter“ kannst du die Person wiederherstellen.`:sessions?`Alle Anmeldungen von ${employee.name} werden beendet. Die Person bleibt in der Mitarbeiterliste und kann sich erneut anmelden.`:restore?`${employee.name} wird wieder in der Mitarbeiterliste angezeigt und kann sich mit dem bisherigen Namen und dem Bar-Passwort anmelden.`:activate?`${employee.name} kann sich danach mit dem bisherigen Namen und dem Bar-Passwort wieder anmelden.`:`Alle Anmeldungen von ${employee.name} werden beendet. Die erneute Anmeldung mit diesem Namen bleibt gesperrt, bis die Person wieder aktiviert wird.`;
  const label=kick?'Jetzt rauswerfen':sessions?'Anmeldungen beenden':restore?'Wiederherstellen':activate?'Wieder aktivieren':'Jetzt deaktivieren';
  openModal(`${modalHead(title,employee.name,'Mitarbeiter')}<form class="modal-body" id="employee-access-form"><p class="employee-confirm-text">${esc(explanation)}</p><p class="helper">Bisherige Umsätze, Buchungen und Bargeldbestände bleiben erhalten.${kick&&Number(employee.cash_cents)>0?' Noch '+money(employee.cash_cents,'USD')+' bar auf der Hand; die Abgabe bleibt unter Kassenstand möglich.':''}</p><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button ${activate||restore?'gold':'danger'}" type="submit">${label}</button></div></form>`);
  const route=kick?'kick':sessions?'sessions/end':restore?'restore':'status',post=kick||sessions||restore;
  employeeSubmit($('#employee-access-form'),`/employees/${encodeURIComponent(id)}/${route}`,post?'POST':'PUT',()=>post?{}:{active:activate},kick?'Mitarbeiter aus der Liste entfernt.':sessions?'Alle Anmeldungen wurden beendet.':restore?'Mitarbeiter wiederhergestellt.':activate?'Mitarbeiter wieder aktiviert.':'Mitarbeiter deaktiviert.',sessions&&id===state.employee.id);
}
function employeeSubmit(form,url,method,makeBody,message,selfKick=false){
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(state.busy)return;
    const error=$('.error',form);error.textContent='';
    const fields=[...form.querySelectorAll('button,input,select')];
    try{
      const body=makeBody(form);state.busy=true;fields.forEach(field=>field.disabled=true);
      const result=await api(url,{method,body});
      if(result.employee?.id===state.employee?.id)updateEmployeeHeader((await api('/me')).employee);
      modal.close();toast(message);
      if(selfKick){saveDraft();state.employee=null;state.epoch++;renderLogin();return;}
      await renderPage();
    }catch(cause){if(form.isConnected)error.textContent=cause.message;else toast(cause.message,true);}
    finally{state.busy=false;fields.forEach(field=>field.disabled=false);}
  });
}
