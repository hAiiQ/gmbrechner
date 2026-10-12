const spaceName = id => id==='vip'?'VIP Lounge':'Oberer Bereich';
const unitName = (id,quantity=2) => (quantity===1?{hour:'Stunde',week:'Woche',month:'Monat'}:{hour:'Stunden',week:'Wochen',month:'Monate'})[id];
function stockBadge(p){return `<span class="stock-badge ${p.stock_quantity<30?'low':''}">${p.stock_quantity===0?'Ausverkauft':`${p.stock_quantity} Stück${p.stock_quantity<30?' · nachfüllen':''}`}</span>`;}
function stockNotice() {
  const low=state.products.filter(p=>p.stock_quantity<30);
  return low.length?`<button class="stock-notice" data-action="navigate" data-view="inventory">${icon('box')}<span><strong>${low.length} Artikel unter 30 Stück</strong><small>${esc(low.slice(0,3).map(p=>`${p.name}: ${p.stock_quantity}`).join(' · '))}${low.length>3?' · weitere im Lager':''}</small></span>${icon('arrow')}</button>`:'';
}
function refreshStockNotice(){if($('#stock-notice'))$('#stock-notice').innerHTML=stockNotice();}
function recoveryNotice() {
  const el=$('#operation-recovery');if(!el)return;
  el.innerHTML=state.operationPending?`<div class="recovery-notice" role="status">${icon('clock')}Der Status einer Lager-, Einkaufs-, VIP-, Finanz- oder Geldbuchung ist offen.<button class="button" data-action="resume-operation">Buchung prüfen</button></div>`:'';
}
async function completeOperation(pending) {
  state.operationPending=pending;saveDraft();recoveryNotice();
  try {
    await api(pending.url,{method:pending.method,body:pending.body});
    if(pending.url==='/purchases')state.purchaseCart=[];
    state.operationPending=null;saveDraft();recoveryNotice();modal.close();
    try{state.products=(await api('/products')).products;}catch{}
    toast('Gespeichert.');await renderPage();
  } catch(error) {
    if(error.status>=400&&error.status<500){state.operationPending=null;saveDraft();recoveryNotice();}
    throw error;
  }
}
function operationForm(form,url,makeBody) {
  const id=crypto.randomUUID();
  form.addEventListener('submit',async event=>{
    event.preventDefault();const button=$('button[type=submit]',form),errorEl=$('.error',form);errorEl.textContent='';button.disabled=true;
    try {
      const pending=state.operationPending||{url,method:'POST',body:{...makeBody(form),id}};
      for(const field of form.querySelectorAll('input,select,textarea'))field.disabled=true;
      await completeOperation(pending);
    }catch(error){
      if(form.isConnected){errorEl.textContent=error.message;button.disabled=false;button.textContent=state.operationPending?'Buchung prüfen':'Speichern';for(const field of form.querySelectorAll('input,select,textarea'))field.disabled=!!state.operationPending;}
      else toast(error.message,true);
    }
  });
}
function resumeOperation() {
  openModal(`${modalHead('Buchungsstatus prüfen','Wir prüfen dieselbe Buchungsnummer erneut. Dadurch wird keine zweite Buchung erzeugt.')}<div class="modal-body"><p id="recovery-error" class="error" role="alert"></p><button class="button gold full" id="retry-operation">Buchung prüfen</button></div>`);
  $('#retry-operation').addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{await completeOperation(state.operationPending);}catch(error){if($('#recovery-error'))$('#recovery-error').textContent=error.message;button.disabled=!state.operationPending;}
  });
}
async function renderInventory(epoch) {
  $('#main').innerHTML=`${pageHeading('Das Lager.','Jede Flasche. Jeder Artikel. Jederzeit im Blick.','Bestand & Nachschub')}<div id="inventory-content" class="table-empty">Bestände werden geladen …</div>`;
  try {
    const data=await api('/inventory');if(epoch!==state.epoch)return;
    state.inventory=data.products;
    const low=data.products.filter(p=>p.stock_quantity<30),total=data.products.reduce((n,p)=>n+p.stock_quantity,0);
    $('#inventory-content').className='';
    $('#inventory-content').innerHTML=`<div class="stat-cards inventory-summary">${[['Stück im Lager',total,'box','Über alle Artikel'],['Artikel unter 30',low.length,'info','Ab 30 Stück wieder ausreichend'],['Ausverkauft',data.products.filter(p=>p.stock_quantity===0).length,'glass','Bestand 0 · Verkauf gesperrt']].map(([label,value,i,hint])=>`<div class="stat-card"><div class="metric-label">${label}${icon(i)}</div><strong>${value}</strong><div class="helper">${hint}</div></div>`).join('')}</div>${low.length?`<div class="low-banner" role="status">${icon('info')}<div><strong>Nachschub einplanen</strong><p>${esc(low.map(p=>`${p.name} (${p.stock_quantity})`).join(' · '))}</p></div></div>`:''}<div class="toolbar"><div class="search">${icon('search')}<input id="stock-search" type="search" placeholder="Artikel suchen …" aria-label="Lagerartikel suchen"></div><label class="filter-check"><input id="only-low" type="checkbox">Nur unter 30 Stück</label><button class="button" data-action="refresh">${icon('clock')}Aktualisieren</button></div><div class="inventory-grid" id="inventory-grid"></div><section class="panel movement-panel"><div class="panel-heading"><h2>Bestandsbewegungen</h2><span class="eyebrow">Letzte 50 Änderungen</span></div><div class="table-scroll"><table><thead><tr><th>Datum</th><th>Artikel</th><th>Änderung</th><th>Danach</th><th>Grund</th><th>Mitarbeiter</th></tr></thead><tbody>${data.movements.map(m=>`<tr><td>${date(m.created_at)} · ${time(m.created_at)}</td><td>${esc(m.product_name)}</td><td class="${m.delta<0?'amount-expense':'amount-income'}">${m.delta>0?'+':''}${m.delta}</td><td>${m.quantity_after}</td><td class="reason-cell">${esc(m.reason)}</td><td>${esc(m.employee_name||'Erstbestand')}</td></tr>`).join('')}</tbody></table></div></section>`;
    function draw(){
      const search=$('#stock-search').value.toLocaleLowerCase('de-DE'),only=$('#only-low').checked;
      const rows=data.products.filter(p=>(!only||p.stock_quantity<30)&&`${p.name} ${p.category}`.toLocaleLowerCase('de-DE').includes(search));
      $('#inventory-grid').innerHTML=rows.length?rows.map(p=>`<article class="inventory-card ${p.stock_quantity<30?'needs-stock':''}"><div class="inventory-card-top"><span class="product-icon">${icon(categoryIcon(p.category))}</span>${stockBadge(p)}</div><h2>${esc(p.name)}</h2><p>${esc(p.category)}${p.active?'':' · pausiert'}</p><div class="stock-number">${p.stock_quantity}<span>Stück</span></div><button class="button full" data-action="adjust-stock" data-id="${esc(p.id)}">${icon('edit')}Bestand ändern</button></article>`).join(''):'<div class="empty-state"><h3>Kein passender Artikel.</h3><p>Ändere deine Suche oder den Filter.</p></div>';
    }
    $('#stock-search').addEventListener('input',draw);$('#only-low').addEventListener('change',draw);draw();
  }catch(error){if(epoch===state.epoch&&$('#inventory-content'))$('#inventory-content').innerHTML=`<p class="error">${esc(error.message)}</p><button class="button" data-action="refresh">Erneut laden</button>`;}
}
function stockForm(id) {
  if(state.operationPending)return resumeOperation();
  const p=state.inventory.find(p=>p.id===id);if(!p)return;
  openModal(`${modalHead(p.name,`Aktueller Bestand: ${p.stock_quantity} Stück`,'Lagerbestand')}<form class="modal-body" id="stock-form"><div class="field"><label for="stock-quantity">Neuer Gesamtbestand (Stück)</label><input id="stock-quantity" name="quantity" type="number" min="0" max="1000000" step="1" value="${p.stock_quantity}" required></div><div class="field"><label for="stock-reason">Grund für die Änderung</label><textarea id="stock-reason" name="reason" rows="2" minlength="3" maxlength="200" placeholder="z. B. Nachlieferung +50 oder Inventur" required></textarea></div><p class="helper">Gib den gesamten Bestand nach der Änderung an. Verkäufe und Stornos werden automatisch berücksichtigt.</p><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button gold" type="submit">Speichern</button></div></form>`);
  operationForm($('#stock-form'),`/inventory/${encodeURIComponent(id)}`,form=>({quantity:Number(form.elements.quantity.value),expected_quantity:p.stock_quantity,reason:form.elements.reason.value}));
}
function rentalStatus(r){return r.cancelled_at?['Storniert','void']:+new Date(r.ends_at)<=Date.now()?['Beendet','inactive']:+new Date(r.starts_at)>Date.now()?['Geplant','planned']:['Aktiv',''];}
async function renderVIP(epoch) {
  $('#main').innerHTML=`${pageHeading('Für besondere Abende.','Mehrere Gäste können denselben Bereich gleichzeitig buchen.','VIP & Vermietung')}<div class="rental-offers"><article class="rental-offer"><span class="eyebrow">STUNDENWEISE</span><h2>VIP Lounge</h2><p>Privater Raum für besondere Gesellschaft.</p><div class="rental-price">50.000 $<span>pro Stunde</span></div><button class="button gold" data-action="new-rental" data-space="vip">${icon('plus')}VIP Lounge vermieten</button></article><article class="rental-offer upper-offer"><span class="eyebrow">FESTE LAUFZEITEN</span><h2>Oberer Bereich</h2><p>Mehr Raum. Mehr Zeit. Ein eigener Bereich.</p><div class="upper-rates"><div class="rental-price">100.000 $<span>für 1 Woche</span></div><div class="rental-price">250.000 $<span>für 4 Wochen</span></div></div><button class="button gold" data-action="new-rental" data-space="upper">${icon('plus')}Oberen Bereich vermieten</button></article></div><section class="panel"><div class="panel-heading"><h2>Unsere VIP-Gäste</h2><button class="detail-button" data-action="refresh">${icon('clock')}Aktualisieren</button></div><div class="vip-filter"><label for="vip-status">Zeitraum / Status</label><select id="vip-status"><option value="current">Aktiv & geplant</option><option value="all">Alle Vermietungen</option><option value="ended">Beendet</option><option value="cancelled">Storniert</option></select><div class="search">${icon('search')}<input id="vip-search" type="search" aria-label="VIP-Gäste suchen" placeholder="Name, Familie oder Nummer …"></div></div><div id="vip-list" class="table-empty">Vermietungen werden geladen …</div></section>`;
  try {
    const data=await api('/rentals');if(epoch!==state.epoch)return;state.rentals=data.rentals;
    function draw(){
      const search=$('#vip-search').value.toLocaleLowerCase('de-DE'),filter=$('#vip-status').value;
      const rentals=data.rentals.filter(r=>`${r.customer_name} ${r.family} ${r.phone}`.toLocaleLowerCase('de-DE').includes(search)&&(filter==='all'||filter==='cancelled'&&r.cancelled_at||filter==='ended'&&!r.cancelled_at&&+new Date(r.ends_at)<=Date.now()||filter==='current'&&!r.cancelled_at&&+new Date(r.ends_at)>Date.now()));
      const el=$('#vip-list');el.className='';
      el.innerHTML=rentals.length?`<div class="vip-grid">${rentals.map(r=>{const [status,cls]=rentalStatus(r);return `<article class="vip-card"><div class="vip-card-top"><span class="eyebrow">${spaceName(r.space)}</span><span class="badge ${cls}">${status}</span></div><h3>${esc(r.customer_name)}</h3><p class="vip-family">${r.family?`Familie: ${esc(r.family)}`:'Ohne Familienangabe'}</p><dl><div><dt>Nummer</dt><dd>${esc(r.phone)}</dd></div><div><dt>Beginn</dt><dd>${date(r.starts_at)} · ${time(r.starts_at)}</dd></div><div><dt>Ende</dt><dd>${date(r.ends_at)} · ${time(r.ends_at)}</dd></div><div><dt>Miete</dt><dd>${money(r.total_cents,r.currency)}<small>${r.quantity} ${unitName(r.unit,r.quantity)}</small></dd></div></dl><p class="helper">Gebucht von ${esc(r.employee_name)} · ${date(r.created_at)}</p>${r.cancelled_at?`<p class="void-note">Grund: ${esc(r.cancel_reason)}</p>`:`<button class="detail-button cancel-link" data-action="cancel-rental" data-id="${esc(r.id)}">Vermietung stornieren</button>`}</article>`;}).join('')}</div>`:'<div class="table-empty">Keine Vermietungen für diesen Filter.<br>Neue Gäste erscheinen nach der Buchung hier.</div>';
    }
    $('#vip-status').addEventListener('change',draw);$('#vip-search').addEventListener('input',draw);draw();
  }catch(error){if(epoch===state.epoch&&$('#vip-list'))$('#vip-list').innerHTML=`<p class="error">${esc(error.message)}</p><button class="button" data-action="refresh">Erneut laden</button>`;}
}
function berlinNowInput(){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const get=t=>p.find(x=>x.type===t).value;return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
function rentalForm(space) {
  if(state.operationPending)return resumeOperation();
  openModal(`${modalHead(spaceName(space)+' vermieten','Der Mietbetrag wird beim Buchen als Einnahme in Finanzen erfasst.','VIP & Vermietung')}<form class="modal-body" id="rental-form"><div class="field"><label for="rental-name">Name</label><input id="rental-name" name="customer_name" minlength="2" maxlength="80" required></div><div class="form-row"><div class="field"><label for="rental-family">Familie (optional)</label><input id="rental-family" name="family" maxlength="80"></div><div class="field"><label for="rental-phone">Nummer</label><input id="rental-phone" name="phone" type="tel" maxlength="40" required></div></div><div class="field"><label for="rental-start">Beginn (Europe/Berlin)</label><input id="rental-start" name="start" type="datetime-local" min="2020-01-01T00:00" max="2090-12-31T23:59" value="${berlinNowInput()}" required></div><div class="${space==='vip'?'form-row':'rental-tariff'}"><div class="field"><label for="rental-unit">Tarif</label><select id="rental-unit" name="unit">${space==='vip'?'<option value="hour">50.000 $ / Stunde</option>':'<option value="week">1 Woche · 100.000 $</option><option value="four_weeks">4 Wochen · 250.000 $</option>'}</select></div>${space==='vip'?'<div class="field"><label for="rental-duration">Dauer (Stunden)</label><input id="rental-duration" name="quantity" type="number" min="1" max="52" step="1" value="1" required></div>':''}</div><div class="rental-quote" id="rental-quote" aria-live="polite">Zeitraum wird berechnet …</div><div class="field"><label for="rental-payment">Zahlung</label><select id="rental-payment" name="payment">${walletPaymentOptions('cash')}</select></div><p class="helper">${space==='vip'?'Das Enddatum ergibt sich aus Beginn und Dauer.':'Der Zeitraum beträgt automatisch 1 oder 4 Wochen ab Beginn.'} Alle Zeiten: Europe/Berlin.</p><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button gold" type="submit">Vermietung buchen</button></div></form>`);
  const form=$('#rental-form');let revision=0;
  const body=()=>({space,start:form.elements.start.value,unit:form.elements.unit.value,...(space==='vip'?{quantity:Number(form.elements.quantity.value)}:{})});
  async function refresh(){const current=++revision;try{const {quote:q}=await api('/rentals/quote',{method:'POST',body:body()});if(current!==revision||!form.isConnected)return;$('#rental-quote').innerHTML=`<span>Bis ${date(q.ends_at)} · ${time(q.ends_at)} Uhr</span><strong>${money(q.total_cents,'USD')}</strong>`;}catch(error){if(current===revision&&$('#rental-quote'))$('#rental-quote').textContent=error.message;}}
  for(const name of (space==='vip'?['start','unit','quantity']:['start','unit']))form.elements[name].addEventListener('input',refresh);refresh();
  operationForm(form,'/rentals',()=>({...body(),customer_name:form.elements.customer_name.value,family:form.elements.family.value,phone:form.elements.phone.value,payment:form.elements.payment.value}));
}
function reasonOperation(title,url,subtitle) {
  if(state.operationPending)return resumeOperation();
  openModal(`${modalHead(title,subtitle)}<form class="modal-body" id="reason-operation"><div class="field"><label for="operation-reason">Grund für das Storno</label><textarea id="operation-reason" name="reason" rows="3" minlength="3" maxlength="200" required></textarea></div><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button danger" type="submit">Storno bestätigen</button></div></form>`);
  operationForm($('#reason-operation'),url,form=>({reason:form.elements.reason.value}));
}
function financeForm(kind) {
  if(state.operationPending)return resumeOperation();
  openModal(`${modalHead(kind==='income'?'Sonstige Einnahme':'Ausgabe erfassen','Betrag, Datum und Grund werden mit deinem Namen gespeichert.','Finanzen')}<form class="modal-body" id="finance-form"><div class="form-row"><div class="field"><label for="finance-amount">Betrag ($)</label><input id="finance-amount" name="amount" type="text" inputmode="decimal" placeholder="500,00" required></div><div class="field"><label for="finance-date">Buchungsdatum</label><input id="finance-date" name="occurred_on" type="date" min="2000-01-01" max="2100-12-31" value="${today()}" required></div></div><div class="field"><label for="finance-payment">Zahlung / Geldquelle</label><select id="finance-payment" name="payment">${walletPaymentOptions(kind==='income'?'cash':'bank')}</select></div><div class="field"><label for="finance-reason">Grund</label><textarea id="finance-reason" name="reason" rows="3" minlength="3" maxlength="200" placeholder="z. B. Warenlieferung, Veranstaltung oder Reparatur" required></textarea></div><p class="error" role="alert"></p><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Abbrechen</button><button class="button gold" type="submit">${kind==='income'?'Einnahme buchen':'Ausgabe buchen'}</button></div></form>`);
  operationForm($('#finance-form'),'/finance',form=>{
    const price=form.elements.amount.value.trim().replace(',','.');
    if(!/^\d{1,8}(\.\d{1,2})?$/.test(price)||Number(price)<=0||Number(price)>10000000)throw new Error('Bitte einen Betrag größer als 0 bis 10.000.000 mit höchstens zwei Nachkommastellen eingeben.');
    return {kind,amount_cents:Math.round(Number(price)*100),reason:form.elements.reason.value,occurred_on:form.elements.occurred_on.value,payment:form.elements.payment.value};
  });
}
async function renderFinance(epoch) {
  $('#main').innerHTML=`${pageHeading('Die Finanzen.','Verkäufe, Vermietungen und alles dazwischen.','Einnahmen & Ausgaben')}<div class="toolbar"><div class="periods" aria-label="Finanzzeitraum">${[['today','Heute'],['week','7 Tage'],['month','Dieser Monat'],['all','Gesamt']].map(([p,label])=>`<button data-action="period" data-period="${p}" class="${state.period===p?'active':''}">${label}</button>`).join('')}</div><div class="date-range"><input id="finance-from" type="date" aria-label="Finanzen von" value="${state.from||''}"><span>bis</span><input id="finance-to" type="date" aria-label="Finanzen bis" value="${state.to||''}"></div><div class="finance-actions"><button class="button" data-action="new-finance" data-kind="expense">${icon('minus')}Ausgabe</button><button class="button gold" data-action="new-finance" data-kind="income">${icon('plus')}Sonstige Einnahme</button></div></div><div id="finance-content" class="table-empty">Finanzen werden geladen …</div>`;
  for(const id of ['finance-from','finance-to'])$('#'+id).addEventListener('change',()=>{
    const from=$('#finance-from').value,to=$('#finance-to').value;if(from&&to&&from>to)return toast('Das Enddatum muss nach dem Startdatum liegen.',true);
    state.from=from||null;state.to=to||null;state.period='custom';renderPage();
  });
  try {
    const params=new URLSearchParams();if(state.from)params.set('from',state.from);if(state.to)params.set('to',state.to);
    const data=await api(`/finance?${params}`);if(epoch!==state.epoch)return;
    const t=data.totals,cards=[['Saldo',t.balance_cents,'chart','Einnahmen abzüglich Ausgaben'],['Alle Einnahmen',t.income_cents,'coin','Kasse + Vermietungen + Sonstiges'],['Ausgaben',t.expense_cents,'minus','Stornierte Einträge ausgeschlossen'],['Kassenumsatz',t.sales_cents,'register','Artikelverkäufe'],['Vermietungen',t.rental_income_cents,'clock','Beim Buchen als Einnahme erfasst'],['Sonstige Einnahmen',t.other_income_cents,'plus','Mit Begründung erfasst']];
    $('#finance-content').className='';$('#finance-content').innerHTML=`<div class="stat-cards finance-summary">${cards.map(([label,value,i,hint])=>`<div class="stat-card"><div class="metric-label">${label}${icon(i)}</div><strong>${money(value,data.currency)}</strong><div class="helper">${hint}</div></div>`).join('')}</div><section class="panel"><div class="panel-heading"><h2>Finanzbuchungen</h2><span class="eyebrow">Dollar ($)</span></div>${data.entries.length?`<div class="table-scroll"><table><thead><tr><th>Datum</th><th>Art</th><th>Zahlung</th><th>Grund</th><th>Mitarbeiter</th><th class="right">Betrag</th><th>Status</th><th></th></tr></thead><tbody>${data.entries.map(e=>`<tr><td>${date(e.occurred_on+'T12:00:00Z')}</td><td>${e.purchase_id?'Einkauf':e.rental_id?'Vermietung':e.kind==='income'?'Sonstige Einnahme':'Ausgabe'}</td><td>${({cash:'Bar',card:'Übergangskonto',bank:'Bank'})[e.payment]||'Bank'}</td><td class="reason-cell">${esc(e.reason)}${e.voided_at?`<small>Stornogrund: ${esc(e.void_reason)}</small>`:''}</td><td>${esc(e.employee_name)}</td><td class="right ${e.kind==='income'?'amount-income':'amount-expense'}">${e.kind==='income'?'+':'−'}${money(e.amount_cents,e.currency)}</td><td><span class="badge ${e.voided_at?'void':''}">${e.voided_at?'Storniert':'Gebucht'}</span></td><td>${!e.voided_at&&!e.rental_id&&!e.purchase_id?`<button class="detail-button" data-action="void-finance" data-id="${esc(e.id)}">Stornieren</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="table-empty">Noch keine Vermietung oder sonstige Finanzbuchung in diesem Zeitraum.</div>'}<div class="table-caption">Die neuesten 200 Finanzbuchungen im Zeitraum. Artikelverkäufe findest du unter „Umsätze“. Vermietungen werden auf der VIP-Seite und Einkäufe auf der Einkaufsseite storniert.</div></section>`;
  }catch(error){if(epoch===state.epoch&&$('#finance-content'))$('#finance-content').innerHTML=`<p class="error">${esc(error.message)}</p><button class="button" data-action="refresh">Erneut laden</button>`;}
}
